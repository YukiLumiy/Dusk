//! Skybox face encoding, the built-in templates, and the on-disk truth about
//! what the Appearance section has applied.

use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::Path;

use crate::sky_presets::{Preset, FACE_KEYS, PRESETS};

pub(crate) fn find_preset(slug: &str) -> Option<&'static Preset> {
    PRESETS.iter().find(|p| p.slug == slug)
}

/// Writes all six faces of a template into `sky_dir` as BC1 .tex files.
pub(crate) fn write_preset_faces(sky_dir: &Path, preset: &Preset) -> Result<usize, String> {
    fs::create_dir_all(sky_dir).map_err(|e| e.to_string())?;
    // Decode everything first so a bad face can't leave a half-written sky.
    let mut encoded = Vec::with_capacity(6);
    for (key, bytes) in FACE_KEYS.iter().zip(preset.faces.iter()) {
        let img = image::load_from_memory(bytes)
            .map_err(|e| format!("Template '{}' face {key} is damaged: {e}", preset.name))?;
        encoded.push((*key, encode_sky_image(&img)));
    }
    for (key, tex) in &encoded {
        fs::write(sky_dir.join(format!("sky512_{key}.tex")), tex).map_err(|e| e.to_string())?;
    }
    Ok(encoded.len())
}

/// What is really applied right now. Dusk's settings remember the names
/// of the font / faces it installed, but that memory goes stale the moment
/// the profile is switched off, deleted or emptied elsewhere — so the files
/// themselves decide. A disabled profile lives in a `_disabled_` folder, so
/// only the enabled folder counts.
pub(crate) fn applied_state(
    root: &Path,
    font_name: &Option<String>,
    sky_faces: &HashMap<String, String>,
) -> (Option<String>, BTreeMap<String, String>) {
    let font = font_name.clone().filter(|name| {
        root.join("custom-font").join("content").join("fonts").join(name).is_file()
    });
    let sky_dir = root.join("custom-skybox").join("content").join("sky");
    let faces = sky_faces
        .iter()
        .filter(|(key, _)| sky_dir.join(format!("sky512_{key}.tex")).is_file())
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    (font, faces)
}

/// Roblox's stock content/sky/sky512_*.tex files are BC1(DXT1)-compressed
/// DDS textures, not plain image bytes — copying a PNG/JPG in with just a
/// renamed extension produces a texture Roblox can't decode (it shows up
/// as a solid black face in-game instead). If the picked file is already
/// a .tex, we trust it's already correctly encoded (e.g. exported by a
/// dedicated skybox tool) and copy it as-is; otherwise we decode it,
/// resize it to the 512x512 Roblox expects, and BC1-encode it into a
/// proper DDS container ourselves.
pub(crate) fn encode_sky_face(source_path: &Path) -> Result<Vec<u8>, String> {
    let is_already_tex = source_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("tex"))
        .unwrap_or(false);

    if is_already_tex {
        return fs::read(source_path).map_err(|e| e.to_string());
    }

    let img = image::open(source_path)
        .map_err(|e| format!("Couldn't read '{}' as an image: {e}", source_path.display()))?;
    Ok(encode_sky_image(&img))
}

/// Resizes to the 512x512 Roblox expects and BC1-encodes into a DDS.
pub(crate) fn encode_sky_image(img: &image::DynamicImage) -> Vec<u8> {
    let rgba = img
        .resize_exact(512, 512, image::imageops::FilterType::Triangle)
        .to_rgba8();
    let (width, height) = (rgba.width() as usize, rgba.height() as usize);

    let format = texpresso::Format::Bc1;
    let mut compressed = vec![0u8; format.compressed_size(width, height)];
    format.compress(
        rgba.as_raw(),
        width,
        height,
        texpresso::Params::default(),
        &mut compressed,
    );

    wrap_bc1_dds(width as u32, height as u32, &compressed)
}

