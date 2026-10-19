//! Discord Rich Presence watcher thread.

use crate::settings::get_settings;

// ---------------------------------------------------------------------
// Discord Rich Presence — a background thread polls for
// RobloxPlayerBeta.exe and keeps a Discord activity in sync with it.
// This only talks to the local Discord client over its IPC pipe; it does
// not touch Roblox's process or files at all.
// ---------------------------------------------------------------------

pub(crate) fn run_discord_rpc_watcher() {
    use discord_rich_presence::activity::{Activity, Assets, Timestamps};
    use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
    use sysinfo::System;

    // Replace with a real Discord application ID if you register one at
    // https://discord.com/developers/applications — a generic ID still
    // works but shows a default Discord icon rather than a custom one.
    const DISCORD_APP_ID: &str = "1234567890123456789";

    let mut client: Option<DiscordIpcClient> = None;
    let mut connected = false;
    let mut session_start: Option<i64> = None;
    let mut sys = System::new_all();

    loop {
        std::thread::sleep(std::time::Duration::from_secs(5));
        sys.refresh_all();

        let settings = get_settings().unwrap_or_default();
        let roblox_running = sys
            .processes_by_name(std::ffi::OsStr::new("RobloxPlayerBeta.exe"))
            .next()
            .is_some();

        if !settings.discord_rpc_enabled || !roblox_running {
            if connected {
                if let Some(c) = client.as_mut() {
                    let _ = c.clear_activity();
                }
                connected = false;
                session_start = None;
            }
            continue;
        }

        if client.is_none() {
            client = DiscordIpcClient::new(DISCORD_APP_ID).ok();
        }

        let Some(c) = client.as_mut() else { continue };

        if !connected {
            if c.connect().is_err() {
                client = None;
                continue;
            }
            connected = true;
            session_start = Some(chrono_now());
        }

        let activity = Activity::new()
            .state("In Roblox")
            .details("Launched via Dusk")
            .assets(Assets::new().large_image("mover_logo"))
            .timestamps(Timestamps::new().start(session_start.unwrap_or_else(chrono_now)));

        let _ = c.set_activity(activity);
    }
}

pub(crate) fn chrono_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
