// ============================================================
//  public/js/app.js  –  Logika veřejné stránky (index.html)
// ============================================================

let allMedia         = [];
let myRatedIds       = [];
let myRatingsMode    = false;
let activeTypeFilter = "all";
let searchQuery      = "";
let activeGenre      = "";
let minScore         = 0;
let activeTier       = "";
let sortBy           = "default";

const PAGE_SIZE   = 24;
let currentPage   = 1;
let filteredItems = [];

let chartInstances = {};
let lastStats      = null;
let watchlistIds   = [];

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setupTheme();
  updateNavbar();
  loadMedia();
  loadStats();
  loadWatchlistIds();
  setupFilters();
  setupSearch();
  setupMyRatings();
  setupReset();
});

// ── Téma ──────────────────────────────────────────────────────
function setupTheme() {
  const stored = localStorage.getItem("theme") || "dark";
  applyTheme(stored, false);
  document.getElementById("themeToggle")?.addEventListener("click", () => {
    const next = (document.documentElement.dataset.theme || "dark") === "dark" ? "light" : "dark";
    applyTheme(next, true);
  });
}

function applyTheme(theme, save) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = theme === "dark" ? "☀️ Světlé" : "🌙 Tmavé";
  if (save) localStorage.setItem("theme", theme);
  if (lastStats) setTimeout(() => refreshCharts(lastStats), 50);
}

// ── Navbar ────────────────────────────────────────────────────
function updateNavbar() {
  const token    = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  const role     = localStorage.getItem("role");

  if (token && username) {
    document.getElementById("navLogin")?.classList.add("d-none");
    document.getElementById("navRegister")?.classList.add("d-none");
    document.getElementById("navUser")?.classList.remove("d-none");
    if (document.getElementById("navUsername")) document.getElementById("navUsername").textContent = username;
    if (document.getElementById("navRole"))     document.getElementById("navRole").textContent = role === "admin" ? "Administrátor" : "Uživatel";
    if (role === "admin") document.getElementById("navAdmin")?.classList.remove("d-none");
    document.getElementById("myRatingsBtn")?.classList.remove("d-none");
  }

  document.getElementById("logoutBtn")?.addEventListener("click", e => {
    e.preventDefault();
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    window.location.reload();
  });
}

// ── Načtení médií ─────────────────────────────────────────────
async function loadMedia() {
  try {
    const res = await fetch("/api/media");
    if (!res.ok) throw new Error();
    allMedia = await res.json();
    populateGenreDropdown();
    renderCards(allMedia);
  } catch {
    document.getElementById("loader").innerHTML =
      `<p class="text-danger">Nepodařilo se načíst data. Je server spuštěný?</p>`;
  }
}

// ── Watchlist IDs ─────────────────────────────────────────────
async function loadWatchlistIds() {
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    const res = await fetch("/api/watchlist/ids", { headers: { "Authorization": `Bearer ${token}` } });
    if (!res.ok) return;
    const { mediaIds } = await res.json();
    watchlistIds = mediaIds;
    document.querySelectorAll("[data-bookmark-id]").forEach(btn => {
      setBookmarkState(btn, watchlistIds.includes(btn.dataset.bookmarkId));
    });
  } catch { /* silent */ }
}

function setBookmarkState(btn, isBookmarked) {
  btn.classList.toggle("bookmarked", isBookmarked);
  btn.title = isBookmarked ? "Odebrat z watchlistu" : "Přidat do watchlistu";
  btn.innerHTML = isBookmarked ? `<i class="bi bi-bookmark-fill"></i>` : `<i class="bi bi-bookmark"></i>`;
}

