# abtop-web-ui

A local-first **web UI** for [abtop](https://github.com/graykode/abtop) — see every
Claude Code / Codex / OpenCode session, token & context usage, rate limits, open
ports, child processes and git state in your browser, with a real login page and
live updates.

It does **not** reimplement any scanning. It reuses abtop's data-collection layer
in-process (via the `abtop` library), runs the same collector loop headless, and
serves the snapshot as JSON + Server-Sent Events behind a React / Ant Design SPA.
The abtop TUI is untouched.

> Requires the [`XKHoshizora/abtop`](https://github.com/XKHoshizora/abtop) fork,
> which adds the library surface (`App::to_snapshot`, `Snapshot`,
> `tick_no_summaries`) this tool consumes.

## Install (prebuilt binary)

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://raw.githubusercontent.com/XKHoshizora/abtop-web-ui/master/install.sh | sh
```

Downloads the binary for your platform (Linux/macOS, x86_64/arm64) into
`~/.local/bin` (override with `ABTOP_WEB_UI_BIN`). Prebuilt binaries are published
to [GitHub Releases](https://github.com/XKHoshizora/abtop-web-ui/releases) by the
release workflow on each `v*` tag. (Windows: build from source.)

## Deploy as a service

`abtop-web-ui deploy` installs a systemd service (Linux) in your choice of mode —
it asks if you don't pass `--local` / `--public`:

```bash
abtop-web-ui deploy --local                          # bind 127.0.0.1 (localhost / SSH tunnel)
abtop-web-ui deploy --public --domain abtop.you.com  # + generated password + Caddy vhost
abtop-web-ui deploy --public --domain abtop.you.com --caddy-append   # also writes the vhost
abtop-web-ui deploy --dry-run --public --domain ...  # print the plan, change nothing
```

- **local** binds `127.0.0.1` with no password by default (reach it over an SSH
  tunnel: `ssh -L 8787:localhost:8787 <host>`).
- **public** generates a strong password (stored in `/etc/abtop-web-ui.env`),
  runs the service on localhost, and prints a Caddy `reverse_proxy` vhost for your
  domain (or appends + reloads it with `--caddy-append`). Always keep TLS in front
  (Caddy/Cloudflare) — the snapshot exposes cwd paths, ports and prompt text.
- Privileged steps use `sudo` unless already root. The service runs as the invoking
  user so it can read `~/.claude` and that user's agent processes. For Claude
  rate-limit data, also run `abtop --setup`.

## Build & run

The frontend (`web/`, Vite + React + TS + Ant Design) is built to `web/dist` and
**embedded into the Rust binary**, so build it first:

```bash
cd web && pnpm install && pnpm build     # → web/dist
cd .. && cargo run --release -- --open   # serves http://127.0.0.1:8787/
```

| Flag / env | Default | Description |
|------------|---------|-------------|
| `--host <ip>` | `127.0.0.1` | Bind address |
| `--port <n>` | `8787` | Bind port |
| `--interval <secs>` | `2` | Collector refresh interval (min 1) |
| `--open` | – | Open the dashboard in your browser |
| `--demo` | – | Serve abtop's demo fixture (no live agents needed) |
| `--password <pw>` / `ABTOP_WEB_PASSWORD` | – | Require login |
| `ABTOP_WEB_USERNAME` | `admin` | Login username |

Frontend dev loop: `cd web && pnpm dev` (hot reload, proxies `/api` → `127.0.0.1:8791`)
while a Rust server runs separately.

## How it works

```
abtop (library)                 abtop-web-ui
  App + collectors  ──reused──►  main thread: App::tick_no_summaries() every 2s
  Snapshot DTO                                → serde_json → shared cache
                                 HTTP threads: GET /            embedded React SPA
                                               GET /api/snapshot JSON (poll)
                                               GET /api/stream   SSE (realtime)
                                               POST /api/login   cookie session
```

- The loop runs `tick_no_summaries`, so it **never** spawns `claude --print` and
  never spends your Claude quota. Titles fall back to the raw first prompt.
- Token-rate and orphan-port detection work natively because the same long-running
  `App` is reused across ticks.
- Auth is a **cookie session** with a real login page — no browser Basic-auth dialog.
  Without `--password`, auth is disabled (localhost default).
- Rate-limit data needs `abtop --setup` (the status-line hook). Host vitals are Linux-only.

## Remote access & security

The snapshot is sensitive (cwd paths, ports, PIDs, best-effort-redacted prompt text).
It binds to `127.0.0.1` by default. To expose it, prefer:

1. **SSH tunnel**: `ssh -L 8787:localhost:8787 you@host`
2. **TLS reverse proxy + login** — e.g. Caddy auto-HTTPS in front, with `--password`:
   ```caddy
   abtop.example.com {
       reverse_proxy 127.0.0.1:8787 {
           flush_interval -1   # keep SSE flowing
       }
   }
   ```

A password over plain HTTP is sniffable — always pair `--password` with TLS for public
exposure. Binding to a non-local `--host` without a password prints a warning.

## License

MIT.
