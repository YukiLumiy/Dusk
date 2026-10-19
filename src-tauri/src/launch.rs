//! Launching Roblox (after syncing mods) from the Launch button or from a
//! roblox-player: link.

use std::process::{Command, Stdio};

use serde::Serialize;

use crate::mods::sync_mods;
use crate::paths::latest_version_folder;
use crate::settings::get_settings;

#[derive(Serialize)]
pub struct LaunchResult {
    version_folder: String,
    files_applied: usize,
    files_restored: usize,
    cache_cleared: bool,
}

/// The `roblox-player:` link among a process's arguments, if any.
pub(crate) fn roblox_uri(args: &[String]) -> Option<String> {
    args.iter()
        .find(|a| a.to_ascii_lowercase().starts_with("roblox-player:"))
        .cloned()
}

/// The Launch button: starts Roblox with no game to join.
#[tauri::command]
pub async fn apply_mods_and_launch(app_handle: tauri::AppHandle) -> Result<LaunchResult, String> {
    launch_roblox(&app_handle, Vec::new())
}

/// Entry point for launches that arrive from outside the UI — either a
/// `roblox-player:` link that started this very process, or one handed over
/// by a second Dusk instance. Anything without such a link (for example the
/// user simply opening Dusk twice) is ignored. Runs on its own thread so
/// callers (a plugin callback, the setup hook) are never blocked by file
/// copying.
pub(crate) fn launch_uri_if_present(app_handle: tauri::AppHandle, args: &[String]) {
    let Some(uri) = roblox_uri(args) else { return };
    std::thread::spawn(move || {
        let _ = launch_roblox(&app_handle, vec![uri]);
    });
}

pub(crate) fn launch_roblox(
    app_handle: &tauri::AppHandle,
    mut passthrough_args: Vec<String>,
) -> Result<LaunchResult, String> {
    let version_folder = latest_version_folder()?;
    let (files_applied, files_restored) = sync_mods(app_handle, &version_folder)?;

    // Optional: wipe Roblox's asset cache so nothing stale is served. A
    // failure here (files locked, Roblox already running) must never block
    // the launch itself, so it's reported rather than propagated.
    let cache_cleared = get_settings()
        .map(|s| s.clear_cache_on_launch)
        .unwrap_or(false)
        && crate::cache::clear_if_idle().is_ok();

    // The cache clear above also deletes the skybox fix files, so put them
    // back. A failure is ignored: it must never block the launch.
    if get_settings().map(|s| s.skybox_fix_on_launch).unwrap_or(false) {
        let _ = crate::skyfix::apply();
    }

    let exe = version_folder.join("RobloxPlayerBeta.exe");

    // `passthrough_args` is the roblox-player: link (when launched from the
    // website) and goes straight through to the real client.
    if let Ok(settings) = get_settings() {
        if let Some(channel) = settings.release_channel.filter(|c| !c.trim().is_empty()) {
            passthrough_args.push("--channel".to_string());
            passthrough_args.push(channel);
        }
    }

    let mut command = Command::new(&exe);
    command
        .args(&passthrough_args)
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    command
        .spawn()
        .map_err(|e| format!("Failed to launch Roblox: {e}"))?;

    Ok(LaunchResult {
        version_folder: version_folder.display().to_string(),
        files_applied,
        files_restored,
        cache_cleared,
    })
}
