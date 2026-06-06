# abtop-web-ui

**English** · [简体中文](README.zh_CN.md)

**Watch every AI coding agent on your machine, from your browser.**

[![Release](https://img.shields.io/github/v/release/XKHoshizora/abtop-web-ui)](https://github.com/XKHoshizora/abtop-web-ui/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platforms](https://img.shields.io/badge/platforms-Linux%20%7C%20macOS-informational)

A local-first **web UI** for [abtop](https://github.com/graykode/abtop) — every
Claude Code, Codex CLI, and OpenCode session in one live dashboard: status, tokens,
context, rate limits, child processes, open ports, MCP servers and git state,
streamed in real time behind a real login page.

It **does not reimplement any scanning.** It reuses abtop's data-collection layer
in-process (via the `abtop` library), runs the same collector loop headless, and
serves the snapshot as JSON + Server-Sent Events behind a React / Ant Design SPA
that is embedded into the binary. The abtop TUI is untouched.

## Features

- **Live by default** — Server-Sent Events push updates as they happen, with an
  automatic polling fallback; session cards animate in and out with spring physics.
- **Every session at a glance** — cards show status (pulsing Thinking / Executing /
  Waiting / RateLimited / Done dots), agent CLI, model & effort, project, current
  task, git branch (`+added` / `~modified`), memory, uptime and turn count.
- **Click any card for the full story** — a detail drawer with a token-composition
  bar (input / output / cache-write / cache-read), token & context sparklines, a
  copyable session id, cwd, config root, child processes, subagents, a tool-call
  timeline, and the recent chat tail.
- **Context & token pressure** — animated context-fill bars (cyan → red), a live
  tokens/second rate, and per-session compaction counts.
- **Account rate limits** — Claude 5-hour and 7-day windows as fill bars with reset
  countdowns (needs `abtop --setup`).
- **Host vitals** — CPU %, memory % and 1-minute load in the header (Linux only).
- **Open & orphan ports** — ports left listening by sessions that have ended, with
  PID, command and project.
- **MCP servers** — detected MCP servers with parent CLI, profile and rollout activity.
- **A real login page** — username + password with a cookie session, not a browser
  Basic-auth dialog. Auth is off by default on localhost.
- **Bilingual & themed** — English / 中文 and dark / light, toggled from the header
  (and the login page) and remembered locally.
- **One self-contained binary** — the SPA is embedded via `rust-embed`; no Node at
  runtime, no static file server to wire up.

> Want to see it before installing anything? `abtop-web-ui --demo` serves abtop's
> built-in demo fixture, so the whole dashboard is populated without any live agents.

## Screenshots

The dashboard ships dark and light themes (English / 中文). Shown below with the
`--demo` fixture — no real session data:

| Dark | Light |
|:----:|:-----:|
| ![Dashboard — dark theme](docs/dashboard-dark.png) | ![Dashboard — light theme](docs/dashboard-light.png) |

Click any session card for a detail drawer — token composition, a token-trend
sparkline, the context bar, full metadata, child processes, subagents, the tool-call
timeline and the recent chat tail:

<p align="center">
  <img src="docs/session-detail.png" alt="Session detail drawer" width="440">
</p>

## Requirements

- **The [`XKHoshizora/abtop`](https://github.com/XKHoshizora/abtop) fork** — not
  upstream `graykode/abtop`. The fork adds the library surface (`App::to_snapshot`,
  `Snapshot`, `tick_no_summaries`) this tool builds on. Prebuilt binaries already
  bundle it; you only need it checked out (as a sibling `../abtop` directory) to
  build from source.
- **Linux** for host CPU / MEM / load vitals (read from `/proc`). macOS binaries run
  fine but without system metrics.
- **`abtop --setup`** *(optional)* to enable Claude rate-limit tracking — it installs
  the status-line hook abtop reads quota from.

## Install (prebuilt binary)

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://raw.githubusercontent.com/XKHoshizora/abtop-web-ui/master/install.sh | sh
```

Downloads the binary for your platform (Linux / macOS, x86_64 / arm64) into
`~/.local/bin` (override with `ABTOP_WEB_UI_BIN`), then:

```bash
abtop-web-ui --open      # serve http://127.0.0.1:8787/ and open it
abtop-web-ui --demo      # explore the demo fixture — no live agents needed
```

Prebuilt binaries are published to
[GitHub Releases](https://github.com/XKHoshizora/abtop-web-ui/releases) by the
release workflow on each `v*` tag. (Windows: build from source.)

## Deploy as a service

`abtop-web-ui deploy` installs a systemd service (Linux). It asks whether you want
**local** or **public** if you don't pass `--local` / `--public`:

```bash
abtop-web-ui deploy --local                          # bind 127.0.0.1 (localhost / SSH tunnel)
abtop-web-ui deploy --public --domain abtop.you.com  # + generated password + Caddy vhost
abtop-web-ui deploy --public --domain abtop.you.com --caddy-append   # also write & reload the vhost
abtop-web-ui deploy --dry-run --public --domain ...  # print the plan, change nothing
```

- **local** binds `127.0.0.1` with no password by default — reach it over an SSH
  tunnel: `ssh -L 8787:localhost:8787 <host>`.
- **public** generates a strong password (stored in `/etc/abtop-web-ui.env`, mode
  600), runs the service on localhost, and prints a Caddy `reverse_proxy` vhost for
  your domain — or appends it to `/etc/caddy/Caddyfile` and reloads with
  `--caddy-append`. Always keep TLS in front (Caddy / Cloudflare); the snapshot
  exposes cwd paths, ports and prompt text.
- Privileged steps use `sudo` unless you are already root. The service runs as the
  user who runs `deploy`, so run it as the **same user whose agents you want to
  monitor** — it needs to read their `~/.claude` and processes.

Other deploy flags: `--port <n>` (default 8787), `--password <pw>`, `--username <u>`
(default `admin`), `--user <u>` (service user), `-y` / `--yes` (non-interactive;
defaults to `--local`). Installs the binary to `/usr/local/bin/abtop-web-ui` and the
unit to `/etc/systemd/system/abtop-web-ui.service`.

## Build from source

The frontend (`web/`, Vite + React + TypeScript + Ant Design) is built to `web/dist`
and **embedded into the Rust binary**, so build it first. You also need the abtop
fork checked out next to this repo:

```bash
git clone https://github.com/XKHoshizora/abtop ../abtop   # the fork, as a sibling dir
cd web && pnpm install && pnpm build      # → web/dist  (must run before cargo)
cd .. && cargo run --release -- --open    # serves http://127.0.0.1:8787/
```

## Development

```bash
cd web && pnpm dev        # Vite hot reload, proxies /api → 127.0.0.1:8791
cargo run -- --port 8791  # in another terminal: the API the dev server proxies to
pnpm typecheck            # tsc --noEmit (the production build does NOT typecheck)
cargo test                # auth / session unit tests live in src/server.rs
```

`pnpm` is provisioned via [mise](https://mise.jdx.dev) here (`mise install`). After
any frontend change, run `pnpm build` before `cargo build` — `rust-embed` bakes
`web/dist` into the binary at compile time, so a stale `dist` ships a stale UI.

## Configuration

| Flag / env | Default | Description |
|------------|---------|-------------|
| `--host <ip>` | `127.0.0.1` | Bind address |
| `--port <n>` | `8787` | Bind port |
| `--interval <secs>` | `2` | Collector refresh interval (min 1) |
| `--open` | – | Open the dashboard in your browser |
| `--demo` | – | Serve abtop's demo fixture (no live agents needed) |
| `--password <pw>` / `ABTOP_WEB_PASSWORD` | – | Require login (`--password` wins) |
| `ABTOP_WEB_USERNAME` | `admin` | Login username |

## How it works

```
abtop (library)                 abtop-web-ui
  App + collectors  ──reused──►  main thread: App::tick_no_summaries() every --interval
  Snapshot DTO                               → serde_json → shared RwLock<String> cache
                                 HTTP threads: GET /            embedded React SPA
                                               GET /api/snapshot JSON (poll)
                                               GET /api/stream   SSE (realtime)
                                               POST /api/login   cookie session
```

- **`abtop::App` is not `Send`** (it owns boxed collector trait objects), so it lives
  on the main collector thread. Each tick serializes one snapshot into a shared
  `Arc<RwLock<String>>`; HTTP handler threads only ever read that string — they never
  touch the `App`. If a tick fails to serialize, the last good snapshot is kept, so
  the feed never blanks.
- The loop runs `tick_no_summaries`, so it **never** spawns `claude --print` and never
  spends your Claude quota. Titles fall back to the raw first prompt.
- Token-rate and orphan-port detection work because the same long-lived `App` is
  reused across ticks — they need cross-tick deltas and history.
- Auth is a **cookie session** with a real login page — no Basic-auth dialog. Without
  `--password`, auth is disabled (the localhost default).
- **Local-first:** it monitors the agents on the machine it runs on (`~/.claude`,
  `/proc`, ports). It can't watch agents on another host — run it where the agents
  are. Rate-limit data needs `abtop --setup`; host vitals are Linux-only.

## Remote access & security

The snapshot is sensitive (cwd paths, ports, PIDs, best-effort-redacted prompt text).
It binds to `127.0.0.1` by default. To expose it, prefer:

1. **SSH tunnel:** `ssh -L 8787:localhost:8787 you@host`
2. **TLS reverse proxy + login** — e.g. Caddy auto-HTTPS in front, with `--password`:
   ```caddy
   abtop.example.com {
       reverse_proxy 127.0.0.1:8787 {
           flush_interval -1   # keep SSE flowing
       }
   }
   ```

A password over plain HTTP is sniffable — always pair `--password` with TLS for
public exposure. Binding to a non-local `--host` without a password prints a warning.

## Related

- [abtop](https://github.com/graykode/abtop) — the upstream TUI this builds on.
- [XKHoshizora/abtop](https://github.com/XKHoshizora/abtop) — the fork that adds the
  library surface (`Snapshot`, `App::to_snapshot`, `tick_no_summaries`) this tool needs.

## License

MIT — see [LICENSE](LICENSE).
