//! Skybox fix: puts small replacement files into Roblox's asset cache
//! (%LOCALAPPDATA%\Roblox\rbx-storage), read-only, under the names Roblox
//! uses for its default sky textures, so a custom skybox mod is the one that
//! shows. This is what the original move.bat did; it is done here directly,
//! with the files built into Dusk, so no batch file or console window is needed.

use std::fs;
use std::path::PathBuf;

use serde::Serialize;

use crate::paths::roblox_local_dir;

/// The replacement cache entry (the same bytes for every name below).
const DATA: &[u8] = include_bytes!("../skyfix/sky.bin");

const NAMES: [&str; 6] = [
    "a564ec8aeef3614e788d02f0090089d8",
    "7328622d2d509b95dd4dd2c721d1ca8b",
    "a50f6563c50ca4d5dcb255ee5cfab097",
    "6c94b9385e52d221f0538aadaceead2d",
    "9244e00ff9fd6cee0bb40a262bb35d31",
    "78cb2e93aee0cdbd79b15a866bc93a54",
];

#[derive(Serialize)]
pub struct SkyFixStatus {
    pub present: usize,
    pub total: usize,
}

/// rbx-storage/<first two characters>/<name>
fn target(name: &str) -> Result<PathBuf, String> {
    Ok(roblox_local_dir()?
        .join("rbx-storage")
        .join(&name[..2])
        .join(name))
}

fn set_readonly(path: &PathBuf, readonly: bool) {
    if let Ok(meta) = fs::metadata(path) {
        let mut perms = meta.permissions();
        perms.set_readonly(readonly);
        let _ = fs::set_permissions(path, perms);
    }
}

/// Writes every file (replacing existing ones) and marks it read-only so
/// Roblox doesn't overwrite it. Returns how many were written.
pub(crate) fn apply() -> Result<usize, String> {
    let mut done = 0;
    let mut errors: Vec<String> = Vec::new();
    for name in NAMES {
        let path = target(name)?;
        let result = (|| -> Result<(), String> {
            if let Some(dir) = path.parent() {
                fs::create_dir_all(dir).map_err(|e| e.to_string())?;
            }
            if path.exists() {
                set_readonly(&path, false);
            }
            fs::write(&path, DATA).map_err(|e| e.to_string())?;
            set_readonly(&path, true);
            Ok(())
        })();
        match result {
            Ok(()) => done += 1,
            Err(e) => errors.push(format!("{name}: {e}")),
        }
    }
    if errors.is_empty() {
        Ok(done)
    } else {
        Err(format!("Applied {done} of {}: {}", NAMES.len(), errors.join("; ")))
    }
}

/// Deletes the replacement files so Roblox downloads the originals again.
pub(crate) fn remove() -> Result<usize, String> {
    let mut removed = 0;
    for name in NAMES {
        let path = target(name)?;
        if path.is_file() {
            set_readonly(&path, false);
            fs::remove_file(&path).map_err(|e| format!("Couldn't delete {}: {e}", path.display()))?;
            removed += 1;
        }
    }
    Ok(removed)
}

#[tauri::command]
pub fn get_skybox_fix_status() -> Result<SkyFixStatus, String> {
    let mut present = 0;
    for name in NAMES {
        if fs::read(target(name)?).map(|d| d == DATA).unwrap_or(false) {
            present += 1;
        }
    }
    Ok(SkyFixStatus { present, total: NAMES.len() })
}

#[tauri::command]
pub fn apply_skybox_fix() -> Result<usize, String> {
    apply()
}

#[tauri::command]
pub fn remove_skybox_fix() -> Result<usize, String> {
    remove()
}
