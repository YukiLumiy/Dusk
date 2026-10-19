# Dusk

Roblox launcher (a modified Mover). Tauri 2 + React + TypeScript frontend, Rust backend:
launch, mods, FastFlags, cache, appearance (fonts/skybox), protocol handler, Discord presence.

```
npm install
npm run tauri dev
```

## Releasing and auto-update

Installed copies of Dusk check GitHub for a newer release and update themselves.

One-time setup:

1. Make a signing key (leave the password empty):
   `npm run tauri signer generate -- -w %USERPROFILE%\.tauri\dusk.key`
2. Point the app at your repository and key:
   `node scripts/setup-updater.mjs OWNER/REPO`
3. On GitHub, open Settings → Secrets and variables → Actions and add
   `TAURI_SIGNING_PRIVATE_KEY` with the contents of `dusk.key`.
   The repository has to be public so installed copies can read its releases.

Every release after that:

```
npm run release -- 0.1.1
git push origin HEAD --tags
```

GitHub Actions builds the installer, signs it and publishes the release.
A local `npm run tauri build` needs the key too:
`$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $env:USERPROFILE\.tauri\dusk.key -Raw`
