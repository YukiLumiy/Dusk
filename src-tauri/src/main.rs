// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod appearance;
mod cache;
mod fflag_presets;
mod fflags;
mod launch;
mod mods;
mod paths;
mod protocol;
mod rpc;
mod server_location;
mod settings;
mod skyfix;
mod sky;
mod sky_presets;

fn main() {
    std::thread::spawn(rpc::run_discord_rpc_watcher);
    std::thread::spawn(cache::run_exit_watcher);

    tauri::Builder::default()
        // Must be registered first. A second Dusk (started by a
        // roblox-player: link) hands its arguments to this running one and exits.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            launch::launch_uri_if_present(app.clone(), &args);
        }))
        .plugin(tauri_plugin_dialog::init())
        // If *this* process was started by a roblox-player: link, launch it.
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            launch::launch_uri_if_present(app.handle().clone(), &args);
            Ok(())
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            launch::apply_mods_and_launch,
            protocol::get_protocol_status,
            protocol::register_protocol_handler,
            protocol::restore_protocol_handler,
            cache::clear_roblox_cache,
            mods::list_mod_profiles,
            mods::set_mod_profile_enabled,
            mods::open_mods_folder,
            mods::delete_mod_profile,
            mods::rename_mod_profile,
            appearance::install_font_mod,
            appearance::install_skybox_mod,
            appearance::list_sky_presets,
            appearance::install_sky_preset,
            appearance::get_appearance_state,
            appearance::reset_appearance,
            settings::get_settings,
            settings::update_settings,
            settings::set_skybox_fix_on_launch,
            skyfix::get_skybox_fix_status,
            skyfix::apply_skybox_fix,
            skyfix::remove_skybox_fix,
            fflags::get_fast_flags,
            fflags::save_fast_flags,
            fflag_presets::update_fast_flags,
            fflag_presets::list_fflag_profiles,
            fflag_presets::save_fflag_profile,
            fflag_presets::load_fflag_profile,
            fflag_presets::delete_fflag_profile,
            server_location::get_server_location
        ])
        .run(tauri::generate_context!())
        .expect("error while running Dusk");
}
