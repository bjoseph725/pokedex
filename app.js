const PAGE = 10;

const infoScreen = document.getElementById("info-screen");
const hint = document.getElementById("hint");
const btnPlay = document.getElementById("btn-play");
const btnRandom = document.getElementById("btn-random");
const btnData = document.getElementById("btn-data");
const btnList = document.getElementById("btn-list");
const lamp = document.getElementById("lamp");
const dpad = document.querySelector(".dpad");
const favs = document.getElementById("favs");
const btnSave = document.getElementById("btn-save");
const btnReset = document.getElementById("btn-reset");

const FAV_SLOTS = 10;
const FAV_KEY = "pokedex.favourites";

let allPokemon = [];
let currentId = null;
let audio = null;
let listMode = false;
let favourites = new Array(FAV_SLOTS).fill(null);
let arming = false;

async function init() {
  const res = await fetch("data/pokemon.json");
  allPokemon = await res.json();
  currentId = allPokemon[0].id;
  loadFavourites();
  setupHaptics();
  render();
  renderFavourites();

  btnSave.addEventListener("click", toggleArming);
  btnReset.addEventListener("click", clearFavourites);

  favs.addEventListener("click", (e) => {
    const slot = e.target.closest(".fav");
    if (slot) useSlot(Number(slot.dataset.slot));
  });

  btnPlay.addEventListener("click", playEntry);
  btnRandom.addEventListener("click", pickRandom);
  btnData.addEventListener("click", () => setMode(false));
  btnList.addEventListener("click", () => setMode(true));

  dpad.addEventListener("click", (e) => {
    const arm = e.target.closest(".arm");
    if (!arm) return;
    clickSound();
    tap();
    step(deltaFor(arm.dataset.dir));
  });

  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    // Let Enter/Space work normally on whichever control has focus.
    if (tag === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;

    const dirs = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    };
    if (e.key in dirs) {
      e.preventDefault();
      step(deltaFor(dirs[e.key]));
    } else if (e.key === " ") {
      e.preventDefault();
      playEntry();
    }
  });
}

// Same in both modes so the D-pad never changes meaning underfoot.
function deltaFor(dir) {
  return { left: -1, right: 1, up: -PAGE, down: PAGE }[dir];
}

/* ---------- Button sounds ----------
   Synthesised rather than shipped as files: nothing to download, and
   they start instantly. The context is created on first press, which
   is the user gesture browsers require. */

/* iOS puts Web Audio in the "ambient" session, which the ringer switch
   silences outright — volume makes no difference. Playing a media
   element moves the page into the "playback" session, where it isn't.
   A tenth of a second of true silence, looping, is enough.

   Only the controls that exist to produce sound call this. A phone set
   to silent shouldn't click at you for pressing a D-pad; it's fair game
   once you've asked for narration or music. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YS" +
  "ADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" +
  "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" +
  "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" +
  "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" +
  "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" +
  "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" +
  "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" +
  "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" +
  "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" +
  "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" +
  "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" +
  "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" +
  "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" +
  "CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI" +
  "CAgICAgA==";

let silentLoop = null;

function allowSoundThroughRinger() {
  if (silentLoop) return;
  try {
    silentLoop = document.createElement("audio");
    silentLoop.src = SILENT_WAV;
    silentLoop.loop = true;
    silentLoop.preload = "auto";
    // Inline, or iOS may try to take it fullscreen.
    silentLoop.setAttribute("playsinline", "");
    // Genuinely silent content, so full volume costs nothing — a muted
    // or zero-volume element may not move the session at all.
    silentLoop.volume = 1;
    // Attached rather than detached: iOS is less reliable about
    // honouring a media element that isn't in the document.
    silentLoop.style.display = "none";
    document.body.appendChild(silentLoop);
    silentLoop.play().catch(() => {
      silentLoop.remove();
      silentLoop = null; // blocked; the rest still works, just quieter
    });
  } catch {
    silentLoop = null;
  }
}

/* ---------- Haptics ----------
   Android exposes the Vibration API. iOS Safari never has, so the only
   lever there is a side effect: toggling a switch control makes iOS
   fire its own system haptic. That needs 17.4 or newer, and obeys
   Settings > Sounds & Haptics, which is the right place for the user
   to turn it off. */

