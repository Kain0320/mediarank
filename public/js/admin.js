// ============================================================
//  public/js/admin.js  –  Admin panel (Krok 8)
// ============================================================

const TOKEN_KEY = "adminToken";

// ── Globální stav ─────────────────────────────────────────────
let allMedia      = [];   // všechny MediaItem objekty
let reviewCounts  = {};   // { mediaId: počet recenzí }
let selectedIds   = new Set();
let sortCol       = "title";
let sortDir       = 1;    // 1 = ASC, -1 = DESC
let tableFilter   = "";
let episodesMediaId   = null;
let episodesMediaTitle = null;

// ── Pomocné funkce ────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(msg, variant = "success") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.style.cssText = "position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:8px;";
    document.body.appendChild(container);
  }
  const t = document.createElement("div");
  const colors = { success: "#198754", danger: "#dc3545", info: "#0dcaf0", warning: "#ffc107" };
  t.style.cssText = `background:${colors[variant]||colors.success};color:${variant==="warning"||variant==="info"?"#000":"#fff"};padding:10px 18px;border-radius:8px;font-size:.9rem;box-shadow:0 4px 12px rgba(0,0,0,.3);opacity:0;transition:opacity .25s;max-width:320px;`;
  t.textContent = msg;
  container.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = "1"; });
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) { showAdminPanel(); loadAll(token); }

  document.getElementById("loginBtn").addEventListener("click", handleLogin);
  document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem(TOKEN_KEY);
    location.reload();
  });

  // Klávesa Enter v login formuláři
  ["loginUsername", "loginPassword"].forEach(id => {
    document.getElementById(id).addEventListener("keydown", e => {
      if (e.key === "Enter") handleLogin();
    });
  });

  setupTabs();
  setupSearch();
  setupTableControls();

  document.getElementById("addSubmitBtn").addEventListener("click", handleAdd);
  document.getElementById("epAddBtn").addEventListener("click", handleEpAdd);
  document.getElementById("bulkDeleteBtn").addEventListener("click", handleBulkDelete);
  document.getElementById("clearSelectionBtn").addEventListener("click", clearSelection);
  document.getElementById("previewImportBtn").addEventListener("click", () => {
    const btn = document.getElementById("previewImportBtn");
    if (btn.dataset.item) {
      doImport(JSON.parse(btn.dataset.item), btn.dataset.type);
    }
  });
});

// ── Přihlášení ────────────────────────────────────────────────
async function handleLogin() {
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;
  const errEl    = document.getElementById("loginError");
  errEl.classList.add("d-none");

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) { errEl.classList.remove("d-none"); return; }
    const { token } = await res.json();
    sessionStorage.setItem(TOKEN_KEY, token);
    showAdminPanel();
    loadAll(token);
  } catch (err) { console.error("Login error:", err); }
}

function showAdminPanel() {
  // d-flex uses !important, must remove the class instead of setting inline style
  const overlay = document.getElementById("loginOverlay");
  overlay.classList.remove("d-flex");
  overlay.classList.add("d-none");
  document.getElementById("adminPanel").style.display = "block";
}

// ── Načtení dat ───────────────────────────────────────────────
async function loadAll(token) {
  const [mediaRes, reviewsRes] = await Promise.all([
    fetch("/api/media"),
    fetch("/api/reviews")
  ]);
  allMedia = mediaRes.ok ? await mediaRes.json() : [];

  if (reviewsRes.ok) {
    const reviews = await reviewsRes.json();
    reviewCounts = {};
    reviews.forEach(r => {
      reviewCounts[r.mediaId] = (reviewCounts[r.mediaId] || 0) + 1;
    });
  }

  renderTable();
}

// ── Filtry a řazení tabulky ───────────────────────────────────
function setupTableControls() {
  const searchInput = document.getElementById("tableSearch");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      tableFilter = searchInput.value.trim().toLowerCase();
      clearSelection();
      renderTable();
    });
  }

  // Kliknutí na záhlaví sloupců → řazení
  document.querySelectorAll("th[data-sort]").forEach(th => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (sortCol === col) { sortDir *= -1; }
      else { sortCol = col; sortDir = 1; }
      clearSelection();
      renderTable();
    });
  });

  // Select all checkbox
  const selAll = document.getElementById("selectAllChk");
  if (selAll) {
    selAll.addEventListener("change", () => {
      const visible = getFilteredSorted();
      if (selAll.checked) visible.forEach(m => selectedIds.add(m.id));
      else visible.forEach(m => selectedIds.delete(m.id));
      renderTable();
    });
  }
}

