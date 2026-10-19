//! Dusk's own settings file (`%LOCALAPPDATA%\Dusk\state\settings.json`).

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::paths::dusk_state_dir;

// ---------------------------------------------------------------------
// Dusk's own settings (release channel, Discord RPC toggle) — separate
// from the per-version manifest/backups above.
// ---------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
pub struct DuskSettings {
    /// Passed as `--channel <name>` to RobloxPlayerBeta.exe when set,
    /// selecting a non-production release channel (e.g. "zintegration").
    pub release_channel: Option<String>,
    /// Whether the background thread in `main()` should keep Discord's
    /// Rich Presence activity updated while Roblox is running.
    pub discord_rpc_enabled: bool,
    /// File name of the font currently applied via the Appearance ->
    /// Font picker, so re-opening Settings can show what's active instead
    /// of resetting to "no file chosen".
    pub active_font_name: Option<String>,
    /// face suffix ("ft"/"bk"/"lf"/"rt"/"up"/"dn") -> source file name,
    /// for the same reason as active_font_name.
    #[serde(default)]
    pub active_sky_faces: std::collections::HashMap<String, String>,
    /// "dark" or "light" — defaults to dark via `default_theme` since an
    /// empty/older settings file has no opinion yet.
    #[serde(default = "default_theme")]
    pub theme: String,
    /// Delete Roblox's asset cache right before launching, so replaced
    /// assets are re-fetched instead of served from the old cache.
    #[serde(default)]
    pub clear_cache_on_launch: bool,
    /// Delete the cache again after Roblox exits.
    #[serde(default)]
    pub clear_cache_on_exit: bool,
    /// Put the skybox fix files back into Roblox's cache before each launch.
    #[serde(default)]
    pub skybox_fix_on_launch: bool,
    /// UI sound effects on/off.
    #[serde(default = "default_true")]
    pub sound_enabled: bool,
    /// UI sound effects volume, 0.0–1.0.
    #[serde(default = "default_sound_volume")]
    pub sound_volume: f32,
}

fn default_true() -> bool {
    true
}

fn default_sound_volume() -> f32 {
    0.6
}

pub(crate) fn default_theme() -> String {
    "dark".to_string()
}

impl Default for DuskSettings {
    fn default() -> Self {
        DuskSettings {
            release_channel: None,
            discord_rpc_enabled: false,
            active_font_name: None,
            active_sky_faces: std::collections::HashMap::new(),
            theme: default_theme(),
            clear_cache_on_launch: false,
            clear_cache_on_exit: false,
            skybox_fix_on_launch: false,
            sound_enabled: true,
            sound_volume: default_sound_volume(),
        }
    }
}

pub(crate) fn settings_path() -> Result<PathBuf, String> {
    Ok(dusk_state_dir()?.join("settings.json"))
}

#[tauri::command]
pub fn get_settings() -> Result<DuskSettings, String> {
    let path = settings_path()?;
    if !path.is_file() {
        return Ok(DuskSettings::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_settings(settings: DuskSettings) -> Result<(), String> {
    let path = settings_path()?;
    let raw = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

/// Read-modify-write on the backend so this toggle can't be overwritten by a
/// stale copy of the settings held by another part of the UI.
#[tauri::command]
pub fn set_skybox_fix_on_launch(enabled: bool) -> Result<(), String> {
    let mut settings = get_settings().unwrap_or_default();
    settings.skybox_fix_on_launch = enabled;
    update_settings(settings)
}