let hapticSwitch = null;

function setupHaptics() {
  if (navigator.vibrate) return; // real API available; no trick needed
  if (!("switch" in HTMLInputElement.prototype)) return; // pre-17.4
  const el = document.createElement("input");
  el.type = "checkbox";
  el.setAttribute("switch", "");
  el.setAttribute("aria-hidden", "true");
  el.tabIndex = -1;
  el.style.cssText =
    "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(el);
  hapticSwitch = el;
}

// Called from the press handlers, so it stays inside the user gesture
// iOS requires.
function tap(pattern = 8) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
    else hapticSwitch?.click();
  } catch {
    // Blocked or unsupported: silence beats a broken button.
  }
}

let actx = null;

function audioCtx() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!actx) {
    actx = new Ctor();
    // iOS keeps a context muted until something has actually been
    // played through it, so start one silent sample to open it up.
    try {
      const src = actx.createBufferSource();
      src.buffer = actx.createBuffer(1, 1, 22050);
      src.connect(actx.destination);
      src.start(0);
    } catch {
      // Not fatal: the context still works for everything else.
    }
  }
  // Must happen inside the gesture that called us — iOS won't grant
  // this across an await.
  if (actx.state === "suspended") actx.resume();
  return actx;
}

let noiseBuffer = null;

// A real button click is broadband noise, not a tone, so the body of
// this is a decaying noise burst; the buffer is built once and reused.
function getNoise(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = Math.floor(ctx.sampleRate * 0.04);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return noiseBuffer;
}

// Band-passed noise for the tick, over a low sine for the weight. Both
// ramp in over a few ms — an instant start is what makes a click snap.
function clickSound() {
  const ctx = audioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1100;
  band.Q.value = 0.9;
  const tick = ctx.createGain();
  tick.gain.setValueAtTime(0.0001, t);
  tick.gain.exponentialRampToValueAtTime(0.16, t + 0.003);
  tick.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  src.connect(band).connect(tick).connect(ctx.destination);

  const osc = ctx.createOscillator();
  const body = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, t);
  body.gain.setValueAtTime(0.0001, t);
  body.gain.exponentialRampToValueAtTime(0.09, t + 0.004);
  body.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  osc.connect(body).connect(ctx.destination);

  src.start(t);
  osc.start(t);
  osc.stop(t + 0.06);
}

// Rising three-note arpeggio for a favourite being stored.
function chimeSound() {
  const ctx = audioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  [784, 988, 1319].forEach((freq, i) => {
    const at = t + i * 0.075;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.15, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.38);
  });
}

/* ---------- Favourites ----------
   Held in localStorage: per-browser, no backend, and the site stays
   static. Slots hold a dex number or null. */

function loadFavourites() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(FAV_KEY) || "null");
  } catch {
    stored = null; // corrupt or unavailable; start empty rather than throw
  }
  favourites = new Array(FAV_SLOTS).fill(null);
  if (Array.isArray(stored)) {
    stored.slice(0, FAV_SLOTS).forEach((id, i) => {
      // Ignore anything that isn't one of the 151.
      if (allPokemon.some((p) => p.id === id)) favourites[i] = id;
    });
  }
}

function saveFavourites() {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(favourites));
  } catch {
    // Private mode or a full quota: keep the in-memory copy working.
  }
}

