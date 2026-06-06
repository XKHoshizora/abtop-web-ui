//! Tiny blocking HTTP server (tiny_http): serves the embedded React SPA, the
//! snapshot JSON, and a Server-Sent-Events stream. A single acceptor thread
//! spawns one short-lived thread per request (capped); handlers only read the
//! shared snapshot cache.
//!
//! Auth is cookie-session based (so the SPA can show a real login page instead
//! of a browser Basic-auth dialog, and so `EventSource` — which can't set
//! headers — is authenticated automatically via the cookie). `POST /api/login`
//! validates the credentials, throttles brute-force per client, and sets an
//! `HttpOnly` session cookie with a server-enforced TTL. A single gate (not a
//! per-route check) protects every `/api/*` route except the public ones, so a
//! newly-added data route is auth-gated by default. When no password is
//! configured, auth is disabled.

use crate::monitor::SnapshotCache;
use rust_embed::RustEmbed;
use std::collections::HashMap;
use std::io::{self, Read};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

/// The production SPA build, embedded at compile time. Run `pnpm build` in
/// `web/` before `cargo build` so this directory exists.
#[derive(RustEmbed)]
#[folder = "web/dist"]
struct WebAssets;

const SESSION_COOKIE: &str = "abtop_session";
/// Server-enforced session lifetime (matches the cookie Max-Age).
const SESSION_TTL: Duration = Duration::from_secs(7 * 24 * 3600);
const SESSION_MAX_AGE_SECS: u64 = 7 * 24 * 3600;
/// Hard cap on live sessions to bound memory under abuse.
const MAX_SESSIONS: usize = 4096;
/// Login brute-force throttle: at most N failures per client per window.
const LOGIN_MAX_FAILS: u32 = 10;
const LOGIN_WINDOW: Duration = Duration::from_secs(60);
/// Cap the unauthenticated login body read.
const MAX_LOGIN_BODY: u64 = 64 * 1024;
/// Cap concurrent request threads (each SSE client holds one for its lifetime).
const MAX_CONN: usize = 128;
/// `/api/*` routes reachable without a session.
const PUBLIC_API: &[&str] = &["/api/me", "/api/login", "/api/logout"];

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------

struct Credentials {
    username: String,
    password: String,
}

/// Immutable credentials plus the mutable session/throttle maps. `creds` is
/// `None` when authentication is disabled (the localhost default).
pub struct AuthState {
    creds: Option<Credentials>,
    /// token -> issued time.
    sessions: Mutex<HashMap<String, Instant>>,
    /// client ip -> (failures, window start).
    attempts: Mutex<HashMap<String, (u32, Instant)>>,
}

impl AuthState {
    /// `password = None` disables auth. `username` defaults to "admin".
    pub fn new(username: Option<String>, password: Option<String>) -> Self {
        let creds = password.map(|password| Credentials {
            username: username.unwrap_or_else(|| "admin".to_string()),
            password,
        });
        Self {
            creds,
            sessions: Mutex::new(HashMap::new()),
            attempts: Mutex::new(HashMap::new()),
        }
    }

    pub fn required(&self) -> bool {
        self.creds.is_some()
    }

    fn verify(&self, username: &str, password: &str) -> bool {
        match &self.creds {
            None => false,
            Some(c) => {
                // Evaluate both comparisons (no short-circuit) before AND-ing.
                let u = ct_eq(username.as_bytes(), c.username.as_bytes());
                let p = ct_eq(password.as_bytes(), c.password.as_bytes());
                u & p
            }
        }
    }

    fn issue(&self) -> String {
        let token = random_token();
        let mut g = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        // Drop expired sessions, then enforce the hard cap (evict oldest).
        g.retain(|_, t| t.elapsed() < SESSION_TTL);
        if g.len() >= MAX_SESSIONS {
            if let Some(oldest) = g.iter().min_by_key(|(_, t)| **t).map(|(k, _)| k.clone()) {
                g.remove(&oldest);
            }
        }
        g.insert(token.clone(), Instant::now());
        token
    }

    fn valid(&self, token: &str) -> bool {
        self.sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(token)
            .is_some_and(|t| t.elapsed() < SESSION_TTL)
    }

    fn revoke(&self, token: &str) {
        self.sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(token);
    }

