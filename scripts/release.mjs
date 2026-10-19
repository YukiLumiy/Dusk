// Bumps the version everywhere, commits, and tags it:
//
//   npm run release -- 0.1.1
//
// Then push the commit and the tag; GitHub Actions builds, signs and publishes it.
import fs from "node:fs";
import { execSync } from "node:child_process";

const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v ?? "")) {
  console.error("Usage: npm run release -- 0.1.1");
  process.exit(1);
}
const files = {
  "package.json": (t) => t.replace(/("version":\s*")[^"]+/, `$1${v}`),
  "src-tauri/tauri.conf.json": (t) => t.replace(/("version":\s*")[^"]+/, `$1${v}`),
  "src-tauri/Cargo.toml": (t) => t.replace(/^version\s*=\s*"[^"]+"/m, `version = "${v}"`),
};
for (const [file, edit] of Object.entries(files)) fs.writeFileSync(file, edit(fs.readFileSync(file, "utf8")));
execSync(`git add ${Object.keys(files).join(" ")} && git commit -m "v${v}" && git tag v${v}`, { stdio: "inherit" });
console.log(`\nTagged v${v}. Publish it with:\n  git push origin HEAD --tags`);
