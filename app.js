const STAT_LABELS = [
  ["hp", "HP"],
  ["attack", "ATTACK"],
  ["defense", "DEFENSE"],
  ["special_attack", "SP.ATK"],
  ["special_defense", "SP.DEF"],
  ["speed", "SPEED"],
];
const MAX_STAT = 180;
const PAGE = 10;

const searchInput = document.getElementById("search");
const typeFilter = document.getElementById("type-filter");
const resultCount = document.getElementById("result-count");
const infoScreen = document.getElementById("info-screen");
const hint = document.getElementById("hint");
const btnPlay = document.getElementById("btn-play");
const btnRandom = document.getElementById("btn-random");
const btnMode = document.getElementById("btn-mode");
const dpad = document.querySelector(".dpad");

let allPokemon = [];
let filtered = [];
let currentId = null;
let audio = null;
let listMode = false;

async function init() {
  const res = await fetch("data/pokemon.json");
  allPokemon = await res.json();
  currentId = allPokemon[0].id;

  populateTypeFilter();
  applyFilters();

  searchInput.addEventListener("input", () => applyFilters());
  typeFilter.addEventListener("change", () => applyFilters());
  btnPlay.addEventListener("click", playEntry);
  btnRandom.addEventListener("click", pickRandom);
  btnMode.addEventListener("click", toggleMode);

  dpad.addEventListener("click", (e) => {
    const arm = e.target.closest(".dpad-arm");
    if (arm) step(deltaFor(arm.dataset.dir));
  });

  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "SELECT") {
      if (e.key === "Enter" && tag === "INPUT") jumpToFirstMatch();
      return;
    }
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

// In a list the vertical axis steps one row; reading an entry, the
// horizontal axis is the natural page-turn. The other axis jumps ten.
function deltaFor(dir) {
  if (listMode) {
    return { up: -1, down: 1, left: -PAGE, right: PAGE }[dir];
  }
  return { left: -1, right: 1, up: -PAGE, down: PAGE }[dir];
}

function populateTypeFilter() {
  const types = new Set();
  allPokemon.forEach((p) => p.types.forEach((t) => types.add(t)));
  [...types].sort().forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeFilter.appendChild(opt);
  });
}

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const type = typeFilter.value;

  filtered = allPokemon.filter((p) => {
    const matchesQuery =
      !query ||
      p.name.toLowerCase().includes(query) ||
      String(p.id).padStart(3, "0").includes(query) ||
      String(p.id) === query;
    const matchesType = !type || p.types.includes(type);
    return matchesQuery && matchesType;
  });

  if (!filtered.some((p) => p.id === currentId) && filtered.length) {
    currentId = filtered[0].id;
  }

  resultCount.textContent = `${filtered.length} of ${allPokemon.length} Pokémon`;
  render();
}

function jumpToFirstMatch() {
  if (!filtered.length) return;
  currentId = filtered[0].id;
  render();
}

function step(delta) {
  if (!filtered.length || !delta) return;
  const idx = filtered.findIndex((p) => p.id === currentId);
  const from = idx === -1 ? 0 : idx;
  // Wrap at both ends so the D-pad never dead-ends.
  const next = (((from + delta) % filtered.length) + filtered.length) % filtered.length;
  currentId = filtered[next].id;
  render();
}

function pickRandom() {
  if (filtered.length < 2) return;
  let next = currentId;
  while (next === currentId) {
    next = filtered[Math.floor(Math.random() * filtered.length)].id;
  }
  currentId = next;
  render();
}

function toggleMode() {
  listMode = !listMode;
  btnMode.textContent = listMode ? "Entry" : "List";
  render();
}

function stopAudio() {
  if (audio) {
    audio.pause();
    audio = null;
  }
  btnPlay.classList.remove("playing");
}

function playEntry() {
  // A second press while playing stops it rather than overlapping.
  if (audio && !audio.paused) {
    stopAudio();
    return;
  }
  stopAudio();
  audio = new Audio(`assets/audio/${currentId}.mp3`);
  btnPlay.classList.add("playing");
  audio.addEventListener("ended", stopAudio);
  audio.addEventListener("error", stopAudio);
  audio.play().catch(stopAudio);
}

function bar(value) {
  const width = 16;
  const filledCount = Math.max(1, Math.round((value / MAX_STAT) * width));
  return "█".repeat(Math.min(width, filledCount)) + "░".repeat(Math.max(0, width - filledCount));
}

function render() {
  const p = allPokemon.find((x) => x.id === currentId);
  if (!p) return;

  stopAudio();
  renderLid(p);
  if (listMode) renderList();
  else renderEntry(p);
  renderHint();
}

function renderLid(p) {
  document.getElementById("mon-image").src = p.sprites.official_artwork;
  document.getElementById("mon-image").alt = p.name;
  document.getElementById("mon-name").textContent = p.name;
  document.getElementById("mon-genus").textContent = p.genus;
  document.getElementById("type-plate").textContent = p.types.join(" / ");
  document.getElementById("dex-plate").textContent =
    `No.${String(p.id).padStart(3, "0")}`;

  document.getElementById("mini-lcd").innerHTML = [
    `No.${String(p.id).padStart(3, "0")}  ${p.name.toUpperCase()}`,
    `HT ${p.height_m.toFixed(1)}m  WT ${p.weight_kg.toFixed(1)}kg`,
    `CATCH RATE ${p.capture_rate}`,
    `TOTAL ${p.stats.total}`,
  ]
    .map((line) => `<div>${line}</div>`)
    .join("");
}

// Genus and height/weight live on the lid screen and the green readout,
// so this screen carries only what those can't fit.
function renderEntry(p) {
  const lines = [];
  lines.push(`<div class="info-heading">Base Stats</div>`);
  for (const [key, label] of STAT_LABELS) {
    const val = p.stats[key];
    lines.push(
      `<div class="stat-line"><span>${label}</span><span class="stat-bar">${bar(val)}</span><span class="stat-val">${val}</span></div>`
    );
  }
  lines.push(
    `<div class="stat-line"><span>TOTAL</span><span></span><span class="stat-val">${p.stats.total}</span></div>`
  );

  lines.push(`<div class="info-heading">Pokédex Data</div>`);
  lines.push(`<div class="flavor">${p.flavor_text}<span class="cursor"></span></div>`);

  infoScreen.innerHTML = lines.join("");
  infoScreen.scrollTop = 0;
}

function renderList() {
  if (!filtered.length) {
    infoScreen.innerHTML = `<p class="list-empty">No Pokémon match your search.</p>`;
    return;
  }

  infoScreen.innerHTML =
    `<div class="dex-list">` +
    filtered
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
  hint.innerHTML = listMode
    ? `D-pad: <kbd>↑</kbd> <kbd>↓</kbd> move · <kbd>←</kbd> <kbd>→</kbd> jump ten · white key returns to the entry`
    : `D-pad: <kbd>←</kbd> <kbd>→</kbd> step · <kbd>↑</kbd> <kbd>↓</kbd> jump ten · white key opens the list · black button narrates`;
}

init();
