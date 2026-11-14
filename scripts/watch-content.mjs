#!/usr/bin/env node
/**
 * Watch content/ and regenerate src/generated/content.json while `next dev`
 * is running. The content build is single-flight: edits made during a build
 * are coalesced into one follow-up rebuild.
 */
import { spawn } from "node:child_process";
import chokidar from "chokidar";

let running = false;
let pending = false;

function build() {
  if (running) {
    pending = true;
    return;
  }

  running = true;
  const child = spawn(process.execPath, ["scripts/build-content.mjs"], {
    stdio: "inherit",
  });

  child.on("close", (code) => {
    running = false;
    if (code !== 0) console.error(`[content] build exited with ${code}`);
    if (pending) {
      pending = false;
      build();
    }
  });
}

const watcher = chokidar.watch(["content", "public/images"], {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
});

watcher.on("all", (event, file) => {
  console.log(`[content] ${event}: ${file}`);
  build();
});

console.log("[content] watching content/ and public/images/");