function getFilteredSorted() {
  let items = allMedia;

  if (tableFilter) {
    items = items.filter(m =>
      m.title.toLowerCase().includes(tableFilter) ||
      (m.genre || "").toLowerCase().includes(tableFilter) ||
      m.type.toLowerCase().includes(tableFilter)
    );
  }

  items = [...items].sort((a, b) => {
    let va = a[sortCol] ?? "";
    let vb = b[sortCol] ?? "";
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va < vb) return -1 * sortDir;
    if (va > vb) return  1 * sortDir;
    return 0;
  });

  return items;
}

// ── Render tabulky ────────────────────────────────────────────
function renderTable() {
  const tbody    = document.getElementById("adminTableBody");
  const statsEl  = document.getElementById("tableStats");
  const items    = getFilteredSorted();
  const token    = sessionStorage.getItem(TOKEN_KEY);

  if (statsEl) {
    statsEl.textContent = tableFilter
      ? `Zobrazeno ${items.length} z ${allMedia.length} položek`
      : `Celkem ${allMedia.length} položek`;
  }

  tbody.innerHTML = "";

  if (items.length === 0) {
    const msg = tableFilter
      ? `Žádné výsledky pro &bdquo;${escHtml(tableFilter)}&ldquo;`
      : "Žádné položky";
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">${msg}</td></tr>`;
    updateBulkBar();
    return;
  }

  // Uprav záhlaví sortovacího sloupce
  document.querySelectorAll("th[data-sort]").forEach(th => {
    const col = th.dataset.sort;
    const arrow = col === sortCol ? (sortDir === 1 ? " ↑" : " ↓") : "";
    th.dataset.sortLabel = th.dataset.sortLabel || th.textContent.trim();
    // Reset text (bez šipky) a přidej šipku
    th.textContent = th.dataset.sortLabel + arrow;
    th.style.cursor = "pointer";
  });

  items.forEach(item => {
    const tr = document.createElement("tr");
    tr.dataset.id = item.id;
    if (selectedIds.has(item.id)) tr.classList.add("table-active");

    const episodesBtn = item.type === "Series"
      ? `<button class="btn btn-sm btn-outline-primary me-1" data-action="episodes" data-id="${escHtml(item.id)}" title="Epizody">
           <i class="bi bi-collection-play"></i>
         </button>`
      : "";

    const cnt = reviewCounts[item.id] || 0;

    tr.innerHTML = `
      <td>
        <input type="checkbox" class="form-check-input row-chk" data-id="${escHtml(item.id)}"
          ${selectedIds.has(item.id) ? "checked" : ""} />
      </td>
      <td>
        ${item.imageUrl
          ? `<img src="${escHtml(item.imageUrl)}" alt="" style="width:32px;height:44px;object-fit:cover;border-radius:3px;margin-right:8px;vertical-align:middle;">`
          : ""}
        <a href="/media/${escHtml(item.id)}" target="_blank" class="text-decoration-none fw-semibold">
          ${escHtml(item.title)}
        </a>
      </td>
      <td>${escHtml(item.type)}</td>
      <td class="text-muted small" style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
          ${item.genre ? `data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title="${escHtml(item.genre)}"` : ""}
        >${escHtml(item.genre || "—")}</td>
      <td>${item.overallScore != null ? item.overallScore.toFixed(1) : "—"}</td>
      <td>${item.overallTier  ?? "—"}</td>
      <td><span class="badge bg-secondary">${cnt}</span></td>
      <td class="text-end" style="white-space:nowrap;">
        ${episodesBtn}
        <button class="btn btn-sm btn-outline-warning me-1" data-action="edit" data-id="${escHtml(item.id)}" title="Upravit">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${escHtml(item.id)}" title="Smazat">
          <i class="bi bi-trash"></i>
        </button>
      </td>`;

    tbody.appendChild(tr);
  });

  // Checkbox "select all" stav
  const selAll = document.getElementById("selectAllChk");
  if (selAll) {
    const visibleIds = items.map(m => m.id);
    const allChecked = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
    selAll.checked = allChecked;
    selAll.indeterminate = !allChecked && visibleIds.some(id => selectedIds.has(id));
  }

  // Bootstrap tooltips na zkrácených žánrech
  tbody.querySelectorAll("[data-bs-toggle='tooltip']").forEach(el => {
    new bootstrap.Tooltip(el, { trigger: "hover" });
  });

  // Event delegation – kliknutí na tlačítka v tabulce
  tbody.onclick = handleTableClick;

  // Checkbox změna
  tbody.onchange = (e) => {
    const chk = e.target.closest(".row-chk");
    if (!chk) return;
    const id = chk.dataset.id;
    if (chk.checked) selectedIds.add(id);
    else             selectedIds.delete(id);
    updateBulkBar();
    // Aktualizuj select-all
    const selAll = document.getElementById("selectAllChk");
    if (selAll) {
      const visibleIds = getFilteredSorted().map(m => m.id);
      selAll.checked = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
      selAll.indeterminate = !selAll.checked && visibleIds.some(id => selectedIds.has(id));
    }
  };

  updateBulkBar();
}

