import path from "node:path";
import { spawnSync } from "node:child_process";
for (const file of [".env.local", ".env"]) {
  try { process.loadEnvFile?.(file); } catch { /* Local credentials are optional. */ }
}
const command = process.argv[2];
if (!["dev", "build", "deploy"].includes(command)) throw new Error("Use dev, build, or deploy.");
await import("./build-admin-assets.mjs");
const args = command === "dev"
  ? ["dev", "--config", "admin/wrangler.jsonc", "--port", "8788"]
  : ["deploy", "--config", "admin/wrangler.jsonc", ...(command === "build" ? ["--dry-run", "--outdir", path.join(process.cwd(), "admin", ".build")] : [])];
const result = spawnSync(process.execPath, [path.join(process.cwd(), "node_modules/wrangler/bin/wrangler.js"), ...args], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
