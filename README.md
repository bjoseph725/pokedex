# Pokédex — Kanto (#1–151)

A static, dependency-free Pokédex covering the original 151 Pokémon,
presented as a physical handheld device.

## How the device is built

The casing is a single vector drawing, `assets/device/pokedex.svg`. The
screens and controls are HTML positioned on top of it, so the artwork
carries the look and the DOM carries the behaviour.

Every overlay is placed in percentages taken from the drawing's own
geometry — each region's bounding box was measured in the browser
against its `viewBox` of 1448×1086 rather than eyeballed. Because the
coordinates are relative, the whole device scales as one piece. Text
inside the screens is sized in `cqw` units against the device
container, so labels scale with the casing instead of drifting out of
their screens.

The controls are real `<button>` elements laid over the drawn ones, so
keyboard focus and screen readers work normally; each carries a
visually hidden label.

The drawing is cropped into two halves — split at x=755, either side of
the hinge — that sit flush on wide screens and stack on narrow ones.
Each half is its own container with its own overlay coordinates, so
stacking needs no repositioning: the halves just go full width.

## Controls

| Control | Does |
| --- | --- |
| D-pad ← → | Step one Pokémon |
| D-pad ↑ ↓ | Jump ten |
| Data key | Show the description on the right screen |
| List key | Show the selectable name list |
| Black ▶ button | Narrate the entry |
| Yellow button | Random Pokémon |
| Save + a blue key | Store the current Pokémon in that slot |
| Reset | Clear every favourite |
| Arrow keys / space | Mirror the D-pad and the ▶ button |

The D-pad means the same thing in both screen modes, and wraps at both
ends so it never dead-ends. In list mode you can also click a row
directly.

## Music

The green indicator at the top of the lid toggles background music.
`music.js` is a small MIDI reader and a square-wave voice, so whatever
`.mid` sits at `assets/music/theme.mid` plays back in a chiptune
register that suits the casing. Notes are scheduled a quarter-second
ahead rather than all at once, which keeps a long track from building
hundreds of oscillators up front and lets it loop indefinitely.

The file is fetched at runtime rather than bundled, so swapping the
tune means swapping that one file. With no file present the control
simply stays off and the rest of the device is unaffected.

### Haptics

Presses buzz as well as click. Android exposes the Vibration API
directly; iOS Safari has never implemented it, so there the only lever
is a side effect — toggling a hidden switch control makes iOS fire its
own system haptic. That path needs iOS 17.4 or newer, and obeys
Settings → Sounds & Haptics, which is the right place to turn it off.
Where neither is available, presses simply stay silent.

Storing a favourite gets a double pulse so it feels different from a
step. Pressing an empty slot does nothing, so it buzzes nothing.

### The iOS ringer switch

iOS puts Web Audio in the "ambient" session, which the hardware mute
switch silences outright — volume makes no difference. Playing a media
element moves the page into the "playback" session, where it doesn't,
so a tenth of a second of true silence loops in the background.

Only narration and music start that loop. Pressing those is an explicit
request for sound, so overriding the switch is fair; a phone set to
silent shouldn't click at you for pressing a D-pad. Once either is
running the session is open, and the button sounds come along with it.

## Favourites

The ten blue keys are favourite slots. Press **Save**, then a blue key,
and the current Pokémon is stored there and shown as its artwork.
Pressing a filled key jumps straight to it; **Reset** clears them all.

They live in `localStorage`, so they persist per browser with no
backend and the site stays static. Nothing syncs between devices —
that would be the point at which a hosted database earned its place.

Presses are answered with synthesised sound rather than audio files:
a short blip for the D-pad, Save and Reset, and a three-note chime when
a favourite is stored. They are generated through the Web Audio API on
first press, so there is nothing to download.

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

The screens are fixed regions of the casing, so the device never
changes size as you page through; a screen scrolls internally if its
content outgrows it.

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