function renderFavourites() {
  favs.classList.toggle("arming", arming);
  [...favs.querySelectorAll(".fav")].forEach((slot, i) => {
    const id = favourites[i];
    const p = id == null ? null : allPokemon.find((x) => x.id === id);
    const label = slot.querySelector(".label");
    const img = slot.querySelector("img");

    if (p) {
      if (!img) {
        const el = document.createElement("img");
        el.alt = "";
        el.loading = "lazy";
        el.src = p.sprites.official_artwork;
        slot.prepend(el);
      } else if (!img.src.endsWith(p.sprites.official_artwork)) {
        img.src = p.sprites.official_artwork;
      }
      label.textContent = arming
        ? `Save ${nameOf(currentId)} to slot ${i + 1}, replacing ${p.name}`
        : `${p.name}, favourite slot ${i + 1}`;
    } else {
      img?.remove();
      label.textContent = arming
        ? `Save ${nameOf(currentId)} to empty slot ${i + 1}`
        : `Empty favourite slot ${i + 1}`;
    }
  });
}

function nameOf(id) {
  return allPokemon.find((p) => p.id === id)?.name ?? "";
}

function toggleArming() {
  clickSound();
  tap();
  arming = !arming;
  btnSave.setAttribute("aria-pressed", String(arming));
  renderFavourites();
  renderHint();
}

// Armed, a slot stores the current Pokémon; otherwise it jumps to it.
function useSlot(i) {
  if (arming) {
    favourites[i] = currentId;
    saveFavourites();
    arming = false;
    btnSave.setAttribute("aria-pressed", "false");
    chimeSound();
    tap([12, 40, 18]);
    renderFavourites();
    renderHint();
    return;
  }
  const id = favourites[i];
  if (id == null) return; // empty slot: nothing to recall, so no sound
  clickSound();
  tap();
  currentId = id;
  render();
}

function clearFavourites() {
  clickSound();
  tap();
  if (favourites.every((f) => f == null)) return;
  favourites = new Array(FAV_SLOTS).fill(null);
  saveFavourites();
  arming = false;
  btnSave.setAttribute("aria-pressed", "false");
  renderFavourites();
  renderHint();
}

function step(delta) {
  if (!allPokemon.length || !delta) return;
  const idx = allPokemon.findIndex((p) => p.id === currentId);
  const from = idx === -1 ? 0 : idx;
  // Wrap at both ends so the D-pad never dead-ends.
  const next = (((from + delta) % allPokemon.length) + allPokemon.length) % allPokemon.length;
  currentId = allPokemon[next].id;
  render();
}

function pickRandom() {
  clickSound();
  tap();
  if (allPokemon.length < 2) return;
  let next = currentId;
  while (next === currentId) {
    next = allPokemon[Math.floor(Math.random() * allPokemon.length)].id;
  }
  currentId = next;
  render();
}

function setMode(wantList) {
  clickSound();
  tap();
  if (listMode === wantList) return;
  listMode = wantList;
  btnData.setAttribute("aria-pressed", String(!listMode));
  btnList.setAttribute("aria-pressed", String(listMode));
  render();
}

function stopAudio() {
  if (audio) {
    audio.pause();
    audio = null;
  }
  btnPlay.classList.remove("playing");
  lamp.classList.remove("lit");
}

function playEntry() {
  // A second press while playing stops it rather than overlapping.
  if (audio && !audio.paused) {
    stopAudio();
    return;
  }
  stopAudio();
  allowSoundThroughRinger();
  audio = new Audio(`assets/audio/${currentId}.mp3`);
  btnPlay.classList.add("playing");
  lamp.classList.add("lit");
  audio.addEventListener("ended", stopAudio);
  audio.addEventListener("error", stopAudio);
  audio.play().catch(stopAudio);
}

function render() {
  const p = allPokemon.find((x) => x.id === currentId);
  if (!p) return;

  stopAudio();
  renderLid(p);
  if (listMode) renderList();
  else renderEntry(p);
  // Slot labels name whichever Pokémon is about to be stored.
  if (arming) renderFavourites();
  renderHint();
}

