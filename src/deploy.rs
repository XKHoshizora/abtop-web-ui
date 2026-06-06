//! `abtop-web-ui deploy` — one-shot install of a systemd service (Linux), in
//! either local-only or public mode. Local binds 127.0.0.1 with optional auth;
//! public requires a password (generated if absent) and prints (or appends) a
//! Caddy reverse-proxy vhost. Privileged steps go through `sudo` unless already
//! root; `--dry-run` prints the plan and changes nothing.

use std::io::{self, IsTerminal, Write};
use std::process::{Command, Stdio};

const BIN_PATH: &str = "/usr/local/bin/abtop-web-ui";
const ENV_PATH: &str = "/etc/abtop-web-ui.env";
const UNIT_PATH: &str = "/etc/systemd/system/abtop-web-ui.service";
const CADDYFILE: &str = "/etc/caddy/Caddyfile";
const DEFAULT_PORT: u16 = 8787;

struct Opts {
    public: Option<bool>, // None = ask
    domain: Option<String>,
    port: u16,
    password: Option<String>,
    username: Option<String>,
    run_as: Option<String>,
    caddy_append: bool,
    dry_run: bool,
    yes: bool,
}

pub fn run(args: &[String]) {
    if !cfg!(target_os = "linux") {
        eprintln!("`deploy` installs a systemd service and is Linux-only. On other");
        eprintln!("platforms, run `abtop-web-ui --password <pw>` behind your own supervisor.");
        std::process::exit(1);
    }

    let opts = match parse(args) {
        Ok(o) => o,
        Err(e) => {
            eprintln!("{e}\n");
            print_help();
            std::process::exit(2);
        }
    };

    // Resolve mode: --public / --local, else prompt (TTY) or default to local.
    let public = match opts.public {
        Some(p) => p,
        None if opts.yes || !io::stdin().is_terminal() => false,
        None => prompt("Expose to the public internet (needs a domain + reverse proxy)? [y/N] ")
            .eq_ignore_ascii_case("y"),
    };

    let port = opts.port;
    let run_as = opts.run_as.clone().unwrap_or_else(default_user);

    // Domain + password.
    let domain = if public {
        match opts.domain.clone() {
            Some(d) => d,
            None if io::stdin().is_terminal() && !opts.yes => prompt("Public domain (e.g. abtop.example.com): "),
            None => {
                eprintln!("public mode needs --domain <host> for the reverse-proxy vhost.");
                std::process::exit(2);
            }
        }
    } else {
        String::new()
    };
    let password = match (&opts.password, public) {
        (Some(p), _) => Some(p.clone()),
        (None, true) => Some(gen_password()), // public must be protected
        (None, false) => None,                // local default: open on localhost
    };

    let root = is_root();
    let plan = Plan { port, run_as, domain, password, username: opts.username.clone() };

    eprintln!("\nabtop-web-ui deploy — {} mode\n", if public { "PUBLIC" } else { "LOCAL" });

    // 1. Install the binary to a stable path.
    install_self(opts.dry_run, root);
    // 2. Credentials env file (only when a password is set).
    if let Some(pw) = &plan.password {
        let mut env = String::new();
        if let Some(u) = &plan.username {
            env.push_str(&format!("ABTOP_WEB_USERNAME={u}\n"));
        }
        env.push_str(&format!("ABTOP_WEB_PASSWORD={pw}\n"));
        write_root(ENV_PATH, &env, "600", opts.dry_run, root);
    } else {
        // Local + no password: drop any stale env file so auth stays disabled.
        run_root(&["rm", "-f", ENV_PATH], opts.dry_run, root);
    }
    // 3. systemd unit.
    write_root(UNIT_PATH, &unit_file(&plan), "644", opts.dry_run, root);
    // 4. enable + start.
    run_root(&["systemctl", "daemon-reload"], opts.dry_run, root);
    run_root(&["systemctl", "enable", "--now", "abtop-web-ui"], opts.dry_run, root);

    // 5. Public: the reverse-proxy vhost.
    if public {
        let snippet = caddy_vhost(&plan);
        if opts.caddy_append {
            append_caddy(&snippet, opts.dry_run, root);
        }
        print_public_next_steps(&plan, &snippet, opts.caddy_append);
    } else {
        print_local_next_steps(&plan);
    }
}

struct Plan {
    port: u16,
    run_as: String,
    domain: String,
    password: Option<String>,
    username: Option<String>,
}

fn unit_file(p: &Plan) -> String {
    let env_line = if p.password.is_some() {
        format!("EnvironmentFile={ENV_PATH}\n")
    } else {
        String::new()
    };
    format!(
        "[Unit]\n\
         Description=abtop-web-ui (AI-agent monitor web UI)\n\
         After=network.target\n\n\
         [Service]\n\
         Type=simple\n\
         User={user}\n\
         {env_line}\
         ExecStart={bin} --host 127.0.0.1 --port {port}\n\
         Restart=on-failure\n\
         RestartSec=3\n\n\
         [Install]\n\
         WantedBy=multi-user.target\n",
        user = p.run_as,
        bin = BIN_PATH,
        port = p.port,
    )
}

