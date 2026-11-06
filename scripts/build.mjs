import { rm, mkdir, cp, readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
await mkdir("public/icons", { recursive: true });
for (const [name, size] of [
  ["icon-192", 192],
  ["icon-512", 512],
  ["apple-touch-icon", 180],
])
  await sharp("public/icon.svg")
    .resize(size, size)
    .png()
    .toFile(`public/icons/${name}.png`);
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#101714" },
})
  .composite([
    {
      input: await sharp("public/icon.svg").resize(360).toBuffer(),
      left: 76,
      top: 76,
    },
  ])
  .png()
  .toFile("public/icons/maskable-512.png");
const photos = JSON.parse(await readFile("public/photos.json", "utf8"));
if (photos.length !== 100) throw Error("100 photos required");
for (const p of photos) {
  const m = await sharp("public/" + p.src).metadata();
  if (!m.width || !m.height) throw Error("Invalid photo " + p.id);
}
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
await cp("public", "dist", { recursive: true });
for (const f of ["index.html", "style.css", "app.js", "logic.js"])
  await cp(f, "dist/" + f);
async function walk(dir, prefix = "") {
  let a = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = prefix + e.name;
    if (e.isDirectory()) a.push(...(await walk(dir + "/" + e.name, p + "/")));
    else a.push("./" + p);
  }
  return a;
}
const assets = await walk("dist");
const hash = createHash("sha256");
for (const a of assets) hash.update(await readFile("dist/" + a.slice(2)));
const version = hash.digest("hex").slice(0, 16);
const template = await readFile("scripts/sw-template.js", "utf8");
await writeFile(
  "dist/sw.js",
  template
    .replace("__VERSION__", version)
    .replace("__ASSETS__", JSON.stringify(["./", ...assets])),
);
console.log(
  `Built ${photos.length} photos; ${assets.length} assets; version ${version}`,
);
