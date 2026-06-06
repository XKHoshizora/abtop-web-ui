# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`abtop-web-ui` is a web frontend for [abtop](https://github.com/graykode/abtop)
(an AI-agent TUI monitor). It does **not** scan anything itself — it reuses abtop's
data-collection layer *in-process as a library* and serves it as JSON + Server-Sent
Events, plus a React/Ant Design SPA embedded into the binary.

Two halves:
- **`src/*.rs`** — the Rust server (data loop + HTTP + auth + embedded assets).
- **`web/`** — the Vite + React + TypeScript + Ant Design SPA, built to `web/dist`
  and embedded into the Rust binary via `rust-embed`.

## Commands

```bash
# Rust: cargo lives at ~/.cargo/bin; source it if `cargo` isn't found:
. "$HOME/.cargo/env"
# Node: pnpm/npm come from mise; add to PATH if missing:
export PATH="$HOME/.local/share/mise/installs/node/<ver>/bin:$PATH"

# --- build order matters: the frontend must be built before the Rust crate,
#     because rust-embed embeds web/dist at compile time ---
cd web && pnpm install && pnpm build      # → web/dist (the embedded SPA)
cd .. && cargo build [--release]

# Frontend dev loop (hot reload, proxies /api → 127.0.0.1:8791):
cd web && pnpm dev                         # then run the Rust server separately
pnpm typecheck                             # tsc --noEmit (build does NOT typecheck)

# Rust
cargo run -- --open                        # serve http://127.0.0.1:8787/
cargo run -- --demo                        # serve abtop's demo fixture (no live agents)
cargo run -- --password secret             # require login (user via ABTOP_WEB_USERNAME, default admin)
cargo test                                 # auth/session unit tests live in src/server.rs
cargo test ct_eq_matches_and_rejects       # single test by name
```

Flags: `--host` (127.0.0.1), `--port` (8787), `--interval` (2s), `--open`, `--demo`,
`--password` / `ABTOP_WEB_PASSWORD`, `ABTOP_WEB_USERNAME` (env, default `admin`).

## Hard dependency: the abtop *fork*

`Cargo.toml` pulls `abtop = { path = "../abtop" }`. This requires the
[`XKHoshizora/abtop`](https://github.com/XKHoshizora/abtop) fork, **not** upstream
`graykode/abtop` (binary-only, no library surface). The fork adds: `pub mod` exports +
`src/snapshot.rs` (`Snapshot` / `App::to_snapshot`) + `App::tick_no_summaries` +
`#[derive(Serialize)]` on the model types.

## Architecture — the load-bearing invariants

Read `main.rs` → `monitor.rs` → `server.rs` together; two facts dictate the design:

1. **`abtop::app::App` is NOT `Send`** (it owns boxed `AgentCollector` trait objects). The
   collector loop runs on the **main thread** and owns the `App`; HTTP handler threads never
   touch it — they read a shared `Arc<RwLock<String>>` (`monitor::SnapshotCache`) of the latest
   serialized snapshot. Don't move `App` into a thread, share it via `Mutex` with handlers, or
   tick it per-request (corrupts cross-tick state: token-rate deltas, orphan-port tracking).

2. **Use `tick_no_summaries()`, never `tick()`.** abtop's full `tick()` spawns `claude --print`
   subprocesses to title sessions, which spends the user's Claude quota. The monitor loop calls
   `tick_no_summaries()`; titles fall back to the raw first prompt.

Data flow: `monitor::run` (main thread) ticks every `--interval`s → `App::to_snapshot()` →
`serde_json::to_string` → writes the cache string. `server::spawn` runs a tiny_http acceptor
thread that spawns one short-lived thread per request.

### Endpoints (`server.rs`)
- `GET /api/me` — `{authRequired, authenticated}`; the SPA uses it to pick login vs dashboard.
- `POST /api/login` — `{username,password}` JSON; on success sets an `HttpOnly` session cookie.
- `POST /api/logout` — revoke the session, clear the cookie.
- `GET /api/snapshot` — cached JSON (gated).
- `GET /api/stream` — SSE: an endless `Read` (`SseReader`) emitting `data: <json>\n\n` each
  interval (single-line JSON). Behind a proxy needs flushing (`X-Accel-Buffering: no`, and
  `flush_interval -1` in the Caddy vhost). Gated by the cookie — `EventSource` can't send
  headers, so cookie-session auth (not Basic) is what makes the stream authenticate itself.
- `GET /healthz` — liveness; the only un-gated route.
- everything else → the embedded SPA (`WebAssets`, a `rust-embed` of `web/dist`), with an
  `index.html` fallback for client-side routing.

### Auth (`server.rs`)
Cookie-session. `AuthState` holds optional credentials (None = auth disabled, the localhost
default) + a `Mutex<HashSet<String>>` of live tokens. Login does a constant-time compare,
issues a `getrandom` token, stores it, sets the cookie. There is **no** HTTP Basic / browser
dialog — the SPA renders a real login page (`web/src/pages/Login.tsx`).

### Frontend (`web/`)
Vite + React + TS + Ant Design + framer-motion. `App.tsx` calls `/api/me` then routes to
`Login` or `Dashboard`. `useSnapshot` (`src/hooks/useSnapshot.ts`) is SSE-primary with a polling
fallback that surfaces 401s (→ back to login). TS types in `src/types.ts` mirror the Rust
`Snapshot`/`SessionView` DTO — keep them in sync when changing the DTO. After any frontend
change, run `pnpm build` before `cargo build`.

**i18n + theming** live in `src/prefs.tsx` (a tiny `PrefsProvider` context — `useT()` /
`usePrefs()`, a flat `en`/`zh` dictionary, `localStorage`-persisted, **default English + dark**).
`main.tsx`'s `ThemedShell` reads prefs to set the antd `locale` and `buildAntdTheme(mode)`
(`src/theme.ts`, dark `darkAlgorithm` vs light `defaultAlgorithm`) and writes `data-theme` on
`<html>`. Colors are CSS variables in `src/styles.css` keyed by `:root[data-theme=…]`; component
inline styles use `var(--text)`, `var(--line)`, `var(--accent)`, etc. — **do not hardcode
theme-dependent hex** in components (status/agent semantic colors are the exception). Add UI
strings as `t('key')` with the key defined in the `STR` dict; status labels are `t(\`status.${s.status}\`)`.

## Deployment note

**Local-first**: it monitors the agents on the machine it runs on (`~/.claude`, `/proc`, ports)
— it cannot be deployed to a cloud host to watch agents elsewhere. The live instance runs as a
systemd service on the dev VM behind a Caddy `reverse_proxy` vhost (`abtop.xk-dev.com`) +
Cloudflare TLS, and the service must run as the **same user** that owns the agent processes.
Redeploy = `pnpm build` (web/) → `cargo build --release` → install the binary → restart the
service. Host metrics are Linux-only.
