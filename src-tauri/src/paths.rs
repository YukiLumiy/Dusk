//! Where things live on disk: the Roblox install, Roblox's logs, and
//! Dusk's own state folder.

use std::env;
use std::fs;
use std::path::PathBuf;

/// %LOCALAPPDATA%\Roblox\Versions
pub(crate) fn roblox_versions_dir() -> Option<PathBuf> {
    let local_appdata = env::var_os("LOCALAPPDATA")?;
    let dir = PathBuf::from(local_appdata).join("Roblox").join("Versions");
    if dir.is_dir() {
        Some(dir)
    } else {
        None
    }
}

/// Roblox does not expose a single "active version" file we can trust across
/// installs, so we heuristically pick the version folder that contains
/// RobloxPlayerBeta.exe and was modified most recently. This matches the
/// folder Roblox itself launches from immediately after an update.
pub(crate) fn latest_version_folder() -> Result<PathBuf, String> {
    let versions_dir = roblox_versions_dir().ok_or("Roblox is not installed for this user")?;

    let mut candidates: Vec<(PathBuf, std::time::SystemTime)> = fs::read_dir(&versions_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.is_dir() && path.join("RobloxPlayerBeta.exe").is_file())
        .filter_map(|path| {
            let modified = path.metadata().ok()?.modified().ok()?;
            Some((path, modified))
        })
        .collect();

    candidates.sort_by_key(|(_, modified)| *modified);

    candidates
        .pop()
        .map(|(path, _)| path)
        .ok_or_else(|| "No Roblox version folder with RobloxPlayerBeta.exe found".to_string())
}

/// %LOCALAPPDATA%\Roblox — Roblox's own per-user data (logs, asset cache).
pub(crate) fn roblox_local_dir() -> Result<PathBuf, String> {
    let local_appdata = env::var_os("LOCALAPPDATA").ok_or("LOCALAPPDATA is not set")?;
    Ok(PathBuf::from(local_appdata).join("Roblox"))
}

/// %LOCALAPPDATA%\Dusk — where Dusk keeps its own state, separate from
/// anything Roblox or Bloxstrap touches.
pub(crate) fn dusk_state_dir() -> Result<PathBuf, String> {
    let local_appdata = env::var_os("LOCALAPPDATA").ok_or("LOCALAPPDATA is not set")?;
    let dir = PathBuf::from(local_appdata).join("Dusk").join("state");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub(crate) fn roblox_logs_dir() -> Result<PathBuf, String> {
    let local_appdata = env::var_os("LOCALAPPDATA").ok_or("LOCALAPPDATA is not set")?;
    Ok(PathBuf::from(local_appdata).join("Roblox").join("logs"))
}
