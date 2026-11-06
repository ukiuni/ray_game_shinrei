import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { createHash } from "node:crypto";
const mapping = JSON.parse(await readFile(process.argv[2], "utf8"));
if (mapping.length !== 100) throw Error("Expected 100 generated images");
const positions = JSON.parse(
  await readFile(new URL("./photo-targets.json", import.meta.url), "utf8"),
);
await mkdir("public/photos", { recursive: true });
const photos = [],
  hashes = new Set();
for (const { i, path } of mapping.sort((a, b) => a.i - b.i)) {
  const id = i + 1,
    src = `photos/${String(id).padStart(3, "0")}.webp`;
  const data = await sharp(path)
    .resize(1200, 800, { fit: "fill" })
    .webp({ quality: 82, effort: 5 })
    .toBuffer();
  const hash = createHash("sha256").update(data).digest("hex");
  if (hashes.has(hash)) throw Error("Duplicate generated photo " + id);
  hashes.add(hash);
  await writeFile("public/" + src, data);
  const [x, y] = positions[i];
  photos.push({ id, src, target: { x, y, rx: 0.085, ry: 0.13 } });
}
await writeFile("public/photos.json", JSON.stringify(photos, null, 2) + "\n");
console.log(`Imported ${photos.length} unique generated photos.`);