async function toggleWatchlist(mediaId, btn) {
  const token = localStorage.getItem("token");
  if (!token) { showToast("Pro watchlist se musíš přihlásit", "warning"); return; }
  const isBookmarked = watchlistIds.includes(mediaId);
  try {
    const res = await fetch(`/api/watchlist/${mediaId}`, {
      method:  isBookmarked ? "DELETE" : "POST",
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (res.ok || res.status === 201 || res.status === 204) {
      if (isBookmarked) {
        watchlistIds = watchlistIds.filter(id => id !== mediaId);
        showToast("Odebráno z watchlistu", "info");
      } else {
        watchlistIds.push(mediaId);
        showToast("Přidáno do watchlistu 🔖", "success");
      }
      setBookmarkState(btn, !isBookmarked);
    }
  } catch { showToast("Nepodařilo se aktualizovat watchlist", "danger"); }
}

// ── Dropdown žánrů ────────────────────────────────────────────
function populateGenreDropdown() {
  const genreSet = new Set();
  allMedia.forEach(item => {
    if (!item.genre) return;
    item.genre.split(",").forEach(g => { const t = g.trim(); if (t) genreSet.add(t); });
  });
  const select = document.getElementById("genreFilter");
  [...genreSet].sort((a, b) => a.localeCompare(b, "cs")).forEach(genre => {
    const opt = document.createElement("option");
    opt.value = genre; opt.textContent = genre;
    select.appendChild(opt);
  });
}

// ── Vykreslení karet ──────────────────────────────────────────
function renderCards(items) {
  const loader     = document.getElementById("loader");
  const grid       = document.getElementById("mediaGrid");
  const emptyState = document.getElementById("emptyState");
  const count      = document.getElementById("resultCount");

  loader.style.display = "none";
  filteredItems = items;
  currentPage   = 1;

  if (count) count.textContent = items.length > 0 ? `${items.length} ${pluralPolozek(items.length)}` : "";

  if (items.length === 0) {
    grid.style.display = "none";
    emptyState.style.display = "block";
    renderPagination(0, 1);
    return;
  }

  emptyState.style.display = "none";
  grid.style.display = "flex";
  grid.innerHTML = "";
  appendCards(items.slice(0, PAGE_SIZE));
  renderPagination(items.length, 1);
}

function appendCards(items) {
  const grid = document.getElementById("mediaGrid");
  items.forEach(item => {
    const col = document.createElement("div");
    col.className = "col-12 col-sm-6 col-md-4 col-lg-3";
    col.innerHTML = buildCard(item);
    col.querySelector(".media-card").addEventListener("click", e => {
      if (e.target.closest(".bookmark-btn")) return;
      window.location.href = `/media/${item.id}`;
    });
    const bBtn = col.querySelector(".bookmark-btn");
    if (bBtn) {
      setBookmarkState(bBtn, watchlistIds.includes(item.id));
      bBtn.addEventListener("click", e => { e.stopPropagation(); toggleWatchlist(item.id, bBtn); });
    }
    grid.appendChild(col);
  });
}

// ── Stránkování ───────────────────────────────────────────────
function renderPagination(total, current) {
  const wrap = document.getElementById("paginationWrap");
  if (!wrap) return;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) { wrap.innerHTML = ""; return; }

  const pages = buildPageNumbers(totalPages, current);
  let html = `<button class="page-btn" id="pgPrev" ${current===1?"disabled":""}>‹</button>`;
  pages.forEach(p => {
    html += p === "…"
      ? `<button class="page-btn ellipsis" disabled>…</button>`
      : `<button class="page-btn${p===current?" active":""}" data-page="${p}">${p}</button>`;
  });
  html += `<button class="page-btn" id="pgNext" ${current===totalPages?"disabled":""}>›</button>`;
  wrap.innerHTML = html;

  wrap.querySelector("#pgPrev")?.addEventListener("click", () => goToPage(current - 1));
  wrap.querySelector("#pgNext")?.addEventListener("click", () => goToPage(current + 1));
  wrap.querySelectorAll("[data-page]").forEach(btn =>
    btn.addEventListener("click", () => goToPage(Number(btn.dataset.page)))
  );
}

function buildPageNumbers(totalPages, current) {
  if (totalPages <= 7) return Array.from({length: totalPages}, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push("…");
  for (let i = Math.max(2, current-1); i <= Math.min(totalPages-1, current+1); i++) pages.push(i);
  if (current < totalPages - 2) pages.push("…");
  pages.push(totalPages);
  return pages;
}

function goToPage(page) {
  if (page < 1 || page > Math.ceil(filteredItems.length / PAGE_SIZE)) return;
  currentPage = page;
  const grid = document.getElementById("mediaGrid");
  grid.innerHTML = "";
  appendCards(filteredItems.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE));
  renderPagination(filteredItems.length, currentPage);
  grid.scrollIntoView({ behavior: "smooth", block: "start" });
}

function pluralPolozek(n) {
  if (n === 1) return "položka";
  if (n >= 2 && n <= 4) return "položky";
  return "položek";
}

// ── Šablona karty ─────────────────────────────────────────────
function buildCard(item) {
  const tierColor = { S:"danger", A:"warning", B:"success", C:"info", D:"secondary" };
  const typEmoji  = { Movie:"🎬", Series:"📺", Game:"🎮" };
  const typeBg    = { Movie:"#1a1a2e", Series:"#16213e", Game:"#0f3460" };

  const tierBadge = item.overallTier
    ? `<span class="badge bg-${tierColor[item.overallTier]||"secondary"} ms-1">Tier ${item.overallTier}</span>`
    : `<span class="badge bg-secondary ms-1">Bez hodnocení</span>`;

  const scoreText = item.overallScore !== null
    ? `⭐ ${item.overallScore.toFixed(1)} / 10`
    : "Zatím bez skóre";

  const fallback = `<div class="fallback-img d-none align-items-center justify-content-center flex-column"
       style="height:180px;background:${typeBg[item.type]||"#333"};">
    <span style="font-size:3rem;">${typEmoji[item.type]||"📄"}</span>
    <small class="text-white-50 mt-1" style="font-size:.75rem;">${item.title}</small>
  </div>`;

  const imageHtml = item.imageUrl
    ? `<img src="${item.imageUrl}" class="card-img-top" alt="${item.title}"
           style="height:180px;object-fit:cover;"
           onerror="this.classList.add('d-none');this.nextElementSibling.classList.remove('d-none');this.nextElementSibling.classList.add('d-flex');" />
       ${fallback}`
    : fallback.replace("d-none","d-flex");

  const loggedIn     = !!localStorage.getItem("token");
  const isBookmarked = watchlistIds.includes(item.id);
  const bookmarkHtml = loggedIn
    ? `<button class="bookmark-btn${isBookmarked?" bookmarked":""}" data-bookmark-id="${item.id}">
         <i class="bi bi-bookmark${isBookmarked?"-fill":""}"></i>
       </button>`
    : "";

  return `
    <div class="card h-100 shadow-sm media-card position-relative">
      ${bookmarkHtml}
      ${imageHtml}
      <div class="card-body d-flex flex-column">
        <h5 class="card-title mb-1 text-truncate" title="${item.title}">${item.title}</h5>
        <p class="text-muted small mb-2">
          ${typEmoji[item.type]||""} ${item.type}
          ${item.genre ? `· ${item.genre.split(",")[0].trim()}` : ""}
          ${item.year  ? `· ${item.year}` : ""}
        </p>
        <div class="mt-auto">
          <small class="text-muted">${scoreText}</small><br/>
          ${tierBadge}
        </div>
      </div>
    </div>`;
}

// ── Vyhledávání ───────────────────────────────────────────────
function setupSearch() {
  const input = document.getElementById("searchInput");
  const clear = document.getElementById("searchClearBtn");
  if (!input) return;
  input.addEventListener("input", () => {
    searchQuery = input.value.trim().toLowerCase();
    clear.style.display = searchQuery ? "block" : "none";
    updateResetBtn(); applyFilters();
  });
  clear?.addEventListener("click", () => {
    input.value = ""; searchQuery = "";
    clear.style.display = "none";
    updateResetBtn(); applyFilters(); input.focus();
  });
}

// ── Filtry ────────────────────────────────────────────────────
function setupFilters() {
  document.querySelectorAll("#filterButtons button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#filterButtons button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeTypeFilter = btn.dataset.filter;
      updateResetBtn(); applyFilters();
    });
  });
  document.getElementById("genreFilter").addEventListener("change", e => { activeGenre = e.target.value; updateResetBtn(); applyFilters(); });
  document.getElementById("scoreFilter").addEventListener("change", e => { minScore = Number(e.target.value); updateResetBtn(); applyFilters(); });
  document.getElementById("tierFilter").addEventListener("change",  e => { activeTier = e.target.value; updateResetBtn(); applyFilters(); });
  document.getElementById("sortFilter").addEventListener("change",  e => { sortBy = e.target.value; updateResetBtn(); applyFilters(); });
}

