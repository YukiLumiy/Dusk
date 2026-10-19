//! Appearance mods: custom font and custom skybox, written into mod profiles.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::mods::{ensure_profile_writable, mods_root, profile_exists};
use crate::sky::{applied_state, encode_sky_face, find_preset, write_preset_faces};
use crate::sky_presets::{FACE_KEYS, PRESETS};
use crate::paths::latest_version_folder;
use crate::settings::{get_settings, update_settings};

/// Reads the currently-installed Roblox version's own
/// content/fonts/families/*.json files (so we don't have to hardcode
/// Roblox's ~40 font family names) and rewrites every face's assetId to
/// point at the chosen font file, writing the result into a mod profile.
#[tauri::command]
pub fn install_font_mod(
    app_handle: tauri::AppHandle,
    profile_name: String,
    font_path: String,
) -> Result<usize, String> {
    let version_folder = latest_version_folder()?;
    let stock_families_dir = version_folder.join("content").join("fonts").join("families");
    if !stock_families_dir.is_dir() {
        return Err("Could not find content/fonts/families in the current Roblox install".into());
    }

    let font_path = PathBuf::from(font_path);
    let font_filename = font_path
        .file_name()
        .ok_or("Font path has no file name")?
        .to_string_lossy()
        .to_string();

    let root = mods_root(&app_handle)?;
    let profile_dir = ensure_profile_writable(&root, &profile_name)?;
    let fonts_dir = profile_dir.join("content").join("fonts");
    let families_dir = fonts_dir.join("families");
    fs::create_dir_all(&families_dir).map_err(|e| e.to_string())?;

    fs::copy(&font_path, fonts_dir.join(&font_filename)).map_err(|e| e.to_string())?;

    let target_asset_id = format!("rbxasset://fonts/{font_filename}");
    let mut files_written = 0;

    for entry in fs::read_dir(&stock_families_dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let mut data: serde_json::Value =
            serde_json::from_str(&raw).map_err(|e| e.to_string())?;

        if let Some(faces) = data.get_mut("faces").and_then(|f| f.as_array_mut()) {
            for face in faces {
                if let Some(obj) = face.as_object_mut() {
                    obj.insert(
                        "assetId".to_string(),
                        serde_json::Value::String(target_asset_id.clone()),
                    );
                }
            }
        }

        let file_name = path.file_name().ok_or("Family file has no name")?;
        let out_path = families_dir.join(file_name);
        let out_raw = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
        fs::write(out_path, out_raw).map_err(|e| e.to_string())?;
        files_written += 1;
    }

    let mut settings = get_settings().unwrap_or_default();
    settings.active_font_name = Some(font_filename);
    let _ = update_settings(settings);

    Ok(files_written)
}

#[derive(Deserialize)]
pub struct SkyboxFaces {
    #[serde(rename = "ft")]
    front: Option<String>,
    #[serde(rename = "bk")]
    back: Option<String>,
    #[serde(rename = "lf")]
    left: Option<String>,
    #[serde(rename = "rt")]
    right: Option<String>,
    #[serde(rename = "up")]
    up: Option<String>,
    #[serde(rename = "dn")]
    down: Option<String>,
}

/// Encodes whichever of the six provided face images into
/// mods/<profile>/content/sky/sky512_<face>.tex. Faces left as None are
/// skipped, so a partial replacement (e.g. only the "down" face) is fine.
#[tauri::command]
pub fn install_skybox_mod(
    app_handle: tauri::AppHandle,
    profile_name: String,
    faces: SkyboxFaces,
) -> Result<usize, String> {
    let root = mods_root(&app_handle)?;
    let profile_dir = ensure_profile_writable(&root, &profile_name)?;
    let sky_dir = profile_dir.join("content").join("sky");
    fs::create_dir_all(&sky_dir).map_err(|e| e.to_string())?;

    let mut written = 0;
    let mut settings = get_settings().unwrap_or_default();

    for (suffix, source) in [
        ("ft", &faces.front),
        ("bk", &faces.back),
        ("lf", &faces.left),
        ("rt", &faces.right),
        ("up", &faces.up),
        ("dn", &faces.down),
    ] {
        if let Some(source_path) = source {
            let dest = sky_dir.join(format!("sky512_{suffix}.tex"));
            let tex_bytes = encode_sky_face(Path::new(source_path))?;
            fs::write(&dest, tex_bytes).map_err(|e| e.to_string())?;
            let name = PathBuf::from(source_path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| source_path.clone());
            settings.active_sky_faces.insert(suffix.to_string(), name);
            written += 1;
        }
    }

    if written == 0 {
        return Err("No skybox faces were provided".into());
    }

    let _ = update_settings(settings);

    Ok(written)
}

#[derive(Serialize)]
pub struct PresetInfo {
    slug: &'static str,
    name: &'static str,
}

#[tauri::command]
pub fn list_sky_presets() -> Vec<PresetInfo> {
    PRESETS.iter().map(|p| PresetInfo { slug: p.slug, name: p.name }).collect()
}

/// Applies a built-in template: all six faces, into the same
/// `custom-skybox` profile a hand-picked skybox uses.
#[tauri::command]
pub fn install_sky_preset(app_handle: tauri::AppHandle, slug: String) -> Result<String, String> {
    let preset = find_preset(&slug).ok_or("That template doesn't exist")?;
    let root = mods_root(&app_handle)?;
    let profile_dir = ensure_profile_writable(&root, "custom-skybox")?;
    write_preset_faces(&profile_dir.join("content").join("sky"), preset)?;

    let mut settings = get_settings().unwrap_or_default();
    settings.active_sky_faces.clear();
    for key in FACE_KEYS {
        settings.active_sky_faces.insert(key.to_string(), preset.name.to_string());
    }
    let _ = update_settings(settings);
    Ok(preset.name.to_string())
}

#[derive(Serialize)]
pub struct AppearanceState {
    font: Option<String>,
    sky_faces: std::collections::BTreeMap<String, String>,
}

/// What the Appearance section should show as applied (see `applied_state`).
#[tauri::command]
pub fn get_appearance_state(app_handle: tauri::AppHandle) -> Result<AppearanceState, String> {
    let root = mods_root(&app_handle)?;
    let settings = get_settings().unwrap_or_default();
    let (font, sky_faces) =
        applied_state(&root, &settings.active_font_name, &settings.active_sky_faces);
    Ok(AppearanceState { font, sky_faces })
}

/// Back to Roblox's own font / skybox: the profile is deleted (Roblox's
/// stock files are restored at the next launch) and Dusk forgets it.
#[tauri::command]
pub fn reset_appearance(app_handle: tauri::AppHandle, kind: String) -> Result<(), String> {
    let profile = match kind.as_str() {
        "font" => "custom-font",
        "skybox" => "custom-skybox",
        other => return Err(format!("Unknown appearance kind '{other}'")),
    };
    let root = mods_root(&app_handle)?;
    if profile_exists(&root, profile) {
        crate::mods::delete_profile_in(&root, profile)?;
    }
    let mut settings = get_settings().unwrap_or_default();
    if kind == "font" {
        settings.active_font_name = None;
    } else {
        settings.active_sky_faces.clear();
    }
    let _ = update_settings(settings);
    Ok(())
}