fn caddy_vhost(p: &Plan) -> String {
    format!(
        "{domain} {{\n\treverse_proxy 127.0.0.1:{port} {{\n\t\tflush_interval -1\n\t}}\n}}\n",
        domain = p.domain,
        port = p.port,
    )
}

// --- privileged helpers (respect dry-run + already-root) ---

fn is_root() -> bool {
    Command::new("id")
        .arg("-u")
        .output()
        .ok()
        .map(|o| o.stdout.starts_with(b"0"))
        .unwrap_or(false)
}

fn default_user() -> String {
    // The deploy is typically run with sudo; the *real* user is who owns ~/.claude.
    std::env::var("SUDO_USER")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "root".to_string())
}

fn install_self(dry: bool, root: bool) {
    let exe = std::env::current_exe().unwrap_or_default();
    if exe.to_string_lossy() == BIN_PATH {
        return; // already in place
    }
    let src = exe.to_string_lossy().to_string();
    run_root(&["install", "-m", "0755", &src, BIN_PATH], dry, root);
}

fn write_root(path: &str, content: &str, mode: &str, dry: bool, root: bool) {
    if dry {
        println!("# write {path} (chmod {mode}):\n{content}");
        return;
    }
    let mut cmd = if root {
        Command::new("tee")
    } else {
        let mut c = Command::new("sudo");
        c.arg("tee");
        c
    };
    cmd.arg(path).stdin(Stdio::piped()).stdout(Stdio::null());
    match cmd.spawn() {
        Ok(mut child) => {
            if let Some(mut stdin) = child.stdin.take() {
                let _ = stdin.write_all(content.as_bytes());
            }
            let _ = child.wait();
        }
        Err(e) => eprintln!("failed to write {path}: {e}"),
    }
    run_root(&["chmod", mode, path], false, root);
    eprintln!("  wrote {path}");
}

fn run_root(args: &[&str], dry: bool, root: bool) {
    if dry {
        println!("# {}{}", if root { "" } else { "sudo " }, args.join(" "));
        return;
    }
    let status = if root {
        Command::new(args[0]).args(&args[1..]).status()
    } else {
        Command::new("sudo").args(args).status()
    };
    match status {
        Ok(s) if s.success() => {}
        Ok(s) => eprintln!("  `{}` exited with {}", args.join(" "), s),
        Err(e) => eprintln!("  `{}` failed: {}", args.join(" "), e),
    }
}

fn append_caddy(snippet: &str, dry: bool, root: bool) {
    // Back up, then append the vhost and reload.
    let backup = format!("{CADDYFILE}.bak-abtop-deploy");
    run_root(&["cp", CADDYFILE, &backup], dry, root);
    if dry {
        println!("# append to {CADDYFILE}:\n{snippet}");
        println!("# sudo systemctl reload caddy");
        return;
    }
    // `tee -a` to append.
    let mut cmd = if root {
        Command::new("tee")
    } else {
        let mut c = Command::new("sudo");
        c.arg("tee");
        c
    };
    cmd.args(["-a", CADDYFILE]).stdin(Stdio::piped()).stdout(Stdio::null());
    if let Ok(mut child) = cmd.spawn() {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(format!("\n{snippet}").as_bytes());
        }
        let _ = child.wait();
    }
    run_root(&["systemctl", "reload", "caddy"], false, root);
    eprintln!("  appended vhost to {CADDYFILE} (backup: {backup}) and reloaded Caddy");
}

// --- output ---

fn print_local_next_steps(p: &Plan) {
    eprintln!("\n✓ Local service running on http://127.0.0.1:{}/", p.port);
    eprintln!("  systemctl status abtop-web-ui   ·   journalctl -u abtop-web-ui -f");
    if p.password.is_none() {
        eprintln!("  (no password — localhost only. Remote: ssh -L {0}:localhost:{0} <host>)", p.port);
    } else {
        eprintln!("  login user: {}  ·  password in {ENV_PATH}", p.username.as_deref().unwrap_or("admin"));
    }
    eprintln!("\n  For Claude rate-limit data, also run: abtop --setup");
}