    /// True when allowed to read data: auth disabled, or any presented session
    /// cookie is valid (and unexpired).
    fn authed(&self, req: &Request) -> bool {
        if self.creds.is_none() {
            return true;
        }
        cookie_tokens(req).iter().any(|t| self.valid(t))
    }

    fn throttled(&self, ip: &str) -> bool {
        let g = self.attempts.lock().unwrap_or_else(|e| e.into_inner());
        match g.get(ip) {
            Some((fails, start)) => start.elapsed() <= LOGIN_WINDOW && *fails >= LOGIN_MAX_FAILS,
            None => false,
        }
    }

    fn record_fail(&self, ip: &str) {
        let mut g = self.attempts.lock().unwrap_or_else(|e| e.into_inner());
        g.retain(|_, (_, start)| start.elapsed() <= LOGIN_WINDOW);
        let entry = g.entry(ip.to_string()).or_insert((0, Instant::now()));
        entry.0 += 1;
    }

    fn record_success(&self, ip: &str) {
        self.attempts
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(ip);
    }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

/// Start the accept loop on a background thread. Returns immediately.
pub fn spawn(
    server: Arc<Server>,
    cache: SnapshotCache,
    push_interval: Duration,
    auth: Arc<AuthState>,
) {
    let active = Arc::new(AtomicUsize::new(0));
    thread::spawn(move || loop {
        match server.recv() {
            Ok(req) => {
                if active.load(Ordering::Relaxed) >= MAX_CONN {
                    let _ = req.respond(Response::from_string("server busy").with_status_code(503));
                    continue;
                }
                active.fetch_add(1, Ordering::Relaxed);
                let cache = cache.clone();
                let auth = auth.clone();
                let active = active.clone();
                thread::spawn(move || {
                    handle(req, cache, push_interval, auth);
                    active.fetch_sub(1, Ordering::Relaxed);
                });
            }
            Err(_) => break, // server shutting down
        }
    });
}

fn header(key: &str, value: &str) -> Header {
    Header::from_bytes(key.as_bytes(), value.as_bytes()).expect("valid header")
}

fn json(body: impl Into<String>) -> Response<io::Cursor<Vec<u8>>> {
    Response::from_string(body.into())
        .with_header(header("Content-Type", "application/json"))
        .with_header(header("Cache-Control", "no-store"))
}

fn unauthorized() -> Response<io::Cursor<Vec<u8>>> {
    json(r#"{"error":"unauthorized"}"#).with_status_code(401)
}

fn read_cache(cache: &SnapshotCache) -> String {
    cache.read().map(|s| s.clone()).unwrap_or_else(|_| "{}".to_string())
}

fn handle(mut req: Request, cache: SnapshotCache, push_interval: Duration, auth: Arc<AuthState>) {
    let method = req.method().clone();
    let path = req.url().split('?').next().unwrap_or("/").to_string();

    // Single auth gate: every /api/* route except the public ones needs a
    // valid session. New data routes are therefore gated by default.
    if path.starts_with("/api/") && !PUBLIC_API.contains(&path.as_str()) && !auth.authed(&req) {
        let _ = req.respond(unauthorized());
        return;
    }

    match (&method, path.as_str()) {
        (Method::Get, "/healthz") => {
            let _ = req.respond(Response::from_string("ok"));
        }

        (Method::Get, "/api/me") => {
            let body = format!(
                r#"{{"authRequired":{},"authenticated":{}}}"#,
                auth.required(),
                auth.authed(&req),
            );
            let _ = req.respond(json(body));
        }

        (Method::Post, "/api/login") => {
            let ip = client_ip(&req);
            if auth.throttled(&ip) {
                let _ = req
                    .respond(json(r#"{"ok":false,"error":"too_many_attempts"}"#).with_status_code(429));
                return;
            }
            let mut body = String::new();
            let _ = req.as_reader().take(MAX_LOGIN_BODY).read_to_string(&mut body);
            let (user, pass) = parse_login(&body);
            if auth.verify(&user, &pass) {
                auth.record_success(&ip);
                let token = auth.issue();
                let secure = if is_https(&req) { "; Secure" } else { "" };
                let cookie = format!(
                    "{}={}; HttpOnly; SameSite=Lax; Path=/; Max-Age={}{}",
                    SESSION_COOKIE, token, SESSION_MAX_AGE_SECS, secure
                );
                let _ = req.respond(json(r#"{"ok":true}"#).with_header(header("Set-Cookie", &cookie)));
            } else {
                auth.record_fail(&ip);
                let _ = req.respond(json(r#"{"ok":false}"#).with_status_code(401));
            }
        }

        (Method::Post, "/api/logout") => {
            for t in cookie_tokens(&req) {
                auth.revoke(&t);
            }
            let cookie = format!("{}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0", SESSION_COOKIE);
            let _ = req.respond(json(r#"{"ok":true}"#).with_header(header("Set-Cookie", &cookie)));
        }

        // Gated centrally above.
        (Method::Get, "/api/snapshot") => {
            let _ = req.respond(json(read_cache(&cache)));
        }

        (Method::Get, "/api/stream") => {
            let reader = SseReader::new(cache, push_interval);
            let resp = Response::new(
                StatusCode(200),
                vec![
                    header("Content-Type", "text/event-stream"),
                    header("Cache-Control", "no-cache"),
                    header("Connection", "keep-alive"),
                    header("X-Accel-Buffering", "no"),
                ],
                reader,
                None,
                None,
            );
            let _ = req.respond(resp);
        }

        // Unknown API path → JSON 404 (don't fall through to the SPA shell).
        (Method::Get, p) if p.starts_with("/api/") => {
            let _ = req.respond(json(r#"{"error":"not found"}"#).with_status_code(404));
        }

        // Everything else is the SPA (its own router shows login vs dashboard).
        (Method::Get, _) => serve_spa(req, &path),

        _ => {
            let _ = req.respond(Response::from_string("not found").with_status_code(404));
        }
    }
}

/// Serve an embedded SPA asset by path, falling back to index.html so client
/// routing works for unknown non-API paths.
fn serve_spa(req: Request, path: &str) {
    let rel = path.trim_start_matches('/');
    let rel = if rel.is_empty() { "index.html" } else { rel };

    let (file, name) = match WebAssets::get(rel) {
        Some(f) => (f, rel),
        None => match WebAssets::get("index.html") {
            Some(f) => (f, "index.html"),
            None => {
                let _ = req.respond(
                    Response::from_string("frontend not built (run `pnpm build` in web/)")
                        .with_status_code(500),
                );
                return;
            }
        },
    };

    let resp = Response::from_data(file.data.into_owned())
        .with_header(header("Content-Type", content_type(name)));
    let _ = req.respond(resp);
}

fn content_type(name: &str) -> &'static str {
    match name.rsplit('.').next().unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" | "map" => "application/json",
        "svg" => "image/svg+xml",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "ico" => "image/x-icon",
        "png" => "image/png",
        _ => "application/octet-stream",
    }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

fn parse_login(body: &str) -> (String, String) {
    let v: serde_json::Value = serde_json::from_str(body).unwrap_or(serde_json::Value::Null);
    let get = |k: &str| v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string();
    (get("username"), get("password"))
}

/// All non-empty `abtop_session` cookie values (handles duplicate cookies — a
/// stale empty one alongside a valid one no longer shadows the valid token).
fn cookie_tokens(req: &Request) -> Vec<String> {
    let mut out = Vec::new();
    for h in req.headers() {
        if h.field.as_str().as_str().eq_ignore_ascii_case("cookie") {
            for part in h.value.as_str().split(';') {
                if let Some(v) = part
                    .trim()
                    .strip_prefix(SESSION_COOKIE)
                    .and_then(|r| r.strip_prefix('='))
                {
                    if !v.is_empty() {
                        out.push(v.to_string());
                    }
                }
            }
        }
    }
    out
}

/// Client IP for throttling. Prefers Cloudflare's authoritative
/// `CF-Connecting-IP` (Caddy rewrites `X-Forwarded-For` to the rotating CF edge
/// IP, which would defeat per-client throttling), then `X-Forwarded-For`, then
/// the socket peer — so a brute-forcer locks out only their own IP.
fn client_ip(req: &Request) -> String {
    for name in ["cf-connecting-ip", "x-forwarded-for"] {
        for h in req.headers() {
            if h.field.as_str().as_str().eq_ignore_ascii_case(name) {
                if let Some(first) = h.value.as_str().split(',').next() {
                    let ip = first.trim();
                    if !ip.is_empty() {
                        return ip.to_string();
                    }
                }
            }
        }
    }
    req.remote_addr()
        .map(|a| a.ip().to_string())
        .unwrap_or_default()
}

/// Whether the original client request used HTTPS (per the reverse proxy's
/// `X-Forwarded-Proto`), so the session cookie can be marked `Secure` publicly
/// while still working over plain-HTTP localhost.
fn is_https(req: &Request) -> bool {
    for h in req.headers() {
        if h.field.as_str().as_str().eq_ignore_ascii_case("x-forwarded-proto") {
            return h.value.as_str().eq_ignore_ascii_case("https");
        }
    }
    false
}

fn random_token() -> String {
    use std::fmt::Write;
    let mut buf = [0u8; 32];
    getrandom::getrandom(&mut buf).expect("OS RNG");
    let mut s = String::with_capacity(64);
    for b in buf {
        let _ = write!(s, "{b:02x}");
    }
    s
}

/// Constant-time byte comparison (length is allowed to leak).
fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

// ---------------------------------------------------------------------------
// SSE
// ---------------------------------------------------------------------------

/// An endless `Read` that yields one SSE `data:` frame per `interval`. The
/// first frame is immediate; snapshots are single-line JSON so each fits one
/// `data:` field.
struct SseReader {
    cache: SnapshotCache,
    interval: Duration,
    frame: Vec<u8>,
    pos: usize,
    primed: bool,
}

impl SseReader {
    fn new(cache: SnapshotCache, interval: Duration) -> Self {
        Self {
            cache,
            interval,
            frame: Vec::new(),
            pos: 0,
            primed: false,
        }
    }

    fn next_frame(&mut self) {
        if self.primed {
            thread::sleep(self.interval);
        }
        self.primed = true;
        let json = read_cache(&self.cache);
        let mut frame = String::with_capacity(json.len() + 8);
        frame.push_str("data: ");
        frame.push_str(&json);
        frame.push_str("\n\n");
        self.frame = frame.into_bytes();
        self.pos = 0;
    }
}

impl Read for SseReader {
    fn read(&mut self, out: &mut [u8]) -> io::Result<usize> {
        if self.pos >= self.frame.len() {
            self.next_frame();
        }
        let n = std::cmp::min(out.len(), self.frame.len() - self.pos);
        out[..n].copy_from_slice(&self.frame[self.pos..self.pos + n]);
        self.pos += n;
        Ok(n)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ct_eq_matches_and_rejects() {
        assert!(ct_eq(b"hunter2", b"hunter2"));
        assert!(!ct_eq(b"hunter2", b"hunter3"));
        assert!(!ct_eq(b"short", b"longer"));
    }

    #[test]
    fn parse_login_extracts_fields() {
        let (u, p) = parse_login(r#"{"username":"admin","password":"s3cret"}"#);
        assert_eq!(u, "admin");
        assert_eq!(p, "s3cret");
        let (u2, p2) = parse_login("not json");
        assert_eq!(u2, "");
        assert_eq!(p2, "");
    }

    #[test]
    fn auth_disabled_when_no_password() {
        let st = AuthState::new(None, None);
        assert!(!st.required());
        assert!(!st.verify("admin", "x"));
    }

    #[test]
    fn issue_valid_and_revoke_token() {
        let st = AuthState::new(Some("admin".into()), Some("pw".into()));
        assert!(st.required());
        assert!(st.verify("admin", "pw"));
        assert!(!st.verify("admin", "nope"));
        let t = st.issue();
        assert!(st.valid(&t));
        st.revoke(&t);
        assert!(!st.valid(&t));
    }

    #[test]
    fn login_throttle_trips_after_max_fails() {
        let st = AuthState::new(Some("admin".into()), Some("pw".into()));
        let ip = "1.2.3.4";
        assert!(!st.throttled(ip));
        for _ in 0..LOGIN_MAX_FAILS {
            st.record_fail(ip);
        }
        assert!(st.throttled(ip));
        st.record_success(ip);
        assert!(!st.throttled(ip));
    }
}
