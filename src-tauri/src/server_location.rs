//! Server location: find the game server IP in Roblox's log and geolocate it.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::paths::roblox_logs_dir;

// ---------------------------------------------------------------------
// Server location — reads Roblox's own log file to find the IP of the
// game server you're currently connected to, then geolocates it. Unlike
// everything else in this file, the log-parsing regex here is reverse
// engineered from Roblox's log format rather than a documented API, so
// it can break if Roblox changes how it logs connections. If this stops
// finding a match, open the newest file in `%LocalAppData%\Roblox\logs`
// while in a game, search for "UDMUX" or "RCC Server", and update
// SERVER_IP_PATTERN to match the current line format.
// ---------------------------------------------------------------------

#[derive(Serialize)]
pub struct ServerLocation {
    ip: String,
    city: Option<String>,
    region: Option<String>,
    country: Option<String>,
    isp: Option<String>,
}

pub(crate) fn newest_log_file() -> Result<PathBuf, String> {
    let dir = roblox_logs_dir()?;
    fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("log"))
        .filter_map(|p| {
            let modified = p.metadata().ok()?.modified().ok()?;
            Some((p, modified))
        })
        .max_by_key(|(_, modified)| *modified)
        .map(|(p, _)| p)
        .ok_or_else(|| "No Roblox log files found — join a game first".to_string())
}

pub(crate) fn find_server_ip(log_contents: &str) -> Option<String> {
    // Roblox has logged the game server's address under a few different
    // labels over time ("UDMUX Address", "RCC Server Address"); match any
    // of them and take the last occurrence, since a log file can contain
    // more than one join (the most recent game is what we want).
    let pattern = regex::Regex::new(
        r"(?:UDMUX Address|RCC Server Address)\s*=\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})",
    )
    .ok()?;
    pattern
        .captures_iter(log_contents)
        .last()
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
}

#[tauri::command]
pub async fn get_server_location() -> Result<ServerLocation, String> {
    let log_path = newest_log_file()?;
    let contents = fs::read_to_string(&log_path).map_err(|e| e.to_string())?;
    let ip = find_server_ip(&contents)
        .ok_or("Couldn't find a server address in the latest Roblox log — are you in a game?")?;

    #[derive(Deserialize)]
    struct IpApiResponse {
        status: String,
        city: Option<String>,
        #[serde(rename = "regionName")]
        region_name: Option<String>,
        country: Option<String>,
        isp: Option<String>,
    }

    let url = format!("http://ip-api.com/json/{ip}");
    let response: IpApiResponse = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    if response.status != "success" {
        return Err("Geolocation lookup failed for that IP".to_string());
    }

    Ok(ServerLocation {
        ip,
        city: response.city,
        region: response.region_name,
        country: response.country,
        isp: response.isp,
    })
}