fn print_public_next_steps(p: &Plan, snippet: &str, appended: bool) {
    eprintln!("\n✓ Service running on http://127.0.0.1:{}/ (behind the proxy)", p.port);
    eprintln!("  login user: {}", p.username.as_deref().unwrap_or("admin"));
    if let Some(pw) = &p.password {
        eprintln!("  password:   {pw}");
        eprintln!("  (stored in {ENV_PATH}; rotate by editing it + `systemctl restart abtop-web-ui`)");
    }
    if !appended {
        eprintln!("\n  Add this vhost to your reverse proxy (Caddy), then reload it:\n");
        for line in snippet.lines() {
            eprintln!("    {line}");
        }
        eprintln!("\n  (or re-run with --caddy-append to do it automatically)");
    }
    eprintln!("\n  ⚠ The snapshot exposes cwd paths, ports and prompt text — keep TLS on");
    eprintln!("    (Caddy/Cloudflare) and the password set. URL: https://{}/", p.domain);
    eprintln!("\n  For Claude rate-limit data, also run: abtop --setup");
}

// --- helpers ---

fn gen_password() -> String {
    // Unambiguous base-58-ish charset; 20 chars ≈ 117 bits.
    const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let mut buf = [0u8; 20];
    getrandom::getrandom(&mut buf).expect("OS RNG");
    buf.iter().map(|b| CHARSET[(*b as usize) % CHARSET.len()] as char).collect()
}

fn prompt(q: &str) -> String {
    print!("{q}");
    let _ = io::stdout().flush();
    let mut s = String::new();
    let _ = io::stdin().read_line(&mut s);
    s.trim().to_string()
}

fn parse(args: &[String]) -> Result<Opts, String> {
    let mut o = Opts {
        public: None,
        domain: None,
        port: DEFAULT_PORT,
        password: None,
        username: None,
        run_as: None,
        caddy_append: false,
        dry_run: false,
        yes: false,
    };
    let mut it = args.iter();
    while let Some(a) = it.next() {
        match a.as_str() {
            "--public" => o.public = Some(true),
            "--local" => o.public = Some(false),
            "--caddy-append" => o.caddy_append = true,
            "--dry-run" => o.dry_run = true,
            "-y" | "--yes" => o.yes = true,
            "-h" | "--help" => {
                print_help();
                std::process::exit(0);
            }
            "-V" | "--version" => {
                crate::print_version();
                std::process::exit(0);
            }
            "--domain" => o.domain = it.next().cloned(),
            "--password" => o.password = it.next().cloned().filter(|s| !s.is_empty()),
            "--username" => o.username = it.next().cloned().filter(|s| !s.is_empty()),
            "--user" => o.run_as = it.next().cloned().filter(|s| !s.is_empty()),
            "--port" => {
                o.port = it
                    .next()
                    .and_then(|v| v.parse().ok())
                    .ok_or("--port needs a number")?;
            }
            other => return Err(format!("unknown deploy argument '{other}'")),
        }
    }
    Ok(o)
}

fn print_help() {
    println!(
        "abtop-web-ui deploy — install a systemd service (Linux)\n\n\
         USAGE:\n  abtop-web-ui deploy [--local | --public --domain <host>] [options]\n\n\
         MODE:\n  \
         --local            bind 127.0.0.1 only (localhost / SSH-tunnel use)\n  \
         --public           expose via a reverse proxy (requires --domain; sets a password)\n  \
         (omit both to be asked interactively)\n\n\
         OPTIONS:\n  \
         --domain <host>    public hostname for the Caddy vhost\n  \
         --port <n>         service port (default 8787)\n  \
         --password <pw>    auth password (public: generated if omitted; local: optional)\n  \
         --username <u>     login username (default admin)\n  \
         --user <u>         run the service as this user (default: the invoking user)\n  \
         --caddy-append     back up + append the vhost to /etc/caddy/Caddyfile and reload\n  \
         --dry-run          print everything it would do, change nothing\n  \
         -y, --yes          non-interactive (defaults to --local if mode unset)\n\n\
         Privileged steps use sudo unless already root. For Claude rate-limit data,\n\
         also run `abtop --setup`."
    );
}

// --- uninstall (the inverse of `deploy`) ---

struct UninstallOpts {
    keep_bin: bool,
    dry_run: bool,
    yes: bool,
}

