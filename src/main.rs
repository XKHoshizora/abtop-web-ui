//! abtop-web-ui — a local-first web view of the abtop AI-agent monitor.
//!
//! Runs abtop's data collectors in-process (reusing the `abtop` library) and
//! serves a small dashboard over HTTP. Defaults to binding 127.0.0.1.

mod deploy;
mod monitor;
mod server;

use std::sync::{Arc, RwLock};
use std::time::Duration;

const DEFAULT_HOST: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 8787;
const DEFAULT_INTERVAL_SECS: u64 = 2;

struct Args {
    host: String,
    port: u16,
    interval: u64,
    open: bool,
    password: Option<String>,
    demo: bool,
}

fn parse_args() -> Args {
    let mut host = DEFAULT_HOST.to_string();
    let mut port = DEFAULT_PORT;
    let mut interval = DEFAULT_INTERVAL_SECS;
    let mut open = false;
    let mut demo = false;
    // Env default; --password overrides it.
    let mut password = std::env::var("ABTOP_WEB_PASSWORD")
        .ok()
        .filter(|s| !s.is_empty());

    let mut it = std::env::args().skip(1);
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--host" => {
                if let Some(v) = it.next() {
                    host = v;
                }
            }
            "--port" => {
                if let Some(v) = it.next().and_then(|v| v.parse().ok()) {
                    port = v;
                }
            }
            "--interval" => {
                if let Some(v) = it.next().and_then(|v| v.parse::<u64>().ok()) {
                    interval = v.max(1);
                }
            }
            "--open" => open = true,
            "--demo" => demo = true,
            "--password" => {
                if let Some(v) = it.next() {
                    password = Some(v).filter(|s| !s.is_empty());
                }
            }
            "-h" | "--help" => {
                print_help();
                std::process::exit(0);
            }
            "-V" | "--version" => {
                print_version();
                std::process::exit(0);
            }
            other => {
                eprintln!("abtop-web-ui: unknown argument '{}'", other);
                print_help();
                std::process::exit(2);
            }
        }
    }

    Args {
        host,
        port,
        interval,
        open,
        password,
        demo,
    }
}

fn print_version() {
    println!("abtop-web-ui {}", env!("CARGO_PKG_VERSION"));
}

fn print_help() {
    println!(
        "abtop-web-ui {ver} — local web UI for abtop\n\n\
         USAGE:\n  abtop-web-ui [--host <ip>] [--port <n>] [--interval <secs>] [--open]\n  \
         abtop-web-ui deploy [--local | --public --domain <host>]   (install a systemd service)\n  \
         abtop-web-ui uninstall                                     (remove the systemd service)\n\n\
         OPTIONS:\n  \
         --host <ip>        Bind address (default {host})\n  \
         --port <n>         Bind port (default {port})\n  \
         --interval <secs>  Collector refresh interval (default {interval}s, min 1)\n  \
         --open             Open the dashboard in your browser\n  \
         --demo             Serve abtop's demo fixture (no live agents needed)\n  \
         --password <pw>    Require login (or ABTOP_WEB_PASSWORD; user via\n                     \
         ABTOP_WEB_USERNAME, default 'admin')\n  \
         -h, --help         Show this help\n  \
         -V, --version      Show version\n\n\
         The dashboard binds to localhost by default. For remote access, prefer\n\
         an SSH tunnel or a TLS-terminating reverse proxy — the snapshot exposes\n\
         working directories, ports and (best-effort redacted) prompt text.\n\
         A password over plain HTTP is sniffable; always pair it with TLS.",
        ver = env!("CARGO_PKG_VERSION"),
        host = DEFAULT_HOST,
        port = DEFAULT_PORT,
        interval = DEFAULT_INTERVAL_SECS,
    );
}

fn open_browser(url: &str) {
    let opener = if cfg!(target_os = "macos") {
        "open"
    } else if cfg!(target_os = "windows") {
        "explorer"
    } else {
        "xdg-open"
    };
    let _ = std::process::Command::new(opener).arg(url).spawn();
}

fn main() {
    // `deploy` is a subcommand with its own argument parser; `version` is a
    // friendly alias for the `-V` / `--version` flags handled in parse_args.
    let argv: Vec<String> = std::env::args().collect();
    match argv.get(1).map(String::as_str) {
        Some("deploy") => {
            deploy::run(&argv[2..]);
            return;
        }
        Some("uninstall") => {
            deploy::uninstall(&argv[2..]);
            return;
        }
        Some("version" | "-V" | "--version") => {
            print_version();
            return;
        }
        _ => {}
    }

    let args = parse_args();

    // Build the abtop App headless, reusing its config + collectors.
    let cfg = abtop::config::load_config();
    let app = abtop::app::App::new_with_config_and_claude_dirs(
        abtop::theme::Theme::default(),
        &cfg.hidden_agents,
        cfg.panels,
        &cfg.claude_config_dirs,
    );

    let cache: monitor::SnapshotCache = Arc::new(RwLock::new("{}".to_string()));

    let addr = format!("{}:{}", args.host, args.port);
    let server = match tiny_http::Server::http(addr.as_str()) {
        Ok(s) => Arc::new(s),
        Err(e) => {
            eprintln!("abtop-web-ui: failed to bind {}: {}", addr, e);
            std::process::exit(1);
        }
    };

    // Username defaults to "admin"; password from --password / ABTOP_WEB_PASSWORD.
    // No password → auth disabled (the localhost default).
    let username = std::env::var("ABTOP_WEB_USERNAME").ok().filter(|s| !s.is_empty());
    let auth = Arc::new(server::AuthState::new(username, args.password));

    let is_local = matches!(args.host.as_str(), "127.0.0.1" | "localhost" | "::1");
    if !is_local && !auth.required() {
        eprintln!(
            "WARNING: bound to {} with NO password. The snapshot exposes cwd paths, ports,\n         \
             PIDs and (best-effort redacted) prompt text. Prefer an SSH tunnel, or set\n         \
             --password and put TLS in front (e.g. a Caddy reverse proxy).",
            args.host
        );
    }

    let url = format!("http://{}/", addr);
    eprintln!(
        "abtop-web-ui serving {}  (auth: {}{})  (Ctrl-C to stop)",
        url,
        if auth.required() { "on" } else { "off" },
        if args.demo { ", demo data" } else { "" }
    );
    if args.open {
        open_browser(&url);
    }

    // HTTP on background threads; the collector loop owns the main thread
    // (App is not Send and must stay where it was created).
    let interval = Duration::from_secs(args.interval);
    server::spawn(server, cache.clone(), interval, auth);
    monitor::run(app, cache, interval, args.demo);
}
