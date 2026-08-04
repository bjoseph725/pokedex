const TYPE_COLOR_VAR = (type) => `var(--type-${type.toLowerCase()})`;
const MAX_STAT_SCALE = 180; // ~ highest reasonable base stat for bar scaling

const grid = document.getElementById("grid");
const searchInput = document.getElementById("search");
const typeFilter = document.getElementById("type-filter");
const sortBy = document.getElementById("sort-by");
const resultCount = document.getElementById("result-count");
const modalBackdrop = document.getElementById("modal-backdrop");
const modalContent = document.getElementById("modal-content");
const modalClose = document.getElementById("modal-close");

let pokemonList = [];

async function init() {
  const res = await fetch("data/pokemon.json");
  pokemonList = await res.json();
  populateTypeFilter();
  render();

  searchInput.addEventListener("input", render);
  typeFilter.addEventListener("change", render);
  sortBy.addEventListener("change", render);
  modalClose.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function populateTypeFilter() {
  const types = new Set();
  pokemonList.forEach((p) => p.types.forEach((t) => types.add(t)));
  [...types].sort().forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeFilter.appendChild(opt);
  });
}

function getFiltered() {
  const query = searchInput.value.trim().toLowerCase();
  const type = typeFilter.value;

  let list = pokemonList.filter((p) => {
    const matchesQuery =
      !query ||
      p.name.toLowerCase().includes(query) ||
      String(p.id).padStart(3, "0").includes(query) ||
      String(p.id) === query;
    const matchesType = !type || p.types.includes(type);
    return matchesQuery && matchesType;
  });

  switch (sortBy.value) {
    case "name":
      list = list.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "total-desc":
      list = list.sort((a, b) => b.stats.total - a.stats.total);
      break;
    case "hp-desc":
      list = list.sort((a, b) => b.stats.hp - a.stats.hp);
      break;
    case "attack-desc":
      list = list.sort((a, b) => b.stats.attack - a.stats.attack);
      break;
    case "speed-desc":
      list = list.sort((a, b) => b.stats.speed - a.stats.speed);
      break;
    default:
      list = list.sort((a, b) => a.id - b.id);
  }
  return list;
}

function render() {
  const list = getFiltered();
  resultCount.textContent = `${list.length} of ${pokemonList.length} Pokémon`;
  grid.innerHTML = "";

  if (list.length === 0) {
    grid.innerHTML = `<p class="no-results">No Pokémon match your search.</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const p of list) {
    fragment.appendChild(renderCard(p));
  }
  grid.appendChild(fragment);
}

function renderCard(p) {
  const card = document.createElement("div");
  card.className = "card";
  card.setAttribute("role", "listitem");
  card.tabIndex = 0;
  card.innerHTML = `
    <div class="dex-num">#${String(p.id).padStart(3, "0")}</div>
    <img src="${p.sprites.official_artwork}" alt="${p.name}" loading="lazy" />
    <div class="name">${p.name}</div>
    <div class="type-badges">${typeBadges(p.types)}</div>
  `;
  const open = () => openModal(p);
  card.addEventListener("click", open);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });
  return card;
}

function typeBadges(types) {
  return types
    .map(
      (t) =>
        `<span class="type-badge" style="background:${TYPE_COLOR_VAR(t)}">${t}</span>`
    )
    .join("");
}

function statRow(label, value, isTotal = false) {
  const pct = Math.min(100, Math.round((value / MAX_STAT_SCALE) * 100));
  return `
    <div class="stat-row${isTotal ? " total" : ""}">
      <span class="stat-label">${label}</span>
      <span class="stat-value">${value}</span>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
    </div>
  `;
}

function openModal(p) {
  const s = p.stats;
  modalContent.innerHTML = `
    <div class="modal-header">
      <img src="${p.sprites.official_artwork}" alt="${p.name}" />
      <div>
        <div class="dex-num">#${String(p.id).padStart(3, "0")}</div>
        <h2 id="modal-name">${p.name}</h2>
        <div class="genus">${p.genus ?? ""}</div>
        <div class="type-badges">${typeBadges(p.types)}</div>
      </div>
    </div>

    ${p.flavor_text ? `<p class="flavor-text">"${p.flavor_text}"</p>` : ""}

    <dl class="info-grid">
      <dt>Height</dt><dd>${p.height_m} m</dd>
      <dt>Weight</dt><dd>${p.weight_kg} kg</dd>
      <dt>Capture Rate</dt><dd>${p.capture_rate ?? "—"}</dd>
    </dl>

    <div class="stats-title">Base Stats</div>
    ${statRow("HP", s.hp)}
    ${statRow("Attack", s.attack)}
    ${statRow("Defense", s.defense)}
    ${statRow("Sp. Atk", s.special_attack)}
    ${statRow("Sp. Def", s.special_defense)}
    ${statRow("Speed", s.speed)}
    ${statRow("Total", s.total, true)}
  `;
  modalBackdrop.hidden = false;
  modalClose.focus();
}

function closeModal() {
  modalBackdrop.hidden = true;
  modalContent.innerHTML = "";
}

init();
