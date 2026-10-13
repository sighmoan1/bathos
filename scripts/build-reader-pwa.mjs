import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve("out");
const html = await fs.readFile(path.join(root, "index.html"), "utf8");
const assets = new Set(["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-icon.png"]);
const postDirectories = await fs.readdir(path.join(root, "posts"), { withFileTypes: true }).catch(error => {
  if (error.code === "ENOENT") return [];
  throw error;
});
const pages = [html];
for (const directory of postDirectories.filter(entry => entry.isDirectory())) {
  assets.add(`/posts/${encodeURIComponent(directory.name)}/`);
  pages.push(await fs.readFile(path.join(root, "posts", directory.name, "index.html"), "utf8"));
}
for (const match of pages.join("\n").matchAll(/(?:src|href)="([^"?#]+)[^"]*"/g)) {
  if (match[1].startsWith("/_next/static/")) assets.add(match[1].replaceAll("&amp;", "&"));
}
for (const asset of [...assets].filter(asset => asset.endsWith(".css"))) {
  const css = await fs.readFile(path.join(root, asset), "utf8");
  for (const match of css.matchAll(/url\(["']?([^\)"']+)["']?\)/g)) {
    const url = new URL(match[1], "https://bathos.org" + asset);
    if (url.origin === "https://bathos.org" && url.pathname.startsWith("/_next/static/")) assets.add(url.pathname);
  }
}
const template = await fs.readFile("public/sw.js", "utf8");
const digest = createHash("sha256").update(template).update(html);
for (const asset of [...assets].sort()) {
  if (asset !== "/") digest.update(await fs.readFile(path.join(root, asset.endsWith("/") ? decodeURIComponent(asset) + "index.html" : asset)));
}
const sw = template.replace(/const CACHE_NAME = .*?;/, `const CACHE_NAME = "bathos-reader-${digest.digest("hex").slice(0, 16)}";`)
  .replace(/const PRECACHE = .*?;/, `const PRECACHE = ${JSON.stringify([...assets].sort())};`);
await fs.writeFile(path.join(root, "sw.js"), sw);
console.log(`Reader offline shell: ${assets.size} local assets.`);
