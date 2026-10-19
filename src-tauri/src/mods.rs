//! Mod profiles: per-profile overlay onto the Roblox version folder, with
//! backups of stock files and restore when a profile is disabled/removed.

use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::paths::dusk_state_dir;

pub(crate) const DISABLED_PREFIX: &str = "_disabled_";

/// Tracks, per Roblox version folder, which relative paths Dusk currently
/// has overlaid, so that removing a mod (or disabling a profile) restores
/// the stock file next launch instead of leaving it modified forever.
/// This mirrors Bloxstrap's own "Adding custom mods" behavior.
#[derive(Serialize, Deserialize, Default)]
pub struct Manifest {
    /// Relative paths (e.g. "content/fonts/families/Roboto.json") currently
    /// overlaid, keyed to nothing else — the backup for each lives at a
    /// predictable path derived from it.
    active_paths: HashSet<String>,
}

pub(crate) fn manifest_path(version_folder: &Path) -> Result<PathBuf, String> {
    let name = version_folder
        .file_name()
        .ok_or("Version folder has no name")?
        .to_string_lossy();
    Ok(dusk_state_dir()?.join(format!("manifest-{name}.json")))
}

pub(crate) fn backup_root(version_folder: &Path) -> Result<PathBuf, String> {
    let name = version_folder
        .file_name()
        .ok_or("Version folder has no name")?
        .to_string_lossy();
    Ok(dusk_state_dir()?.join("backups").join(name.to_string()))
}