/// Builds a minimal DDS container (magic + 124-byte DDS_HEADER, no
/// mipmaps) around already BC1/DXT1-compressed pixel data.
pub(crate) fn wrap_bc1_dds(width: u32, height: u32, data: &[u8]) -> Vec<u8> {
    const DDSD_CAPS: u32 = 0x1;
    const DDSD_HEIGHT: u32 = 0x2;
    const DDSD_WIDTH: u32 = 0x4;
    const DDSD_PIXELFORMAT: u32 = 0x1000;
    const DDSD_LINEARSIZE: u32 = 0x80000;
    const DDPF_FOURCC: u32 = 0x4;
    const DDSCAPS_TEXTURE: u32 = 0x1000;

    let mut out = Vec::with_capacity(4 + 124 + data.len());
    out.extend_from_slice(b"DDS ");

    let mut header = [0u8; 124];
    header[0..4].copy_from_slice(&124u32.to_le_bytes()); // dwSize
    header[4..8].copy_from_slice(
        &(DDSD_CAPS | DDSD_HEIGHT | DDSD_WIDTH | DDSD_PIXELFORMAT | DDSD_LINEARSIZE)
            .to_le_bytes(),
    ); // dwFlags
    header[8..12].copy_from_slice(&height.to_le_bytes());
    header[12..16].copy_from_slice(&width.to_le_bytes());
    header[16..20].copy_from_slice(&(data.len() as u32).to_le_bytes()); // dwPitchOrLinearSize
    // dwDepth, dwMipMapCount, dwReserved1[11] all stay 0

    let pf = 72; // DDS_PIXELFORMAT starts right after dwReserved1
    header[pf..pf + 4].copy_from_slice(&32u32.to_le_bytes()); // dwSize
    header[pf + 4..pf + 8].copy_from_slice(&DDPF_FOURCC.to_le_bytes()); // dwFlags
    header[pf + 8..pf + 12].copy_from_slice(b"DXT1"); // dwFourCC
    // dwRGBBitCount + 4 bitmasks stay 0

    let caps = pf + 32; // 104
    header[caps..caps + 4].copy_from_slice(&DDSCAPS_TEXTURE.to_le_bytes());
    // dwCaps2/3/4, dwReserved2 all stay 0

    out.extend_from_slice(&header);
    out.extend_from_slice(data);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(tag: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("dusk-sky-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn every_template_decodes_and_encodes_to_dds() {
        assert!(PRESETS.len() >= 10);
        let dir = temp("presets");
        for preset in PRESETS {
            let sky = dir.join(preset.slug);
            assert_eq!(write_preset_faces(&sky, preset).unwrap(), 6, "{}", preset.name);
            for key in FACE_KEYS {
                let bytes = fs::read(sky.join(format!("sky512_{key}.tex"))).unwrap();
                assert_eq!(&bytes[..4], b"DDS ");
                assert_eq!(bytes.len(), 4 + 124 + 512 * 512 / 2, "512x512 BC1 plus header");
            }
        }
        assert!(find_preset(PRESETS[0].slug).is_some() && find_preset("nope").is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn applied_state_follows_the_files_on_disk() {
        let root = temp("state");
        let font = Some("My.ttf".to_string());
        let faces: HashMap<String, String> =
            [("up", "a.png"), ("dn", "b.png")].iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();

        // nothing installed -> nothing applied, whatever settings remember
        assert_eq!(applied_state(&root, &font, &faces), (None, BTreeMap::new()));

        fs::create_dir_all(root.join("custom-font/content/fonts")).unwrap();
        fs::write(root.join("custom-font/content/fonts/My.ttf"), b"x").unwrap();
        fs::create_dir_all(root.join("custom-skybox/content/sky")).unwrap();
        fs::write(root.join("custom-skybox/content/sky/sky512_up.tex"), b"x").unwrap();
        let (f, s) = applied_state(&root, &font, &faces);
        assert_eq!(f.as_deref(), Some("My.ttf"));
        assert_eq!(s.keys().collect::<Vec<_>>(), vec!["up"], "only faces that exist");

        // switching the profiles off renames the folders -> no longer applied
        fs::rename(root.join("custom-font"), root.join("_disabled_custom-font")).unwrap();
        fs::rename(root.join("custom-skybox"), root.join("_disabled_custom-skybox")).unwrap();
        assert_eq!(applied_state(&root, &font, &faces), (None, BTreeMap::new()));
        let _ = fs::remove_dir_all(&root);
    }
}
