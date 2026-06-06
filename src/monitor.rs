//! The collector loop: owns the abtop `App`, ticks it on an interval, and
//! publishes a serialized snapshot for the HTTP layer to read.
//!
//! `App` is intentionally NOT shared behind a mutex. It is not `Send` (it holds
//! boxed `AgentCollector` trait objects), so it stays on the thread that
//! created it. HTTP handlers never touch the `App` — they only read the JSON
//! string this loop writes into the shared [`SnapshotCache`]. This cleanly
//! separates the (blocking, stateful) collection cadence from request handling.

use abtop::app::App;
use std::sync::{Arc, RwLock};
use std::time::Duration;

/// Latest serialized snapshot JSON, shared read-only with HTTP handlers.
pub type SnapshotCache = Arc<RwLock<String>>;

/// Run the abtop collector loop forever on the CURRENT thread.
///
/// Each iteration ticks WITHOUT summaries (so it never shells out to
/// `claude --print` or spends the user's Claude quota), serializes the
/// snapshot, and stores it in `cache`. Because the same long-running `App`
/// is reused across ticks, cross-tick state — token-rate deltas and
/// orphan-port detection — is populated natively.
///
/// When `demo` is true, the App is filled once with abtop's demo fixture and
/// never ticked, so the dashboard can be evaluated without any live agents.
/// The snapshot is still re-serialized each interval so timestamps advance and
/// the SSE stream keeps flowing.
pub fn run(mut app: App, cache: SnapshotCache, interval: Duration, demo: bool) -> ! {
    if demo {
        abtop::demo::populate_demo(&mut app);
    }
    let interval_ms = interval.as_millis() as u64;
    loop {
        if !demo {
            app.tick_no_summaries();
        }
        // On a serialization failure (e.g. a non-finite f64 sneaking into the
        // model), keep the last good snapshot rather than blanking the whole
        // feed with an error object.
        match serde_json::to_string(&app.to_snapshot(interval_ms)) {
            Ok(json) => {
                if let Ok(mut slot) = cache.write() {
                    *slot = json;
                }
            }
            Err(e) => eprintln!("abtop-web-ui: snapshot serialize failed: {}", e),
        }
        std::thread::sleep(interval);
    }
}
