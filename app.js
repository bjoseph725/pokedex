const PAGE = 10;

const searchInput = document.getElementById("search");
const typeFilter = document.getElementById("type-filter");
const resultCount = document.getElementById("result-count");
const infoScreen = document.getElementById("info-screen");
const hint = document.getElementById("hint");
const btnPlay = document.getElementById("btn-play");
const btnRandom = document.getElementById("btn-random");
const btnData = document.getElementById("btn-data");
const btnList = document.getElementById("btn-list");
const lamp = document.getElementById("lamp");
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
  btnData.addEventListener("click", () => setMode(false));
  btnList.addEventListener("click", () => setMode(true));

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

// Same in both modes so the D-pad never changes meaning underfoot.
function deltaFor(dir) {
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

function setMode(wantList) {
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
  renderHint();
}

function renderLid(p) {
  document.getElementById("mon-image").src = p.sprites.official_artwork;
  document.getElementById("mon-image").alt = p.name;
  document.getElementById("mon-name").textContent = p.name;
  document.getElementById("mon-genus").textContent = p.genus;
  document.getElementById("mon-dexno").textContent =
    `No.${String(p.id).padStart(3, "0")}`;

  // One type per box; the second sits dark when there isn't one.
  const box2 = document.getElementById("type-2");
  document.getElementById("type-1").textContent = p.types[0] ?? "";
  box2.textContent = p.types[1] ?? "";
  box2.classList.toggle("empty", !p.types[1]);

  const s = p.stats;
  document.getElementById("stats-lcd").innerHTML = `
    <div class="stat-grid">
      <span>HP</span><span class="v">${s.hp}</span>
      <span>SP.ATK</span><span class="v">${s.special_attack}</span>
      <span>ATTACK</span><span class="v">${s.attack}</span>
      <span>SP.DEF</span><span class="v">${s.special_defense}</span>
      <span>DEFENSE</span><span class="v">${s.defense}</span>
      <span>SPEED</span><span class="v">${s.speed}</span>
    </div>
    <div class="stat-total"><span>TOTAL</span><span>${s.total}</span></div>
  `;
}

// Stats live on the green readout now, so this screen carries the
// description and the measurements that don't fit there.
function renderEntry(p) {
  infoScreen.innerHTML = `
    <div class="info-heading">Pokédex Data</div>
    <div class="flavor">${p.flavor_text}<span class="cursor"></span></div>
    <div class="info-line meta">HT ${p.height_m.toFixed(1)} m &nbsp; WT ${p.weight_kg.toFixed(1)} kg</div>
  `;
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
  hint.innerHTML =
    `D-pad: <kbd>←</kbd> <kbd>→</kbd> step · <kbd>↑</kbd> <kbd>↓</kbd> jump ten · ` +
    `<b>Data</b> / <b>List</b> switch the screen · ▶ narrates · ` +
    `yellow is random`;
}

init();