// ── Event delegation ──────────────────────────────────────────
function handleTableClick(e) {
  const btn    = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id     = btn.dataset.id;
  const item   = allMedia.find(m => m.id === id);
  if (!item) return;

  if (action === "edit")     openEditModal(item);
  if (action === "delete")   deleteItem(id);
  if (action === "episodes") openEpisodesModal(item.id, item.title);
}

// ── Smazání jedné položky ─────────────────────────────────────
async function deleteItem(id) {
  if (!confirm("Opravdu smazat tuto položku? Smaže se i s recenzemi.")) return;
  const token = sessionStorage.getItem(TOKEN_KEY);
  const res   = await fetch(`/api/media/${id}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (res.ok) {
    allMedia = allMedia.filter(m => m.id !== id);
    selectedIds.delete(id);
    delete reviewCounts[id];
    renderTable();
    showToast("Položka smazána", "info");
  } else {
    showToast("Smazání se nezdařilo", "danger");
  }
}

// ── Hromadné mazání ────────────────────────────────────────────
async function handleBulkDelete() {
  const ids  = [...selectedIds];
  if (ids.length === 0) return;
  if (!confirm(`Smazat ${ids.length} vybraných položek? Akce je nevratná.`)) return;

  const token = sessionStorage.getItem(TOKEN_KEY);
  let ok = 0, fail = 0;

  for (const id of ids) {
    const res = await fetch(`/api/media/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (res.ok) { ok++; allMedia = allMedia.filter(m => m.id !== id); delete reviewCounts[id]; }
    else fail++;
  }

  clearSelection();
  renderTable();
  if (fail === 0) showToast(`Smazáno ${ok} položek`, "success");
  else            showToast(`Smazáno ${ok}, chyba ${fail}`, "warning");
}

function updateBulkBar() {
  const bar   = document.getElementById("bulkBar");
  const label = document.getElementById("bulkCount");
  if (!bar) return;
  const n = selectedIds.size;
  if (n > 0) {
    bar.classList.remove("d-none");
    label.textContent = `${n} vybráno`;
  } else {
    bar.classList.add("d-none");
  }
}

function clearSelection() {
  selectedIds.clear();
  updateBulkBar();
  renderTable();
}

// ── Edit modal ────────────────────────────────────────────────
function openEditModal(item) {
  // Naplň hodnoty
  document.getElementById("editId").value       = item.id;
  document.getElementById("editTitle").value    = item.title;
  document.getElementById("editType").value     = item.type;
  document.getElementById("editGenre").value    = item.genre   || "";
  document.getElementById("editImageUrl").value = item.imageUrl|| "";
  document.getElementById("editYear").value     = item.year    || "";
  document.getElementById("editSummary").value  = item.summary || "";

  const modal = new bootstrap.Modal(document.getElementById("editModal"));
  modal.show();

  // Tlačítko Uložit
  const saveBtn = document.getElementById("editSaveBtn");
  saveBtn.onclick = () => handleEdit(modal);
}

