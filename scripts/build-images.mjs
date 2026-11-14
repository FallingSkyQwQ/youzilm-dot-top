#!/usr/bin/env node
/**
 * Generate the site icons from assets/icon.png (the old 哈气.xyz icon),
 * plus a text-only Open Graph image. There is no portrait/avatar on the site.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import toIco from "png-to-ico";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "assets", "icon.png");

function monogram(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#111111"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(size * 0.62)}" fill="#ffffff">y</text>
</svg>`;
}

async function iconPng(size) {
  const image = fs.existsSync(SOURCE)
    ? sharp(SOURCE).resize(size, size, { fit: "cover" })
    : sharp(Buffer.from(monogram(size)));
  return image.png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  await sharp(await iconPng(512)).toFile(path.join(ROOT, "public", "icon-512.png"));
  await sharp(await iconPng(192)).toFile(path.join(ROOT, "public", "icon-192.png"));
  await sharp(await iconPng(180)).toFile(path.join(ROOT, "public", "apple-icon.png"));
  await sharp(await iconPng(32)).toFile(path.join(ROOT, "public", "favicon.png"));

  const icon16 = await iconPng(16);
  const icon32 = await iconPng(32);
  await fs.promises.writeFile(
    path.join(ROOT, "public", "favicon.ico"),
    await toIco([icon16, icon32]),
  );

  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <text x="80" y="120" fill="#444444" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="18" letter-spacing="4">EST. 2026</text>
  <text x="78" y="286" fill="#2f4f4f" font-family="Georgia, 'Times New Roman', serif" font-size="108" letter-spacing="-2">youzilm</text>
  <text x="80" y="356" fill="#000000" font-family="Georgia, 'Times New Roman', serif" font-size="34">写代码，也写字。</text>
  <text x="80" y="398" fill="#444444" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="18" letter-spacing="1">youzilm.top</text>
  <line x1="80" y1="462" x2="1120" y2="462" stroke="#b8b8b8" stroke-width="1"/>
  <text x="80" y="506" fill="#444444" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="17">notes on code, projects, and everything else</text>
  <text x="1120" y="570" text-anchor="end" fill="#444444" font-family="Georgia, 'Times New Roman', serif" font-size="16">柚子的blog</text>
</svg>`;

  await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(path.join(ROOT, "public", "og.png"));

  console.log(
    `[images] site icons generated from ${fs.existsSync(SOURCE) ? "assets/icon.png" : "monogram"}; text-only og.png generated`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
