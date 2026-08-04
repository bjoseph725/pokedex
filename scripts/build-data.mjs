// Builds data/pokemon.json for the first 151 Pokemon using the official
// PokeAPI database CSVs (the same source data that powers pokeapi.co),
// fetched directly from the PokeAPI GitHub repo. Re-run with:
//   node scripts/build-data.mjs
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_BASE =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";
// Artwork is downloaded locally by scripts/download-sprites.mjs into
// assets/artwork/{id}.png so the site doesn't depend on hotlinking.
const LOCAL_ARTWORK_PATH = "assets/artwork/";
const GEN1_COUNT = 151;
const ENGLISH_LANGUAGE_ID = "9";
const FLAVOR_VERSION_ID = "1"; // "red"
const STAT_NAMES = {
  1: "hp",
  2: "attack",
  3: "defense",
  4: "special-attack",
  5: "special-defense",
  6: "speed",
};

async function fetchCsv(name) {
  const res = await fetch(RAW_BASE + name);
  if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}

// Minimal RFC4180 CSV parser (handles quoted fields with commas/newlines).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows[0];
  return rows
    .slice(1)
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx]])));
}

async function main() {
  console.log("Fetching PokeAPI CSV data...");
  const [
    pokemon,
    pokemonStats,
    species,
    speciesNames,
    typeNames,
    pokemonTypes,
    flavorText,
  ] = await Promise.all([
    fetchCsv("pokemon.csv"),
    fetchCsv("pokemon_stats.csv"),
    fetchCsv("pokemon_species.csv"),
    fetchCsv("pokemon_species_names.csv"),
    fetchCsv("type_names.csv"),
    fetchCsv("pokemon_types.csv"),
    fetchCsv("pokemon_species_flavor_text.csv"),
  ]);

  const typeNameById = new Map(
    typeNames
      .filter((t) => t.local_language_id === ENGLISH_LANGUAGE_ID)
      .map((t) => [t.type_id, t.name])
  );
  const speciesNameById = new Map(
    speciesNames
      .filter((s) => s.local_language_id === ENGLISH_LANGUAGE_ID)
      .map((s) => [s.pokemon_species_id, s])
  );
  const speciesById = new Map(species.map((s) => [s.id, s]));

  const flavorBySpecies = new Map();
  for (const f of flavorText) {
    if (f.language_id !== ENGLISH_LANGUAGE_ID) continue;
    if (!flavorBySpecies.has(f.species_id)) flavorBySpecies.set(f.species_id, f);
    if (f.version_id === FLAVOR_VERSION_ID)
      flavorBySpecies.set(f.species_id, f);
  }

  const statsByPokemon = new Map();
  for (const row of pokemonStats) {
    if (!statsByPokemon.has(row.pokemon_id))
      statsByPokemon.set(row.pokemon_id, {});
    const statName = STAT_NAMES[row.stat_id];
    if (statName) statsByPokemon.get(row.pokemon_id)[statName] = Number(row.base_stat);
  }

  const typesByPokemon = new Map();
  for (const row of pokemonTypes) {
    if (!typesByPokemon.has(row.pokemon_id))
      typesByPokemon.set(row.pokemon_id, []);
    typesByPokemon.get(row.pokemon_id).push({
      slot: Number(row.slot),
      name: typeNameById.get(row.type_id),
    });
  }

  const results = [];
  for (const p of pokemon) {
    const id = Number(p.id);
    if (id < 1 || id > GEN1_COUNT) continue;
    if (p.is_default !== "1") continue;

    const stats = statsByPokemon.get(p.id) || {};
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    const sp = speciesNameById.get(p.species_id);
    const spRow = speciesById.get(p.species_id);
    const flavor = flavorBySpecies.get(p.species_id);

    results.push({
      id,
      name: sp ? sp.name : capitalize(p.identifier),
      genus: sp ? sp.genus : null,
      height_m: Number(p.height) / 10,
      weight_kg: Number(p.weight) / 10,
      types: (typesByPokemon.get(p.id) || [])
        .sort((a, b) => a.slot - b.slot)
        .map((t) => t.name),
      stats: {
        hp: stats.hp ?? null,
        attack: stats.attack ?? null,
        defense: stats.defense ?? null,
        special_attack: stats["special-attack"] ?? null,
        special_defense: stats["special-defense"] ?? null,
        speed: stats.speed ?? null,
        total,
      },
      capture_rate: spRow ? Number(spRow.capture_rate) : null,
      flavor_text: flavor
        ? flavor.flavor_text.replace(/\f|\n|\r/g, " ").replace(/\s+/g, " ").trim()
        : null,
      sprites: {
        official_artwork: `${LOCAL_ARTWORK_PATH}${id}.png`,
      },
    });
  }

  results.sort((a, b) => a.id - b.id);

  if (results.length !== GEN1_COUNT) {
    throw new Error(`Expected ${GEN1_COUNT} pokemon, got ${results.length}`);
  }

  const outDir = path.join(__dirname, "..", "data");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "pokemon.json"),
    JSON.stringify(results, null, 2)
  );
  console.log(`Wrote ${results.length} pokemon to data/pokemon.json`);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