pub(crate) fn load_manifest(version_folder: &Path) -> Result<Manifest, String> {
    let path = manifest_path(version_folder)?;
    if !path.is_file() {
        return Ok(Manifest::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

pub(crate) fn save_manifest(version_folder: &Path, manifest: &Manifest) -> Result<(), String> {
    let path = manifest_path(version_folder)?;
    let raw = serde_json::to_string_pretty(manifest).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

/// %LOCALAPPDATA%\Dusk\mods — deliberately NOT app_handle.path().resource_dir().
/// A properly installed app lives under Program Files, which a normal user
/// account can't write to without elevation; every mod operation (toggle,
/// font/skybox install) would fail with "Access is denied (os error 5)" if
/// mods lived there. Keeping user-generated content in LOCALAPPDATA (next
/// to Dusk's own state/backups) avoids that entirely.
pub(crate) fn mods_root(_app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let local_appdata = env::var_os("LOCALAPPDATA").ok_or("LOCALAPPDATA is not set")?;
    let root = PathBuf::from(local_appdata).join("Dusk").join("mods");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root)
}

/// All mod source directories, in priority order (later entries win on
/// conflict). Each is a "profile" — a folder under the app's `mods/`
/// resource directory mirroring the Roblox version folder's layout. Only
/// subfolders that are enabled (not prefixed with "_disabled_") are used,
/// so profiles can be toggled without deleting them — the thing Bloxstrap
/// itself can't do cleanly with its single merged mods folder.
pub(crate) fn enabled_mod_profiles(app_handle: &tauri::AppHandle) -> Result<Vec<PathBuf>, String> {
    let mods_root_dir = mods_root(app_handle)?;
    if !mods_root_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut profiles: Vec<PathBuf> = fs::read_dir(&mods_root_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .filter(|path| {
            !path
                .file_name()
                .map(|n| n.to_string_lossy().starts_with(DISABLED_PREFIX))
                .unwrap_or(true)
        })
        .collect();

    profiles.sort();
    Ok(profiles)
}

pub(crate) fn walk_files(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    if !dir.is_dir() {
        return Ok(files);
    }
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.is_dir() {
            files.extend(walk_files(&path)?);
        } else {
            files.push(path);
        }
    }
    Ok(files)
}

/// Overlays every enabled mod profile onto the version folder, backing up
/// any stock file the first time it's touched, and restoring stock files
/// for any previously-active path that's no longer covered by an enabled
/// profile. This is the Bloxstrap-equivalent behavior, plus per-profile
/// toggling.
pub(crate) fn sync_mods(
    app_handle: &tauri::AppHandle,
    version_folder: &Path,
) -> Result<(usize, usize), String> {
    let profiles = enabled_mod_profiles(app_handle)?;
    let backups = backup_root(version_folder)?;
    fs::create_dir_all(&backups).map_err(|e| e.to_string())?;

    // relative path -> absolute source file, last profile wins on conflict
    let mut desired: Vec<(String, PathBuf)> = Vec::new();
    for profile in &profiles {
        for file in walk_files(profile)? {
            let relative = file
                .strip_prefix(profile)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            desired.push((relative, file));
        }
    }

    let active_now: HashSet<String> = desired.iter().map(|(rel, _)| rel.clone()).collect();
    let manifest = load_manifest(version_folder)?;

    // Restore anything that was active before but isn't anymore.
    let mut files_restored = 0;
    for relative in manifest.active_paths.difference(&active_now) {
        let backup_file = backups.join(relative);
        let target = version_folder.join(relative);
        if backup_file.is_file() {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(&backup_file, &target).map_err(|e| e.to_string())?;
            let _ = fs::remove_file(&backup_file);
            files_restored += 1;
        }
    }

    // Apply the currently-desired set, backing up stock files on first touch.
    let mut files_applied = 0;
    for (relative, source) in &desired {
        let target = version_folder.join(relative);
        let backup_file = backups.join(relative);

        if !backup_file.is_file() && target.is_file() {
            if let Some(parent) = backup_file.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(&target, &backup_file).map_err(|e| e.to_string())?;
        }

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::copy(source, &target).map_err(|e| e.to_string())?;
        files_applied += 1;
    }

    save_manifest(version_folder, &Manifest { active_paths: active_now })?;

    Ok((files_applied, files_restored))
}

/// Ensures a profile folder is in its enabled (no `_disabled_` prefix)
/// form and returns its path, so install_font_mod/install_skybox_mod
/// always write into one consistent location. If only a disabled copy
/// exists, it's renamed back to enabled. If both somehow exist — the old
/// bug that made toggling these profiles on/off fail — the disabled
/// copy's files are folded into the enabled one (without clobbering
/// anything already there) and then discarded, rather than silently
/// losing whichever faces/files were only in one of them.
pub(crate) fn ensure_profile_writable(root: &Path, name: &str) -> Result<PathBuf, String> {
    let enabled_path = root.join(name);
    let disabled_path = root.join(format!("{DISABLED_PREFIX}{name}"));

    if !enabled_path.is_dir() && disabled_path.is_dir() {
        fs::rename(&disabled_path, &enabled_path).map_err(|e| e.to_string())?;
    } else if enabled_path.is_dir() && disabled_path.is_dir() {
        for file in walk_files(&disabled_path)? {
            let relative = file.strip_prefix(&disabled_path).map_err(|e| e.to_string())?;
            let dest = enabled_path.join(relative);
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            if !dest.exists() {
                fs::copy(&file, &dest).map_err(|e| e.to_string())?;
            }
        }
        fs::remove_dir_all(&disabled_path).map_err(|e| e.to_string())?;
    }

    Ok(enabled_path)
}

#[derive(Serialize)]
pub struct ModProfileInfo {
    name: String,
    enabled: bool,
    file_count: usize,
}

#[tauri::command]
pub fn open_mods_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    let root = mods_root(&app_handle)?;

    #[cfg(windows)]
    {
        Command::new("explorer")
            .arg(&root)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(windows))]
    {
        return Err("Opening the folder is only implemented for Windows".into());
    }

    Ok(())
}

#[tauri::command]
pub fn list_mod_profiles(app_handle: tauri::AppHandle) -> Result<Vec<ModProfileInfo>, String> {
    let root = mods_root(&app_handle)?;
    let mut profiles = Vec::new();

    for entry in fs::read_dir(&root).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if !path.is_dir() {
            continue;
        }
        let folder_name = path
            .file_name()
            .ok_or("Profile folder has no name")?
            .to_string_lossy()
            .to_string();
        let enabled = !folder_name.starts_with(DISABLED_PREFIX);
        let display_name = folder_name
            .strip_prefix(DISABLED_PREFIX)
            .unwrap_or(&folder_name)
            .to_string();
        let file_count = walk_files(&path)?.len();

        profiles.push(ModProfileInfo {
            name: display_name,
            enabled,
            file_count,
        });
    }

    profiles.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(profiles)
}

