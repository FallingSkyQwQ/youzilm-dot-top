import fs from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const out = path.join(root, "admin/public");
await fs.mkdir(out, { recursive: true });
await fs.copyFile(path.join(root, "public/favicon.png"), path.join(out, "favicon.png"));
await fs.copyFile(path.join(root, "node_modules/katex/dist/katex.min.css"), path.join(out, "katex.css"));
await fs.cp(path.join(root, "node_modules/katex/dist/fonts"), path.join(out, "fonts"), { recursive: true });
console.log("[admin] assets ready");
