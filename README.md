# Pokédex — Kanto (#1–151)

A static, dependency-free Pokédex covering the original 151 Pokémon, styled
as a physical handheld device. The lid holds a color screen showing the
Pokémon's number, name, artwork, and genus, with a green readout below it
carrying the base stats. The base — narrower and hanging lower, as on the
real casing — shows the description, with one type per black plate.

## Controls

| Control | Does |
| --- | --- |
| D-pad ← → | Step one Pokémon |
| D-pad ↑ ↓ | Jump ten |
| Data key | Show the description on the right screen |
| List key | Show the selectable name list |
| ▶ button | Narrate the entry |
| Yellow button | Random Pokémon |
| Arrow keys / space | Mirror the D-pad and the ▶ button |

The D-pad means the same thing in both screen modes, and wraps at both
ends so it never dead-ends. In list mode you can also click a row
directly. Search and the type filter narrow whatever the D-pad steps
through.

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

## Icons

The favicon and home-screen icons are drawn as vectors in
`assets/icon/` — the casing front-on, with its lens, indicator lamps,
and screen. `npm run build-icons` rasterises them into every size
browsers ask for (`favicon.ico`, `apple-touch-icon.png`, and the PNGs
referenced by `site.webmanifest`) using the local Chromium; set
`CHROME_PATH` if yours lives somewhere unusual.

There are two sources. `icon.svg` has rounded corners and a transparent
surround for browser tabs. `icon-apple.svg` is full-bleed with the
artwork inset, because iOS masks its own corners and renders any
transparency as black.

## Narrated entries

Pressing the red button on the device narrates the current Pokémon's
entry — its name, then its Pokédex text. The clips live in
`assets/audio/{id}.mp3` and were generated with text-to-speech.

To regenerate them you need your own ElevenLabs API key, passed through
the environment (never commit a key):

```
ELEVENLABS_API_KEY=your_key npm run generate-audio
```

Optional overrides: `ELEVENLABS_VOICE_ID` to change the narrator, and
`ELEVENLABS_MODEL_ID` to change the model. The script skips any file
that already exists, so an interrupted run resumes without re-spending
credits.

## Running locally

This is a static site with no build step:

```
npm run serve
# then open http://localhost:8080
```

Or open `index.html` directly, or serve the folder with any static file
server.

## Design note

The device chrome commits to a single dark studio-photography look
rather than adapting to light/dark system theme — the red plastic reads
best against a dark, neutral backdrop regardless of the viewer's OS
setting.

Both screens are fixed height so the device never changes size as you
page through, and each screen scrolls internally if content ever
outgrows it. Screen heights are set from the tallest content measured
across all 151 at each breakpoint.

Moving the selection scrolls the screen's own `scrollTop` rather than
calling `scrollIntoView`, which walks up the tree and drags the page
with it on mobile.

## What's included per Pokémon

- National Dex number, name, and species genus (e.g. "Seed Pokémon")
- Type(s)
- Base stats: HP, Attack, Defense, Sp. Atk, Sp. Def, Speed, and total
- Height, weight, capture rate
- Official artwork
- Pokédex flavor text (from Pokémon Red)
- A narrated audio clip of the entry

## Attribution

Pokémon and Pokémon character names are trademarks of Nintendo/Creatures
Inc./GAME FREAK inc. This is a fan project for educational purposes.