#[tauri::command]
pub fn set_mod_profile_enabled(
    app_handle: tauri::AppHandle,
    name: String,
    enabled: bool,
) -> Result<(), String> {
    let root = mods_root(&app_handle)?;
    let enabled_path = root.join(&name);
    let disabled_path = root.join(format!("{DISABLED_PREFIX}{name}"));

    let current = if enabled_path.is_dir() {
        &enabled_path
    } else if disabled_path.is_dir() {
        &disabled_path
    } else {
        return Err(format!("No mod profile named '{name}' found"));
    };

    let target = if enabled { &enabled_path } else { &disabled_path };
    if current != target {
        if target.is_dir() {
            // A stale duplicate (e.g. from re-applying a font/skybox after
            // disabling it) would otherwise make this rename fail outright.
            fs::remove_dir_all(target).map_err(|e| e.to_string())?;
        }
        fs::rename(current, target).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ------------------------------------------------------ delete / rename

/// A profile name becomes a folder name, so it must be a legal one on
/// Windows and must not collide with the `_disabled_` marker.
pub(crate) fn validate_profile_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("The name can't be empty".into());
    }
    if name.starts_with(DISABLED_PREFIX) {
        return Err(format!("The name can't start with \"{DISABLED_PREFIX}\""));
    }
    if name == "." || name == ".." || name.ends_with('.') {
        return Err("The name can't end with a dot".into());
    }
    if name.chars().any(|c| matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') || c.is_control()) {
        return Err("The name can't contain  < > : \" / \\ | ? *".into());
    }
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    let reserved = ["CON", "PRN", "AUX", "NUL"]
        .contains(&stem.as_str())
        || ((stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.len() == 4
            && stem.as_bytes()[3].is_ascii_digit());
    if reserved {
        return Err("Windows doesn't allow that name".into());
    }
    Ok(name.to_string())
}

/// The folder a profile currently lives in (enabled or disabled form).
pub(crate) fn existing_profile_dir(root: &Path, name: &str) -> Option<PathBuf> {
    let enabled = root.join(name);
    if enabled.is_dir() {
        return Some(enabled);
    }
    let disabled = root.join(format!("{DISABLED_PREFIX}{name}"));
    disabled.is_dir().then_some(disabled)
}

pub(crate) fn profile_exists(root: &Path, name: &str) -> bool {
    existing_profile_dir(root, name).is_some()
}

pub(crate) fn delete_profile_in(root: &Path, name: &str) -> Result<(), String> {
    let mut found = false;
    // Both forms, in case a stale duplicate exists.
    for dir in [root.join(name), root.join(format!("{DISABLED_PREFIX}{name}"))] {
        if dir.is_dir() {
            fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
            found = true;
        }
    }
    if found {
        Ok(())
    } else {
        Err(format!("No mod profile named '{name}' found"))
    }
}

/// Renames a profile, keeping its on/off state.
pub(crate) fn rename_profile_in(root: &Path, old: &str, new: &str) -> Result<String, String> {
    let new = validate_profile_name(new)?;
    if new == old {
        return Ok(new);
    }
    let current = existing_profile_dir(root, old)
        .ok_or_else(|| format!("No mod profile named '{old}' found"))?;
    let was_disabled = current
        .file_name()
        .map(|n| n.to_string_lossy().starts_with(DISABLED_PREFIX))
        .unwrap_or(false);

    // "a" -> "A" is the same folder on Windows, so that one is allowed.
    let case_only = old.eq_ignore_ascii_case(&new);
    if !case_only && existing_profile_dir(root, &new).is_some() {
        return Err(format!("A profile named '{new}' already exists"));
    }

    let target = if was_disabled {
        root.join(format!("{DISABLED_PREFIX}{new}"))
    } else {
        root.join(&new)
    };
    fs::rename(&current, &target).map_err(|e| e.to_string())?;
    Ok(new)
}

/// Font / skybox profiles are remembered in settings so the Appearance
/// screen can show them as "Active". Once they're deleted or renamed that
/// memory would be wrong.
fn forget_appearance_state(name: &str) {
    let Ok(mut settings) = crate::settings::get_settings() else { return };
    match name {
        "custom-font" => settings.active_font_name = None,
        "custom-skybox" => settings.active_sky_faces.clear(),
        _ => return,
    }
    let _ = crate::settings::update_settings(settings);
}

/// Deleting removes the folder only. If it was enabled, Roblox's files
/// are put back to stock the next time Dusk launches Roblox.
#[tauri::command]
pub fn delete_mod_profile(app_handle: tauri::AppHandle, name: String) -> Result<(), String> {
    let root = mods_root(&app_handle)?;
    delete_profile_in(&root, &name)?;
    forget_appearance_state(&name);
    Ok(())
}

#[tauri::command]
pub fn rename_mod_profile(
    app_handle: tauri::AppHandle,
    old_name: String,
    new_name: String,
) -> Result<String, String> {
    let root = mods_root(&app_handle)?;
    let name = rename_profile_in(&root, &old_name, &new_name)?;
    if name != old_name {
        forget_appearance_state(&old_name);
    }
    Ok(name)
}

#[cfg(test)]
mod profile_tests {
    use super::*;

    fn temp_root(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("dusk-mods-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn validates_names() {
        assert_eq!(validate_profile_name("  My mod ").unwrap(), "My mod");
        for bad in ["", "  ", "a/b", "a\\b", "a:b", "a?", "x.", "_disabled_x", "CON", "com1", "nul.txt", ".."] {
            assert!(validate_profile_name(bad).is_err(), "{bad:?} should be rejected");
        }
    }

    #[test]
    fn rename_keeps_state_and_refuses_clashes() {
        let root = temp_root("rename");
        fs::create_dir_all(root.join("a")).unwrap();
        fs::write(root.join("a").join("f.txt"), "x").unwrap();
        fs::create_dir_all(root.join("_disabled_b")).unwrap();
        fs::create_dir_all(root.join("c")).unwrap();

        assert_eq!(rename_profile_in(&root, "a", "a2").unwrap(), "a2");
        assert!(root.join("a2").join("f.txt").is_file() && !root.join("a").exists());

        assert_eq!(rename_profile_in(&root, "b", "b2").unwrap(), "b2");
        assert!(root.join("_disabled_b2").is_dir() && !root.join("_disabled_b").exists());

        assert!(rename_profile_in(&root, "a2", "c").is_err()); // clash
        assert!(rename_profile_in(&root, "a2", "b2").is_err()); // clash with a disabled one
        assert!(rename_profile_in(&root, "nope", "z").is_err());
        assert_eq!(rename_profile_in(&root, "c", "c").unwrap(), "c");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_removes_both_forms() {
        let root = temp_root("delete");
        fs::create_dir_all(root.join("a")).unwrap();
        fs::create_dir_all(root.join("_disabled_a")).unwrap();
        delete_profile_in(&root, "a").unwrap();
        assert!(!root.join("a").exists() && !root.join("_disabled_a").exists());
        assert!(delete_profile_in(&root, "a").is_err());
        let _ = fs::remove_dir_all(&root);
    }
}
