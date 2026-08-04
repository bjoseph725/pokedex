const STAT_LABELS = [
  ["hp", "HP"],
  ["attack", "ATTACK"],
  ["defense", "DEFENSE"],
  ["special_attack", "SP.ATK"],
  ["special_defense", "SP.DEF"],
  ["speed", "SPEED"],
];
const MAX_STAT = 180;

const searchInput = document.getElementById("search");
const typeFilter = document.getElementById("type-filter");
const resultCount = document.getElementById("result-count");
const filmstrip = document.getElementById("filmstrip");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const btnPlay = document.getElementById("btn-play");

let allPokemon = [];
let filtered = [];
let currentId = null;
let audio = null;

async function init() {
  const res = await fetch("data/pokemon.json");
  allPokemon = await res.json();
  currentId = allPokemon[0].id;

  populateTypeFilter();
  applyFilters();

  searchInput.addEventListener("input", () => applyFilters());
  typeFilter.addEventListener("change", () => applyFilters());
  btnPrev.addEventListener("click", () => step(-1));
  btnNext.addEventListener("click", () => step(1));
  btnPlay.addEventListener("click", playEntry);

  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "SELECT") {
      if (e.key === "Enter" && tag === "INPUT") jumpToFirstMatch();
      return;
    }
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      playEntry();
    }
  });
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

  buildFilmstrip();
  updateResultCount();
  renderDevice();
}

function jumpToFirstMatch() {
  if (filtered.length) {
    currentId = filtered[0].id;
    renderDevice();
    highlightFilmstrip();
    scrollCurrentIntoView();
  }
}

function step(delta) {
  if (!filtered.length) return;
  const idx = filtered.findIndex((p) => p.id === currentId);
  const nextIdx = idx === -1 ? 0 : (idx + delta + filtered.length) % filtered.length;
  currentId = filtered[nextIdx].id;
  renderDevice();
  highlightFilmstrip();
  scrollCurrentIntoView();
}

function updateResultCount() {
  resultCount.textContent = `${filtered.length} of ${allPokemon.length} Pokémon`;
}

function buildFilmstrip() {
  if (!filtered.length) {
    filmstrip.innerHTML = `<p class="no-results">No Pokémon match your search.</p>`;
    return;
  }
  filmstrip.innerHTML = filtered
    .map(
      (p) => `
      <button type="button" role="listitem" data-id="${p.id}" aria-current="${p.id === currentId}" title="#${String(p.id).padStart(3, "0")} ${p.name}">
        <img src="${p.sprites.official_artwork}" alt="${p.name}" loading="lazy" />
      </button>
    `
    )
    .join("");

  filmstrip.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentId = Number(btn.dataset.id);
      renderDevice();
      highlightFilmstrip();
    });
  });
}

function highlightFilmstrip() {
  filmstrip.querySelectorAll("button").forEach((btn) => {
    btn.setAttribute("aria-current", String(Number(btn.dataset.id) === currentId));
  });
}

function scrollCurrentIntoView() {
  const btn = filmstrip.querySelector(`button[data-id="${currentId}"]`);
  btn?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
}

function bar(value) {
  const width = 16;
  const filledCount = Math.max(1, Math.round((value / MAX_STAT) * width));
  return "█".repeat(Math.min(width, filledCount)) + "░".repeat(Math.max(0, width - filledCount));
}

function renderDevice() {
  const p = allPokemon.find((x) => x.id === currentId);
  if (!p) return;

  stopAudio();

  document.getElementById("mon-image").src = p.sprites.official_artwork;
  document.getElementById("mon-image").alt = p.name;
  document.getElementById("mon-dexno").textContent = "No." + String(p.id).padStart(3, "0");
  document.getElementById("mon-name").textContent = p.name.toUpperCase();
  document.getElementById("mon-types").innerHTML = p.types
    .map((t) => `<span class="type-chip">${t}</span>`)
    .join("");

  const lines = [];
  lines.push(`<div class="info-heading">Genus</div>`);
  lines.push(`<div class="info-line">${p.genus}</div>`);

  lines.push(`<div class="info-heading">Height / Weight</div>`);
  lines.push(
    `<div class="info-line">${p.height_m.toFixed(1)} m   /   ${p.weight_kg.toFixed(1)} kg</div>`
  );

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

  document.getElementById("info-screen").innerHTML = lines.join("");
}

init();
