//! Making Dusk the handler for `roblox-player:` links (the Play button on
//! roblox.com) — reversibly.
//!
//! Only the current user's registry (`HKCU\Software\Classes\roblox-player`)
//! is touched; no administrator rights are needed. Before Dusk takes the
//! handler over, whatever was registered there is saved to
//! `%LOCALAPPDATA%\Dusk\state\protocol-backup.json`, and
//! `restore_protocol_handler` puts it back exactly (or removes the key if
//! there was none). The first backup is never overwritten, so registering
//! twice can't lose the original.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::paths::dusk_state_dir;

#[cfg(windows)]
const KEY_PATH: &str = "Software\\Classes\\roblox-player";

/// The values under the roblox-player key that Dusk cares about.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
struct ProtocolEntry {
    had_key: bool,
    key_default: Option<String>,
    url_protocol: Option<String>,
    icon: Option<String>,
    command: Option<String>,
}

impl ProtocolEntry {
    fn absent() -> Self {
        ProtocolEntry {
            had_key: false,
            key_default: None,
            url_protocol: None,
            icon: None,
            command: None,
        }
    }

    fn for_dusk(exe: &str) -> Self {
        ProtocolEntry {
            had_key: true,
            key_default: Some("URL:Roblox Protocol".to_string()),
            url_protocol: Some(String::new()),
            icon: Some(exe.to_string()),
            command: Some(format!("\"{exe}\" \"%1\"")),
        }
    }
}

fn backup_path() -> Result<PathBuf, String> {
    Ok(dusk_state_dir()?.join("protocol-backup.json"))
}

/// Does a registered shell command launch this executable?
pub(crate) fn command_targets(command: &str, exe: &str) -> bool {
    let norm = |s: &str| s.to_lowercase().replace('/', "\\");
    norm(command).contains(&norm(exe))
}

/// What (if anything) must be saved before Dusk overwrites the key.
/// `None` means "nothing worth saving": the key already points at Dusk.
fn original_to_save(existing: Option<&ProtocolEntry>, exe: &str) -> Option<ProtocolEntry> {
    match existing {
        None => Some(ProtocolEntry::absent()),
        Some(entry) => {
            let already_dusk = entry
                .command
                .as_deref()
                .map(|c| command_targets(c, exe))
                .unwrap_or(false);
            (!already_dusk).then(|| entry.clone())
        }
    }
}

// ---------------------------------------------------------------- registry

#[cfg(windows)]
mod registry {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    use super::{ProtocolEntry, KEY_PATH};

    /// The current user's roblox-player entry, or None if the key is absent.
    pub(super) fn read() -> Option<ProtocolEntry> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let key = hkcu.open_subkey(KEY_PATH).ok()?;
        Some(ProtocolEntry {
            had_key: true,
            key_default: key.get_value("").ok(),
            url_protocol: key.get_value("URL Protocol").ok(),
            icon: key
                .open_subkey("DefaultIcon")
                .ok()
                .and_then(|k| k.get_value("").ok()),
            command: key
                .open_subkey("shell\\open\\command")
                .ok()
                .and_then(|k| k.get_value("").ok()),
        })
    }

    fn put(key: &RegKey, name: &str, value: &Option<String>) -> Result<(), String> {
        match value {
            Some(v) => key.set_value(name, v).map_err(|e| e.to_string()),
            None => {
                let _ = key.delete_value(name);
                Ok(())
            }
        }
    }

    pub(super) fn write(entry: &ProtocolEntry) -> Result<(), String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (key, _) = hkcu.create_subkey(KEY_PATH).map_err(|e| e.to_string())?;
        put(&key, "", &entry.key_default)?;
        put(&key, "URL Protocol", &entry.url_protocol)?;

        match &entry.icon {
            Some(icon) => {
                let (sub, _) = key.create_subkey("DefaultIcon").map_err(|e| e.to_string())?;
                sub.set_value("", icon).map_err(|e| e.to_string())?;
            }
            None => {
                let _ = key.delete_subkey_all("DefaultIcon");
            }
        }

        match &entry.command {
            Some(command) => {
                let (sub, _) = key
                    .create_subkey("shell\\open\\command")
                    .map_err(|e| e.to_string())?;
                sub.set_value("", command).map_err(|e| e.to_string())?;
            }
            None => {
                let _ = key.delete_subkey_all("shell\\open\\command");
            }
        }
        Ok(())
    }

    pub(super) fn remove() -> Result<(), String> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        match hkcu.delete_subkey_all(KEY_PATH) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}

