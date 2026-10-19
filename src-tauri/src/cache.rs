//! Roblox asset-cache clearing, plus a watcher that notices when Roblox
//! exits so the cache can be cleared again.
//!
//! Why this exists: Roblox caches downloaded assets in
//! `%LOCALAPPDATA%\Roblox\rbx-storage*` (a SQLite db plus a folder of
//! hashed files). Anything that changes what an asset *is* (mods now,
//! asset replacement later) only takes effect if the old cached copy is
//! gone, so the cache has to be deleted while Roblox is NOT running.

use std::fs;
use std::path::Path;
use std::time::Duration;

use serde::Serialize;
use sysinfo::System;

use crate::paths::roblox_local_dir;
use crate::settings::get_settings;

const PLAYER_EXE: &str = "RobloxPlayerBeta.exe";

/// Only entries whose name starts with this are ever touched, so nothing
/// else under %LOCALAPPDATA%\Roblox (Versions, logs, ...) can be deleted.
const CACHE_PREFIX: &str = "rbx-storage";

#[derive(Serialize)]
pub struct CacheClearResult {
    pub removed: usize,
    pub bytes_freed: u64,
}

pub(crate) fn is_roblox_running(sys: &mut System) -> bool {
    sys.refresh_all();
    sys.processes_by_name(std::ffi::OsStr::new(PLAYER_EXE))
        .next()
        .is_some()
}

fn dir_size(dir: &Path) -> u64 {
    let Ok(entries) = fs::read_dir(dir) else { return 0 };
    entries
        .filter_map(|e| e.ok())
        .map(|e| {
            let path = e.path();
            if path.is_dir() {
                dir_size(&path)
            } else {
                path.metadata().map(|m| m.len()).unwrap_or(0)
            }
        })
        .sum()
}

/// Deletes every `rbx-storage*` entry (db, -wal/-shm/-journal sidecars and
/// the hashed-file folder) under %LOCALAPPDATA%\Roblox. Does NOT check
/// whether Roblox is running — callers do that.
pub(crate) fn clear_cache_files() -> Result<CacheClearResult, String> {
    let dir = roblox_local_dir()?;
    if !dir.is_dir() {
        return Ok(CacheClearResult { removed: 0, bytes_freed: 0 });
    }

    let mut removed = 0;
    let mut bytes_freed = 0;

    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        let is_cache = path
            .file_name()
            .map(|n| n.to_string_lossy().to_lowercase().starts_with(CACHE_PREFIX))
            .unwrap_or(false);
        if !is_cache {
            continue;
        }

        if path.is_dir() {
            bytes_freed += dir_size(&path);
            fs::remove_dir_all(&path)
                .map_err(|e| format!("Couldn't delete {}: {e}", path.display()))?;
        } else {
            bytes_freed += path.metadata().map(|m| m.len()).unwrap_or(0);
            fs::remove_file(&path)
                .map_err(|e| format!("Couldn't delete {}: {e}", path.display()))?;
        }
        removed += 1;
    }

    Ok(CacheClearResult { removed, bytes_freed })
}

/// Clears the cache unless Roblox is currently running (deleting under a
/// live client would just fail on locked files, or corrupt its cache).
pub(crate) fn clear_if_idle() -> Result<CacheClearResult, String> {
    let mut sys = System::new();
    if is_roblox_running(&mut sys) {
        return Err("Roblox is running — close it first, then clear the cache.".to_string());
    }
    clear_cache_files()
}

/// Settings -> "Clear cache now".
#[tauri::command]
pub fn clear_roblox_cache() -> Result<CacheClearResult, String> {
    clear_if_idle()
}

/// Appends one line to %LOCALAPPDATA%\Dusk\state\watcher.log. Only state
/// changes and removal attempts are logged, so the file stays tiny. Used to
/// diagnose "did Dusk notice Roblox exit?" without guessing.
fn log(line: &str) {
    use std::io::Write;
    let Ok(dir) = crate::paths::dusk_state_dir() else { return };
    let Ok(mut file) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("watcher.log"))
    else {
        return;
    };
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let _ = writeln!(file, "[{secs}] {line}");
}

/// Background thread: when RobloxPlayerBeta.exe goes from running to gone,
/// remove Dusk's CA from Roblox and (if "clear on exit" is on) delete the
/// cache. Roblox can hold files open for a moment after the process
/// disappears, so both steps retry a few times.
pub(crate) fn run_exit_watcher() {
    let mut sys = System::new();
    let mut was_running = false;
    log("watcher started");

    loop {
        std::thread::sleep(Duration::from_secs(3));
        let running = is_roblox_running(&mut sys);

        if running != was_running {
            log(if running { "Roblox started" } else { "Roblox exited" });
        }

        if was_running && !running {
            let enabled = get_settings()
                .map(|s| s.clear_cache_on_exit)
                .unwrap_or(false);
            if enabled {
                for attempt in 1..=5 {
                    match clear_cache_files() {
                        Ok(r) => {
                            log(&format!("cache clear attempt {attempt}: ok ({} removed)", r.removed));
                            break;
                        }
                        Err(e) => {
                            log(&format!("cache clear attempt {attempt}: failed: {e}"));
                            std::thread::sleep(Duration::from_secs(1));
                        }
                    }
                }
            }
        }

        was_running = running;
    }
}