// ── Moje hodnocení ────────────────────────────────────────────
function setupMyRatings() {
  const btn = document.getElementById("myRatingsBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    if (myRatingsMode) {
      myRatingsMode = false; myRatedIds = [];
      btn.classList.remove("active","btn-info"); btn.classList.add("btn-outline-info");
      updateResetBtn(); applyFilters(); return;
    }
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch("/api/reviews/my", { headers: { "Authorization": `Bearer ${token}` } });
      const { mediaIds } = await res.json();
      myRatedIds = mediaIds; myRatingsMode = true;
      btn.classList.add("active","btn-info"); btn.classList.remove("btn-outline-info");
      updateResetBtn(); applyFilters();
    } catch (e) { console.error(e); }
  });
}

// ── Reset filtrů ──────────────────────────────────────────────
function setupReset() {
  document.getElementById("resetFiltersBtn")?.addEventListener("click", resetAllFilters);
}

function resetAllFilters() {
  searchQuery = ""; activeTypeFilter = "all"; activeGenre = "";
  minScore = 0; activeTier = ""; sortBy = "default";
  myRatingsMode = false; myRatedIds = [];

  const input = document.getElementById("searchInput");
  if (input) input.value = "";
  const clearBtn = document.getElementById("searchClearBtn");
  if (clearBtn) clearBtn.style.display = "none";
  document.querySelectorAll("#filterButtons button").forEach(b => b.classList.remove("active"));
  document.querySelector("#filterButtons button[data-filter='all']").classList.add("active");
  document.getElementById("genreFilter").value = "";
  document.getElementById("scoreFilter").value = "0";
  document.getElementById("tierFilter").value  = "";
  document.getElementById("sortFilter").value  = "default";
  const myBtn = document.getElementById("myRatingsBtn");
  if (myBtn) { myBtn.classList.remove("active","btn-info"); myBtn.classList.add("btn-outline-info"); }
  updateResetBtn(); applyFilters();
}