/// `abtop-web-ui uninstall` — stop + disable the service, remove the unit,
/// credentials and (unless --keep-bin) the binary. Caddy is left untouched — we
/// only point at the vhost to remove. Linux-only, like `deploy`.
pub fn uninstall(args: &[String]) {
    if !cfg!(target_os = "linux") {
        eprintln!("`uninstall` removes a systemd service and is Linux-only. On other");
        eprintln!("platforms just delete the binary, e.g.:");
        eprintln!("  rm -f {BIN_PATH} ~/.local/bin/abtop-web-ui");
        std::process::exit(1);
    }

    let o = match parse_uninstall(args) {
        Ok(o) => o,
        Err(e) => {
            eprintln!("{e}\n");
            print_uninstall_help();
            std::process::exit(2);
        }
    };

    let root = is_root();
    // The deploy copy lives at BIN_PATH; the running exe may be a second copy
    // (e.g. ~/.local/bin from install.sh) — remove that too.
    let exe = std::env::current_exe().ok().map(|p| p.to_string_lossy().into_owned());

    eprintln!("\nabtop-web-ui uninstall\n");
    eprintln!("This will:");
    eprintln!("  • stop + disable the systemd service abtop-web-ui");
    eprintln!("  • remove {UNIT_PATH}  (+ systemctl daemon-reload)");
    eprintln!("  • remove {ENV_PATH}  (credentials, if present)");
    if o.keep_bin {
        eprintln!("  • keep the binary (--keep-bin)");
    } else {
        eprintln!("  • remove the binary at {BIN_PATH}");
        if let Some(e) = exe.as_deref() {
            if e != BIN_PATH {
                eprintln!("    and this running binary: {e}");
            }
        }
    }
    eprintln!();

    if !o.dry_run && !o.yes && io::stdin().is_terminal() && !prompt("Continue? [y/N] ").eq_ignore_ascii_case("y") {
        eprintln!("aborted.");
        return;
    }

    // 1. stop + disable, clear any failed state (best-effort; ignores "not loaded").
    run_root(&["systemctl", "disable", "--now", "abtop-web-ui"], o.dry_run, root);
    run_root(&["systemctl", "reset-failed", "abtop-web-ui"], o.dry_run, root);
    // 2. unit, then reload.
    run_root(&["rm", "-f", UNIT_PATH], o.dry_run, root);
    run_root(&["systemctl", "daemon-reload"], o.dry_run, root);
    // 3. credentials.
    run_root(&["rm", "-f", ENV_PATH], o.dry_run, root);
    // 4. binaries: the deploy copy, plus this running exe if it is a different file.
    if !o.keep_bin {
        run_root(&["rm", "-f", BIN_PATH], o.dry_run, root);
        if let Some(e) = exe.as_deref() {
            if e != BIN_PATH {
                run_root(&["rm", "-f", e], o.dry_run, root);
            }
        }
    }

    // 5. Caddy: detect (a leftover deploy backup is the reliable signal), never edit.
    if std::path::Path::new(&format!("{CADDYFILE}.bak-abtop-deploy")).exists() {
        eprintln!("\n  ⚠ You exposed abtop-web-ui publicly with `deploy --caddy-append`.");
        eprintln!("    uninstall does NOT edit your Caddyfile — remove the abtop vhost");
        eprintln!("    (a `reverse_proxy 127.0.0.1:<port>` block) from {CADDYFILE}, then:");
        eprintln!("      sudo systemctl reload caddy");
        eprintln!("    A pre-append backup is at {CADDYFILE}.bak-abtop-deploy");
    }

    if o.dry_run {
        eprintln!("\n(dry run — nothing changed)");
    } else {
        eprintln!("\n✓ abtop-web-ui uninstalled.");
        if o.keep_bin {
            eprintln!("  (binary kept — remove later with: sudo rm -f {BIN_PATH}; rm -f ~/.local/bin/abtop-web-ui)");
        }
    }
}

fn parse_uninstall(args: &[String]) -> Result<UninstallOpts, String> {
    let mut o = UninstallOpts { keep_bin: false, dry_run: false, yes: false };
    for a in args {
        match a.as_str() {
            "--keep-bin" => o.keep_bin = true,
            "--dry-run" => o.dry_run = true,
            "-y" | "--yes" => o.yes = true,
            "-h" | "--help" => {
                print_uninstall_help();
                std::process::exit(0);
            }
            "-V" | "--version" => {
                crate::print_version();
                std::process::exit(0);
            }
            other => return Err(format!("unknown uninstall argument '{other}'")),
        }
    }
    Ok(o)
}

fn print_uninstall_help() {
    println!(
        "abtop-web-ui uninstall — remove the systemd service (Linux)\n\n\
         USAGE:\n  abtop-web-ui uninstall [--keep-bin] [--dry-run] [-y]\n\n\
         Stops and disables the service, removes the unit ({UNIT_PATH}), runs\n\
         `systemctl daemon-reload`, deletes the credentials file ({ENV_PATH}) and —\n\
         unless --keep-bin — the binary at {BIN_PATH} (and this running executable).\n\n\
         OPTIONS:\n  \
         --keep-bin   keep the installed binary; only remove the service\n  \
         --dry-run    print everything it would do, change nothing\n  \
         -y, --yes    non-interactive (skip the confirmation prompt)\n\n\
         Privileged steps use sudo unless already root. If you used\n\
         `deploy --caddy-append`, remove the abtop vhost from /etc/caddy/Caddyfile\n\
         yourself and reload Caddy — uninstall won't touch it."
    );
}