async function handleEdit(modal) {
  const token    = sessionStorage.getItem(TOKEN_KEY);
  const id       = document.getElementById("editId").value;
  const title    = document.getElementById("editTitle").value.trim();
  const type     = document.getElementById("editType").value;
  const genre    = document.getElementById("editGenre").value.trim();
  const imageUrl = document.getElementById("editImageUrl").value.trim();
  const year     = document.getElementById("editYear").value.trim();
  const summary  = document.getElementById("editSummary").value.trim();

  if (!title || !type) { showToast("Název a typ jsou povinné", "danger"); return; }

  const res = await fetch(`/api/media/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ title, type, genre: genre || null, imageUrl: imageUrl || null,
                           year: year || null, summary: summary || null })
  });

  if (res.ok) {
    const updated = await res.json();
    const idx = allMedia.findIndex(m => m.id === id);
    if (idx !== -1) allMedia[idx] = updated;
    modal.hide();
    renderTable();
    showToast("Položka upravena", "success");
  } else {
    showToast("Uložení se nezdařilo", "danger");
  }
}

// ── Ruční přidání ─────────────────────────────────────────────
async function handleAdd() {
  const token    = sessionStorage.getItem(TOKEN_KEY);
  const title    = document.getElementById("addTitle").value.trim();
  const type     = document.getElementById("addType").value;
  const genre    = document.getElementById("addGenre").value.trim();
  const imageUrl = document.getElementById("addImageUrl").value.trim();

  if (!title || !type) { showToast("Název a typ jsou povinné!", "danger"); return; }

  const res = await fetch("/api/media", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ title, type, genre: genre || null, imageUrl: imageUrl || null })
  });

  if (res.ok) {
    const newItem = await res.json();
    allMedia.push(newItem);
    bootstrap.Modal.getInstance(document.getElementById("addModal"))?.hide();
    // Vyčisti formulář
    ["addTitle","addGenre","addImageUrl"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("addType").value = "";
    renderTable();
    showToast(`"${newItem.title}" přidáno`, "success");
  } else {
    const err = await res.json().catch(() => ({}));
    showToast("Chyba: " + (err.error || "Přidání selhalo"), "danger");
  }
}

// ── Tab přepínání (Hledat / Ručně) ────────────────────────────
function setupTabs() {
  document.querySelectorAll("#addTabs .nav-link").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#addTabs .nav-link").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.getElementById("tabSearch").classList.toggle("d-none", tab !== "search");
      document.getElementById("tabManual").classList.toggle("d-none", tab !== "manual");
    });
  });
}

// ── Vyhledávání IGDB / TMDB ───────────────────────────────────
function setupSearch() {
  const btn   = document.getElementById("searchBtn");
  const input = document.getElementById("searchQuery");
  btn.addEventListener("click", runSearch);
  input.addEventListener("keydown", e => { if (e.key === "Enter") runSearch(); });
}

async function runSearch() {
  const q       = document.getElementById("searchQuery").value.trim();
  const type    = document.getElementById("searchType").value;
  const status  = document.getElementById("searchStatus");
  const results = document.getElementById("searchResults");
  if (!q) return;

  status.textContent = "Hledám...";
  status.classList.remove("d-none");
  results.innerHTML = `<div class="text-center py-4">
    <div class="spinner-border spinner-border-sm text-primary"></div>
  </div>`;

  try {
    const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${type}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Chyba API");

    if (data.length === 0) {
      status.textContent = "Nic nenalezeno.";
      results.innerHTML  = "";
      return;
    }

    // Zjisti duplicity (tmdbId / igdbId)
    const existingTmdb = new Set(allMedia.map(m => m.tmdbId).filter(Boolean));
    const existingIgdb = new Set(allMedia.map(m => m.igdbId).filter(Boolean));

    status.textContent = `Nalezeno ${data.length} výsledků:`;
    renderSearchResults(data, type, existingTmdb, existingIgdb);
  } catch (err) {
    status.textContent = "Chyba: " + err.message;
    results.innerHTML  = "";
  }
}

const typeEmoji = { Movie: "🎬", Series: "📺", Game: "🎮" };

function renderSearchResults(items, type, existingTmdb, existingIgdb) {
  const results = document.getElementById("searchResults");
  results.innerHTML = "";

  items.forEach(item => {
    const isDuplicate =
      (item.tmdbId && existingTmdb.has(item.tmdbId)) ||
      (item.igdbId && existingIgdb.has(item.igdbId));

    const row = document.createElement("div");
    row.className = "search-result-card d-flex align-items-center gap-3 p-2 border-bottom";
    if (isDuplicate) row.style.opacity = "0.6";

    const img = item.imageUrl
      ? `<img src="${escHtml(item.imageUrl)}" class="search-result-img" alt="${escHtml(item.title)}"
             onerror="this.outerHTML='<div class=\\'search-result-img-placeholder\\'>${typeEmoji[type]}</div>'" />`
      : `<div class="search-result-img-placeholder">${typeEmoji[type]}</div>`;

    const rating = item.rating ? `⭐ ${item.rating}` : "";
    const year   = item.year   ? `· ${item.year}`    : "";
    const genre  = item.genres || "";
    const dupBadge = isDuplicate ? `<span class="badge bg-warning text-dark ms-1">Již v DB</span>` : "";

    row.innerHTML = `
      ${img}
      <div class="flex-grow-1 overflow-hidden">
        <div class="fw-semibold text-truncate">${escHtml(item.title)} ${dupBadge}</div>
        <small class="text-muted">${rating} ${year} ${genre ? "· " + escHtml(genre) : ""}</small>
        ${item.summary ? `<div class="text-muted small text-truncate" style="max-width:380px;">${escHtml(item.summary)}</div>` : ""}
      </div>
      <div class="d-flex gap-1 flex-shrink-0">
        <button class="btn btn-sm btn-outline-secondary preview-btn" title="Náhled">
          <i class="bi bi-eye"></i>
        </button>
        <button class="btn btn-sm btn-success import-btn" title="Importovat">
          <i class="bi bi-download"></i> Import
        </button>
      </div>`;

    row.querySelector(".preview-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openPreviewModal(item, type, isDuplicate);
    });
    row.querySelector(".import-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      doImport(item, type);
    });
    // Klik na celý řádek = náhled
    row.addEventListener("click", () => openPreviewModal(item, type, isDuplicate));

    results.appendChild(row);
  });
}

// ── Preview modal ─────────────────────────────────────────────
function openPreviewModal(item, type, isDuplicate) {
  document.getElementById("previewTitle").textContent   = item.title;
  document.getElementById("previewYear").textContent    = item.year || "—";
  document.getElementById("previewType").textContent    = `${typeEmoji[type]} ${type}`;
  document.getElementById("previewGenre").textContent   = item.genres || item.genre || "—";
  document.getElementById("previewRating").textContent  = item.rating ? `⭐ ${item.rating}` : "—";
  document.getElementById("previewSummary").textContent = item.summary || "Popis není k dispozici.";

  const posterEl = document.getElementById("previewPoster");
  if (item.imageUrl) {
    posterEl.innerHTML = `<img src="${escHtml(item.imageUrl)}" alt="${escHtml(item.title)}"
      style="width:120px;height:175px;object-fit:cover;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.4);"
      onerror="this.outerHTML='<div style=\\'width:120px;height:175px;border-radius:6px;background:#2a2a2a;display:flex;align-items:center;justify-content:center;font-size:3rem;\\'>${typeEmoji[type]}</div>'" />`;
  } else {
    posterEl.innerHTML = `<div style="width:120px;height:175px;border-radius:6px;background:#2a2a2a;display:flex;align-items:center;justify-content:center;font-size:3rem;">${typeEmoji[type]}</div>`;
  }

  const dupWarn = document.getElementById("previewDupWarning");
  if (isDuplicate) dupWarn.classList.remove("d-none");
  else             dupWarn.classList.add("d-none");

  // Ulož data na importovací tlačítko
  const importBtn = document.getElementById("previewImportBtn");
  importBtn.dataset.item = JSON.stringify(item);
  importBtn.dataset.type = type;

  new bootstrap.Modal(document.getElementById("previewModal")).show();
}

// ── Import výsledku do databáze ───────────────────────────────
async function doImport(item, type) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const body  = {
    title:    item.title,
    type,
    summary:  item.summary  || null,
    imageUrl: item.imageUrl || null,
    rating:   item.rating   || null,
    genres:   item.genres   || null,
    year:     item.year     || null,
    tmdbId:   item.tmdbId   || null,
    igdbId:   item.igdbId   || null
  };

  try {
    const res = await fetch("/api/search/import", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast("Import selhal: " + (err.error || res.status), "danger");
      return;
    }

    const imported = await res.json();
    allMedia.push(imported);

    // Zavři oba modály
    ["previewModal", "addModal"].forEach(id => {
      const el = document.getElementById(id);
      if (el) bootstrap.Modal.getInstance(el)?.hide();
    });

    renderTable();
    showToast(`✅ "${imported.title}" importován`);
  } catch (err) {
    showToast("Chyba připojení: " + err.message, "danger");
  }
}

// ── Epizody modal ─────────────────────────────────────────────
async function openEpisodesModal(mediaId, title) {
  episodesMediaId    = mediaId;
  episodesMediaTitle = title;

  document.getElementById("episodesModalTitle").textContent = title;
  document.getElementById("epError").classList.add("d-none");

  new bootstrap.Modal(document.getElementById("episodesModal")).show();
  await loadEpisodesList();
}

async function loadEpisodesList() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const res   = await fetch(`/api/media/${episodesMediaId}/episodes`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const episodes = res.ok ? await res.json() : [];
  renderEpisodesList(episodes);
}

function renderEpisodesList(episodes) {
  const container = document.getElementById("episodesList");
  if (!episodes.length) {
    container.innerHTML = `<p class="text-muted">Žádné epizody zatím nebyly ohodnoceny.</p>`;
    return;
  }

  // Seskup po sezónách
  const bySeason = {};
  episodes.forEach(ep => {
    if (!bySeason[ep.season]) bySeason[ep.season] = [];
    bySeason[ep.season].push(ep);
  });

  container.innerHTML = Object.entries(bySeason)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([season, eps]) => {
      const avg = (eps.reduce((s, e) => s + e.rating, 0) / eps.length).toFixed(1);
      const rows = eps
        .sort((a, b) => a.episode - b.episode)
        .map(ep => `
          <tr>
            <td>S${String(ep.season).padStart(2,"0")}E${String(ep.episode).padStart(2,"0")}</td>
            <td>${escHtml(ep.title || "—")}</td>
            <td><span style="color:#ffc107;font-weight:700;">⭐ ${ep.rating}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-danger py-0 px-1"
                onclick="deleteEpisode('${ep.id}')">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>`).join("");
      return `
        <div class="mb-3">
          <h6 class="text-muted mb-1">Sezóna ${season} <small>(průměr: ⭐ ${avg})</small></h6>
          <table class="table table-sm table-bordered mb-0">
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }).join("");
}

