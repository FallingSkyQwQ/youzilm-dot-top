#!/usr/bin/env node
/**
 * Deploy the site to Cloudflare Workers.
 *
 * Loads .env.local so that a normal `npm run deploy` can use the same
 * CLOUDFLARE_API_TOKEN as the `blog` CLI.
 */
import { spawnSync } from "node:child_process";

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local; wrangler may be logged in already.
  }
}

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npm", ["run", "db:migrate"]);
run("npx", ["opennextjs-cloudflare", "build"]);
run("npx", ["opennextjs-cloudflare", "deploy"]);