function updateResetBtn() {
  const btn = document.getElementById("resetFiltersBtn");
  if (!btn) return;
  const isDefault = !searchQuery && activeTypeFilter==="all" && !activeGenre
    && minScore===0 && !activeTier && sortBy==="default" && !myRatingsMode;
  btn.classList.toggle("d-none", isDefault);
}

// ── Aplikuj filtry ────────────────────────────────────────────
function applyFilters() {
  let items = [...allMedia];
  if (myRatingsMode)          items = items.filter(m => myRatedIds.includes(m.id));
  if (activeTypeFilter!=="all") items = items.filter(m => m.type === activeTypeFilter);
  if (searchQuery) items = items.filter(m =>
    [m.title,m.genre,m.year,m.summary].filter(Boolean).join(" ").toLowerCase().includes(searchQuery)
  );
  if (activeGenre) items = items.filter(m => m.genre?.toLowerCase().includes(activeGenre.toLowerCase()));
  if (minScore>0)  items = items.filter(m => m.overallScore !== null && m.overallScore >= minScore);
  if (activeTier)  items = items.filter(m => m.overallTier === activeTier);
  items = sortItems(items);

  const heading = document.getElementById("mediaHeading");
  if (myRatingsMode) heading.textContent = "Moje hodnocení";
  else if (searchQuery) heading.textContent = `Výsledky pro „${searchQuery}"`;
  else if (activeTypeFilter !== "all") {
    heading.textContent = {Movie:"🎬 Filmy",Series:"📺 Seriály",Game:"🎮 Hry"}[activeTypeFilter] || "Všechna media";
  } else heading.textContent = "Všechna media";

  if (items.length === 0) {
    const emptyText = document.getElementById("emptyStateText");
    const emptyHint = document.getElementById("emptyStateHint");
    if (myRatingsMode) {
      if (emptyText) emptyText.textContent = "Ještě jsi nic nehodnotil/a";
      if (emptyHint) emptyHint.textContent = "Klikni na libovolné médium a přidej hodnocení!";
    } else {
      if (emptyText) emptyText.textContent = "Žádné výsledky";
      if (emptyHint) emptyHint.textContent = "Zkus změnit filtry nebo vyhledávací dotaz.";
    }
  }
  renderCards(items);
}