async function handleEpAdd() {
  const token   = sessionStorage.getItem(TOKEN_KEY);
  const season  = document.getElementById("epSeason").value;
  const episode = document.getElementById("epNumber").value;
  const rating  = document.getElementById("epRating").value;
  const title   = document.getElementById("epTitle").value.trim();
  const errEl   = document.getElementById("epError");

  errEl.classList.add("d-none");

  const res = await fetch(`/api/media/${episodesMediaId}/episodes`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ season, episode, rating, title: title || null })
  });

  if (res.ok) {
    document.getElementById("epRating").value = "";
    document.getElementById("epTitle").value  = "";
    await loadEpisodesList();
    // Aktualizuj skóre v allMedia
    const updated = await fetch(`/api/media/${episodesMediaId}`).then(r => r.json()).catch(() => null);
    if (updated) {
      const idx = allMedia.findIndex(m => m.id === episodesMediaId);
      if (idx !== -1) allMedia[idx] = updated;
      renderTable();
    }
    showToast("Epizoda přidána", "success");
  } else {
    const err = await res.json().catch(() => ({}));
    errEl.textContent = err.error || "Chyba při přidávání epizody";
    errEl.classList.remove("d-none");
  }
}

async function deleteEpisode(epId) {
  if (!confirm("Smazat hodnocení epizody?")) return;
  const token = sessionStorage.getItem(TOKEN_KEY);
  const res   = await fetch(`/api/media/${episodesMediaId}/episodes/${epId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (res.ok) {
    await loadEpisodesList();
    const updated = await fetch(`/api/media/${episodesMediaId}`).then(r => r.json()).catch(() => null);
    if (updated) {
      const idx = allMedia.findIndex(m => m.id === episodesMediaId);
      if (idx !== -1) allMedia[idx] = updated;
      renderTable();
    }
    showToast("Epizoda smazána", "info");
  } else {
    showToast("Smazání epizody selhalo", "danger");
  }
}
