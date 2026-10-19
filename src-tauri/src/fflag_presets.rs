//! FastFlag presets and profiles.
//!
//! Presets (FPS limit, graphics API, lighting, ...) change the flags in
//! ClientAppSettings.json; profiles are named snapshots of the whole flag set
//! that can be saved and loaded again. Both read-modify-write on this side, so
//! a stale copy of the flags held by the UI can never clobber a change.

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use serde_json::{Map, Value};

use crate::fflags::{get_fast_flags, save_fast_flags};
use crate::paths::dusk_state_dir;

type Flags = Map<String, Value>;

fn profiles_path() -> Result<PathBuf, String> {
    Ok(dusk_state_dir()?.join("fflag_profiles.json"))
}

fn read_profiles() -> Result<BTreeMap<String, Flags>, String> {
    let path = profiles_path()?;
    if !path.is_file() {
        return Ok(BTreeMap::new());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    if raw.trim().is_empty() {
        return Ok(BTreeMap::new());
    }
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

fn write_profiles(profiles: &BTreeMap<String, Flags>) -> Result<(), String> {
    let path = profiles_path()?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(profiles).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

/// Removes the `remove` flags, then sets the `set` flags; returns the result.
#[tauri::command]
pub fn update_fast_flags(set: Flags, remove: Vec<String>) -> Result<Flags, String> {
    let mut flags = get_fast_flags()?;
    for key in remove {
        flags.remove(&key);
    }
    for (key, value) in set {
        flags.insert(key, value);
    }
    save_fast_flags(flags.clone())?;
    Ok(flags)
}

#[derive(Serialize)]
pub struct ProfileInfo {
    pub name: String,
    pub count: usize,
}

#[tauri::command]
pub fn list_fflag_profiles() -> Result<Vec<ProfileInfo>, String> {
    Ok(read_profiles()?
        .into_iter()
        .map(|(name, flags)| ProfileInfo { name, count: flags.len() })
        .collect())
}

/// Saves the flags currently in ClientAppSettings.json under `name`.
#[tauri::command]
pub fn save_fflag_profile(name: String) -> Result<(), String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("A profile needs a name.".to_string());
    }
    let flags = get_fast_flags()?;
    let mut profiles = read_profiles()?;
    profiles.insert(name, flags);
    write_profiles(&profiles)
}

/// Replaces the current flags with the profile's and returns them.
#[tauri::command]
pub fn load_fflag_profile(name: String) -> Result<Flags, String> {
    let flags = read_profiles()?
        .get(&name)
        .cloned()
        .ok_or_else(|| format!("No profile named \"{name}\"."))?;
    save_fast_flags(flags.clone())?;
    Ok(flags)
}

#[tauri::command]
pub fn delete_fflag_profile(name: String) -> Result<(), String> {
    let mut profiles = read_profiles()?;
    profiles.remove(&name);
    write_profiles(&profiles)
}
