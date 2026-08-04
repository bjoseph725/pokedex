# Pokédex — Kanto (#1–151)

A static, dependency-free Pokédex covering the original 151 Pokémon, with
accurate base stats, types, and Pokédex flavor text.

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

## What's included per Pokémon

- National Dex number, name, and species genus (e.g. "Seed Pokémon")
- Type(s)
- Base stats: HP, Attack, Defense, Sp. Atk, Sp. Def, Speed, and total
- Height, weight, capture rate, legendary/mythical status
- Official artwork
- Pokédex flavor text (from Pokémon Red)

## Attribution

Pokémon and Pokémon character names are trademarks of Nintendo/Creatures
Inc./GAME FREAK inc. This is a fan project for educational purposes.
