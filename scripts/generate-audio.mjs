// Generates narrated Pokedex entries for #1-151 via the ElevenLabs API,
// saving to assets/audio/{id}.mp3. Each clip is the Pokemon's name
// followed by its Pokedex entry.
//
// Requires an API key in the environment (never commit one):
//   ELEVENLABS_API_KEY=sk_... node scripts/generate-audio.mjs
//
// Optional overrides:
//   ELEVENLABS_VOICE_ID   voice to narrate with
//   ELEVENLABS_MODEL_ID   defaults to eleven_multilingual_v2
//
// Existing files are skipped, so an interrupted run can be resumed
// without spending credits on clips already generated.
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "assets", "audio");
const DATA_PATH = path.join(__dirname, "..", "data", "pokemon.json");

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "hJsO2TX0TWQT6jRy8wsp";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const CONCURRENCY = 3;
const MAX_RETRIES = 4;

if (!API_KEY) {
  console.error(
    "ELEVENLABS_API_KEY is not set.\n" +
      "Usage: ELEVENLABS_API_KEY=sk_... node scripts/generate-audio.mjs"
  );
  process.exit(1);
}

/* Some names get read the wrong way round — text to speech goes by
   spelling, so respelling the spoken line is the lever. Keyed by dex
   number; only affects narration, never the displayed name. */
const SAID_AS = {
  116: "Horsey", // otherwise "horss-uh" rather than "horsey"
};

function narrationFor(p) {
  // The Gen 1 source text spells it "POKéMON"; say it properly instead.
  const entry = p.flavor_text.replace(/POK[eé]MON/gi, "Pokémon");
  return `${SAID_AS[p.id] ?? p.name}. ${entry}`;
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function synthesize(text) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
    }
  );
  if (!res.ok) {
    const detail = await res.text();
    const err = new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return Buffer.from(await res.arrayBuffer());
}

async function generateOne(p) {
  const outFile = path.join(OUT_DIR, `${p.id}.mp3`);
  if (await exists(outFile)) return "skipped";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const audio = await synthesize(narrationFor(p));
      await writeFile(outFile, audio);
      return "written";
    } catch (err) {
      // 4xx other than rate-limiting won't succeed on retry.
      if (err.status && err.status !== 429 && err.status < 500) throw err;
      if (attempt === MAX_RETRIES) throw err;
      const backoff = 2 ** attempt * 1000;
      console.warn(`  #${p.id} ${p.name}: ${err.message} — retrying in ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}

async function main() {
  const pokemon = JSON.parse(await readFile(DATA_PATH, "utf8"));
  await mkdir(OUT_DIR, { recursive: true });

  let next = 0;
  let written = 0;
  let skipped = 0;
  const failures = [];

  async function worker() {
    while (next < pokemon.length) {
      const p = pokemon[next++];
      try {
        const result = await generateOne(p);
        if (result === "written") written++;
        else skipped++;
      } catch (err) {
        failures.push({ id: p.id, name: p.name, error: err.message });
        console.error(`  #${p.id} ${p.name} FAILED: ${err.message}`);
      }
      const done = written + skipped + failures.length;
      process.stdout.write(`\r${done}/${pokemon.length} (${written} new, ${skipped} cached)`);
    }
  }

  console.log(`Narrating ${pokemon.length} entries with voice ${VOICE_ID}...`);
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\nDone: ${written} generated, ${skipped} already present.`);
  if (failures.length) {
    console.error(`${failures.length} failed:`);
    failures.forEach((f) => console.error(`  #${f.id} ${f.name}: ${f.error}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
