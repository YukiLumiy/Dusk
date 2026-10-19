//! FastFlag editor: reads/writes ClientAppSettings.json in the current
//! Roblox version folder.

use std::fs;
use std::path::PathBuf;

use crate::paths::latest_version_folder;

// ---------------------------------------------------------------------
// FastFlag editor — reads/writes the current version folder's
// ClientSettings\ClientAppSettings.json, the same file Roblox itself
// reads FFlag/DFFlag/SFFlag overrides from.
// ---------------------------------------------------------------------

pub(crate) fn fast_flags_path() -> Result<PathBuf, String> {
    let version_folder = latest_version_folder()?;
    Ok(version_folder.join("ClientSettings").join("ClientAppSettings.json"))
}

#[tauri::command]
pub fn get_fast_flags() -> Result<serde_json::Map<String, serde_json::Value>, String> {
    let path = fast_flags_path()?;
    if !path.is_file() {
        return Ok(serde_json::Map::new());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    if raw.trim().is_empty() {
        return Ok(serde_json::Map::new());
    }
    let value: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    Ok(value.as_object().cloned().unwrap_or_default())
}

#[tauri::command]
pub fn save_fast_flags(flags: serde_json::Map<String, serde_json::Value>) -> Result<(), String> {
    let path = fast_flags_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(&serde_json::Value::Object(flags))
        .map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}
