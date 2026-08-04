# Pokédex — Kanto (#1–151)

A static, dependency-free Pokédex covering the original 151 Pokémon, styled
as a physical handheld device: a color screen on the left shows the
Pokémon's artwork and name, and a monochrome LCD on the right shows its
dex readout (genus, height/weight, base stats, and flavor text). Search,
filter by type, or step through with Prev/Next (also works with the
arrow keys) — the filmstrip at the bottom tracks whatever's currently
selected.

## Data source

All data comes from [PokéAPI](https://pokeapi.co/), the same structured,
open-source database that powers most fan-made Pokédex apps. Rather than
scraping a wiki (which risks inaccurate/outdated data and violates most
wikis' terms of service), this project pulls directly from the CSV database
dump in the [PokeAPI/pokeapi](https://github.com/PokeAPI/pokeapi) GitHub
repo — the canonical source PokéAPI itself is built from.

Official artwork images are downloaded from
[PokeAPI/sprites](https://github.com/PokeAPI/sprites), PokéAPI's companion
image repository, and stored locally under `assets/artwork/` so the site
is self-contained and doesn't depend on hotlinking to GitHub at runtime.

Run `npm run build-data` to regenerate `data/pokemon.json` from the latest
upstream CSVs, and `npm run download-sprites` to re-download artwork.

## Running locally

This is a static site with no build step:

```
npm run serve
# then open http://localhost:8080
```

Or open `index.html` directly, or serve the folder with any static file
server.

## Design note

The device chrome (screens, stat bars, flavor text) commits to a single
dark studio-photography look rather than adapting to light/dark system
theme — the red plastic reads best against a dark, neutral backdrop
regardless of the viewer's OS setting.

## What's included per Pokémon

- National Dex number, name, and species genus (e.g. "Seed Pokémon")
- Type(s)
- Base stats: HP, Attack, Defense, Sp. Atk, Sp. Def, Speed, and total
- Height, weight, capture rate
- Official artwork
- Pokédex flavor text (from Pokémon Red)

## Attribution

Pokémon and Pokémon character names are trademarks of Nintendo/Creatures
Inc./GAME FREAK inc. This is a fan project for educational purposes.
