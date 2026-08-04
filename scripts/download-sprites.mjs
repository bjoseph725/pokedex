// Downloads official artwork for Pokemon #1-151 from PokeAPI's sprites repo
// into assets/artwork/, so the site works without hotlinking to GitHub at
// runtime. Re-run with: node scripts/download-sprites.mjs
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/";
const OUT_DIR = path.join(__dirname, "..", "assets", "artwork");
const COUNT = 151;
const CONCURRENCY = 8;

async function downloadOne(id) {
  const url = `${SPRITE_BASE}${id}.png`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch #${id}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(OUT_DIR, `${id}.png`), buf);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const ids = Array.from({ length: COUNT }, (_, i) => i + 1);
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < ids.length) {
      const id = ids[next++];
      await downloadOne(id);
      done++;
      process.stdout.write(`\rDownloaded ${done}/${ids.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\nSaved ${done} images to assets/artwork/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
