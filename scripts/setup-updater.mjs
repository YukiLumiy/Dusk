// One-time setup: points the updater at your GitHub repository and puts your
// public signing key into tauri.conf.json.
//
//   node scripts/setup-updater.mjs OWNER/REPO [path-to-public-key]
//
// The key is made with:  npm run tauri signer generate -- -w %USERPROFILE%\.tauri\dusk.key
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repo = process.argv[2];
if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? "")) {
  console.error("Usage: node scripts/setup-updater.mjs OWNER/REPO [path-to-public-key]");
  process.exit(1);
}
const keyPath = process.argv[3] ?? path.join(os.homedir(), ".tauri", "dusk.key.pub");
if (!fs.existsSync(keyPath)) {
  console.error(`Public key not found: ${keyPath}\nCreate one with: npm run tauri signer generate -- -w "${keyPath.replace(/\.pub$/, "")}"`);
  process.exit(1);
}

const confPath = "src-tauri/tauri.conf.json";
const conf = JSON.parse(fs.readFileSync(confPath, "utf8"));
conf.plugins ??= {};
conf.plugins.updater = {
  ...conf.plugins.updater,
  pubkey: fs.readFileSync(keyPath, "utf8").trim(),
  endpoints: [`https://github.com/${repo}/releases/latest/download/latest.json`],
};
fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n");
console.log(`Updater now reads releases from https://github.com/${repo}`);