function sortItems(items) {
  switch (sortBy) {
    case "score_desc": return [...items].sort((a,b) => (b.overallScore??-1)-(a.overallScore??-1));
    case "score_asc":  return [...items].sort((a,b) => (a.overallScore??11)-(b.overallScore??11));
    case "title_asc":  return [...items].sort((a,b) => a.title.localeCompare(b.title,"cs"));
    case "title_desc": return [...items].sort((a,b) => b.title.localeCompare(a.title,"cs"));
    case "year_desc":  return [...items].sort((a,b) => (b.year||0)-(a.year||0));
    case "year_asc":   return [...items].sort((a,b) => (a.year||9999)-(b.year||9999));
    default: return items;
  }
}

// ── Statistiky + grafy ────────────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch("/api/stats");
    if (!res.ok) throw new Error();
    const stats = await res.json();
    lastStats = stats;
    document.getElementById("statTotal").textContent  = stats.total;
    document.getElementById("statMovies").textContent = stats.byType.Movie;
    document.getElementById("statSeries").textContent = stats.byType.Series;
    document.getElementById("statGames").textContent  = stats.byType.Game;
    renderCharts(stats);
  } catch { document.getElementById("statTotal").textContent = allMedia.length || "?"; }
}

function refreshCharts(stats) {
  Object.values(chartInstances).forEach(c => c?.destroy());
  chartInstances = {};
  renderCharts(stats);
}

function renderCharts(stats) {
  const textColor = "#e2e8f0";
  const gridColor = "rgba(255,255,255,0.1)";
  Chart.defaults.color       = textColor;
  Chart.defaults.borderColor = gridColor;

  const ctxTypes = document.getElementById("chartTypes");
  if (ctxTypes) {
    chartInstances.types = new Chart(ctxTypes, {
      type: "doughnut",
      data: {
        labels: ["🎬 Filmy","📺 Seriály","🎮 Hry"],
        datasets: [{ data: [stats.byType.Movie,stats.byType.Series,stats.byType.Game],
          backgroundColor: ["#3b82f6","#22c55e","#f59e0b"], borderWidth:2, borderColor:"#111827" }]
      },
      options: { plugins: { legend: { position:"bottom", labels:{ padding:14, font:{size:12}, color:textColor } } }, cutout:"60%" }
    });
  }

  const tierColors = { S:"#ef4444", A:"#f59e0b", B:"#22c55e", C:"#06b6d4", D:"#6b7280" };
  const ctxTiers = document.getElementById("chartTiers");
  if (ctxTiers) {
    chartInstances.tiers = new Chart(ctxTiers, {
      type: "bar",
      data: { labels:["S","A","B","C","D"],
        datasets:[{ label:"Počet položek", data:["S","A","B","C","D"].map(t=>stats.byTier[t]||0),
          backgroundColor:["S","A","B","C","D"].map(t=>tierColors[t]), borderRadius:6, borderSkipped:false }]
      },
      options: { plugins:{legend:{display:false}},
        scales: { y:{beginAtZero:true,ticks:{stepSize:1,color:textColor},grid:{color:gridColor}},
                  x:{ticks:{color:textColor},grid:{display:false}} } }
    });
  }

  const ctxTop5 = document.getElementById("chartTop5");
  if (!ctxTop5) return;
  if (!stats.top5?.length) {
    ctxTop5.closest(".chart-box").innerHTML = `<p class="text-muted text-center mt-5 small">Zatím žádná hodnocení</p>`;
    return;
  }
  const typeColor = { Movie:"#3b82f6", Series:"#22c55e", Game:"#f59e0b" };
  chartInstances.top5 = new Chart(ctxTop5, {
    type: "bar",
    data: { labels: stats.top5.map(i => i.title.length>16 ? i.title.slice(0,15)+"…" : i.title),
      datasets:[{ label:"Skóre", data:stats.top5.map(i=>i.score),
        backgroundColor:stats.top5.map(i=>typeColor[i.type]||"#6b7280"), borderRadius:6, borderSkipped:false }]
    },
    options: { indexAxis:"y", plugins:{legend:{display:false}},
      scales: { x:{min:0,max:10,ticks:{color:textColor},grid:{color:gridColor}},
                y:{ticks:{color:textColor},grid:{display:false}} } }
  });
}