#[cfg(windows)]
fn current_exe_string() -> Result<String, String> {
    std::env::current_exe()
        .map(|p| p.display().to_string())
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------- commands

#[derive(Serialize)]
pub struct ProtocolStatus {
    pub registered_to_dusk: bool,
    /// A saved original exists, so "Restore" has something to put back.
    pub can_restore: bool,
}

#[cfg(windows)]
#[tauri::command]
pub fn get_protocol_status() -> Result<ProtocolStatus, String> {
    let exe = current_exe_string()?;
    let registered_to_dusk = registry::read()
        .and_then(|entry| entry.command)
        .map(|command| command_targets(&command, &exe))
        .unwrap_or(false);
    Ok(ProtocolStatus {
        registered_to_dusk,
        can_restore: backup_path()?.is_file(),
    })
}

#[cfg(not(windows))]
#[tauri::command]
pub fn get_protocol_status() -> Result<ProtocolStatus, String> {
    Ok(ProtocolStatus { registered_to_dusk: false, can_restore: false })
}

#[cfg(windows)]
#[tauri::command]
pub fn register_protocol_handler() -> Result<(), String> {
    let exe = current_exe_string()?;

    // Save the original first, and only once: if a backup already exists the
    // original is already safe and must not be replaced by Dusk's own entry.
    let backup = backup_path()?;
    if !backup.is_file() {
        if let Some(original) = original_to_save(registry::read().as_ref(), &exe) {
            let json = serde_json::to_string_pretty(&original).map_err(|e| e.to_string())?;
            fs::write(&backup, json).map_err(|e| format!("Couldn't save the original handler: {e}"))?;
        }
    }

    registry::write(&ProtocolEntry::for_dusk(&exe))
}

#[cfg(not(windows))]
#[tauri::command]
pub fn register_protocol_handler() -> Result<(), String> {
    Err("Protocol registration is only implemented for Windows".into())
}

#[cfg(windows)]
#[tauri::command]
pub fn restore_protocol_handler() -> Result<(), String> {
    let backup = backup_path()?;
    let text = fs::read_to_string(&backup)
        .map_err(|_| "Nothing to restore: Dusk hasn't changed the Roblox link handler.".to_string())?;
    let original: ProtocolEntry =
        serde_json::from_str(&text).map_err(|e| format!("The saved handler couldn't be read: {e}"))?;

    if original.had_key {
        registry::write(&original)?;
    } else {
        registry::remove()?;
    }
    fs::remove_file(&backup).map_err(|e| e.to_string())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn restore_protocol_handler() -> Result<(), String> {
    Err("Protocol registration is only implemented for Windows".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXE: &str = "C:\\Dev\\dusk\\src-tauri\\target\\debug\\dusk.exe";
    const ROBLOX_CMD: &str =
        "\"C:\\Users\\me\\AppData\\Local\\Roblox\\Versions\\RobloxPlayerLauncher.exe\" %1";

    fn roblox_entry() -> ProtocolEntry {
        ProtocolEntry {
            had_key: true,
            key_default: Some("URL: Roblox Protocol".into()),
            url_protocol: Some(String::new()),
            icon: Some("C:\\x\\RobloxPlayerLauncher.exe,0".into()),
            command: Some(ROBLOX_CMD.into()),
        }
    }

    #[test]
    fn recognises_its_own_command_regardless_of_case_and_slashes() {
        let cmd = format!("\"{}\" \"%1\"", EXE.to_uppercase().replace('\\', "/"));
        assert!(command_targets(&cmd, EXE));
        assert!(!command_targets(ROBLOX_CMD, EXE));
    }

    #[test]
    fn dusk_entry_quotes_exe_and_passes_the_uri() {
        let e = ProtocolEntry::for_dusk(EXE);
        assert_eq!(e.command.unwrap(), format!("\"{EXE}\" \"%1\""));
        assert_eq!(e.url_protocol.as_deref(), Some(""));
    }

    #[test]
    fn saves_the_original_when_it_is_roblox() {
        let r = roblox_entry();
        assert_eq!(original_to_save(Some(&r), EXE), Some(r));
    }

    #[test]
    fn records_absence_when_there_was_no_key() {
        assert_eq!(original_to_save(None, EXE), Some(ProtocolEntry::absent()));
    }

    #[test]
    fn saves_nothing_when_the_key_is_already_dusk() {
        assert_eq!(original_to_save(Some(&ProtocolEntry::for_dusk(EXE)), EXE), None);
    }

    #[test]
    fn backup_json_round_trips() {
        let r = roblox_entry();
        let json = serde_json::to_string(&r).unwrap();
        assert_eq!(serde_json::from_str::<ProtocolEntry>(&json).unwrap(), r);
        let a = ProtocolEntry::absent();
        let json = serde_json::to_string(&a).unwrap();
        assert_eq!(serde_json::from_str::<ProtocolEntry>(&json).unwrap(), a);
    }
}