function renderLid(p) {
  const num = `No.${String(p.id).padStart(3, "0")}`;
  document.getElementById("mon-image").src = p.sprites.official_artwork;
  document.getElementById("mon-image").alt = p.name;
  document.getElementById("mon-name").textContent = p.name;
  document.getElementById("mon-genus").textContent = p.genus;
  document.getElementById("mon-dexno").textContent = num;

  // One type per plate; the second reads empty when there isn't one.
  document.getElementById("type-1").textContent = p.types[0] ?? "";
  document.getElementById("type-2").textContent = p.types[1] ?? "";

  const s = p.stats;
  document.getElementById("stats-lcd").innerHTML = `
    <div class="stat-grid">
      <span>HP</span><span class="v">${s.hp}</span>
      <span>ATTACK</span><span class="v">${s.attack}</span>
      <span>DEFENSE</span><span class="v">${s.defense}</span>
      <span>SP.ATK</span><span class="v">${s.special_attack}</span>
      <span>SP.DEF</span><span class="v">${s.special_defense}</span>
      <span>SPEED</span><span class="v">${s.speed}</span>
    </div>
    <div class="stat-total"><span>TOTAL</span><span>${s.total}</span></div>
  `;
}

/* The source data is metric, since that's how PokeAPI stores it. These
   convert at display time so the stored values stay canonical. Rounding
   inches can reach 12, which carries into the next foot. */

function toFeetInches(metres) {
  const totalInches = Math.round(metres * 39.3701);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${String(inches).padStart(2, "0")}"`;
}

function toPounds(kg) {
  return (kg * 2.20462).toFixed(1);
}

// Stats live on the green readout, so this screen carries the
// description and the measurements that don't fit there.
function renderEntry(p) {
  infoScreen.innerHTML = `
    <div class="info-heading">Pokédex Data</div>
    <div class="flavor">${p.flavor_text}<span class="cursor"></span></div>
    <div class="meta">HT ${toFeetInches(p.height_m)} &nbsp; WT ${toPounds(p.weight_kg)} lbs</div>
  `;
  infoScreen.scrollTop = 0;
}

function renderList() {
  if (!allPokemon.length) {
    infoScreen.innerHTML = `<p class="list-empty">No entries.</p>`;
    return;
  }

  infoScreen.innerHTML =
    `<div class="dex-list">` +
    allPokemon
      .map(
        (p) => `
        <button type="button" class="dex-row" data-id="${p.id}" aria-current="${p.id === currentId}">
          <span class="num">${String(p.id).padStart(3, "0")}</span>
          <span>${p.name.toUpperCase()}</span>
        </button>`
      )
      .join("") +
    `</div>`;

  infoScreen.querySelectorAll(".dex-row").forEach((row) => {
    row.addEventListener("click", () => {
      currentId = Number(row.dataset.id);
      render();
    });
  });

  keepSelectedRowVisible();
}

// Scroll the screen itself rather than calling scrollIntoView, which
// walks up and scrolls ancestors (and on mobile, the page with it).
function keepSelectedRowVisible() {
  const row = infoScreen.querySelector('.dex-row[aria-current="true"]');
  if (!row) return;
  const top = row.offsetTop;
  const bottom = top + row.offsetHeight;
  const viewTop = infoScreen.scrollTop;
  const viewBottom = viewTop + infoScreen.clientHeight;

  if (top < viewTop) infoScreen.scrollTop = top;
  else if (bottom > viewBottom) infoScreen.scrollTop = bottom - infoScreen.clientHeight;
}

function renderHint() {
  hint.innerHTML = arming
    ? `Pick a blue key to save <b>${nameOf(currentId)}</b> — press <b>Save</b> again to cancel`
    : `D-pad: <kbd>←</kbd> <kbd>→</kbd> step · <kbd>↑</kbd> <kbd>↓</kbd> jump ten · ` +
      `<b>Data</b> / <b>List</b> switch the screen · ▶ narrates · yellow is random · ` +
      `<b>Save</b> then a blue key stores a favourite`;
}

init();
