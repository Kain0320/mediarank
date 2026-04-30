// ============================================================
//  public/js/admin.js
// ============================================================

const TOKEN_KEY = "adminToken";

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) { showAdminPanel(); loadAdminTable(token); }

  document.getElementById("loginBtn").addEventListener("click", handleLogin);
  document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem(TOKEN_KEY);
    location.reload();
  });

  setupTabs();
  setupSearch();
  document.getElementById("addSubmitBtn").addEventListener("click", handleAdd);
});

// ── Přihlášení ────────────────────────────────────────────────
async function handleLogin() {
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      document.getElementById("loginError").classList.remove("d-none");
      return;
    }
    const { token } = await res.json();
    sessionStorage.setItem(TOKEN_KEY, token);
    showAdminPanel();
    loadAdminTable(token);
  } catch (err) { console.error("Login error:", err); }
}

function showAdminPanel() {
  document.getElementById("loginOverlay").style.display = "none";
  document.getElementById("adminPanel").style.display   = "block";
}

// ── Tabulka ───────────────────────────────────────────────────
async function loadAdminTable(token) {
  const res  = await fetch("/api/media");
  const data = await res.json();
  renderTable(data, token);
}

function renderTable(items, token) {
  const tbody = document.getElementById("adminTableBody");
  tbody.innerHTML = "";
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Žádné položky</td></tr>`;
    return;
  }
  items.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.title}</td>
      <td>${item.type}</td>
      <td>${item.genre || "—"}</td>
      <td>${item.overallScore ?? "—"}</td>
      <td>${item.overallTier  ?? "—"}</td>
      <td>
        <button class="btn btn-sm btn-outline-danger"
          onclick="deleteItem('${item.id}','${token}')">
          <i class="bi bi-trash"></i> Smazat
        </button>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function deleteItem(id, token) {
  if (!confirm("Opravdu smazat tuto položku?")) return;
  const res = await fetch(`/api/media/${id}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (res.ok) loadAdminTable(token);
  else alert("Smazání se nezdařilo");
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
  // Enter v inputu spustí hledání
  input.addEventListener("keydown", e => { if (e.key === "Enter") runSearch(); });
}

async function runSearch() {
  const q    = document.getElementById("searchQuery").value.trim();
  const type = document.getElementById("searchType").value;
  const status  = document.getElementById("searchStatus");
  const results = document.getElementById("searchResults");

  if (!q) return;

  // Zobraz loader
  status.textContent = "Hledám...";
  status.classList.remove("d-none");
  results.innerHTML  = `<div class="text-center py-4">
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

    status.textContent = `Nalezeno ${data.length} výsledků – klikni na položku pro import:`;
    renderSearchResults(data, type);

  } catch (err) {
    status.textContent = "Chyba: " + err.message;
    results.innerHTML  = "";
  }
}

const typeEmoji = { Movie: "🎬", Series: "📺", Game: "🎮" };

function renderSearchResults(items, type) {
  const results = document.getElementById("searchResults");
  results.innerHTML = "";

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "search-result-card d-flex align-items-center gap-3 p-2 border-bottom";

    const img = item.imageUrl
      ? `<img src="${item.imageUrl}" class="search-result-img" alt="${item.title}"
             onerror="this.outerHTML='<div class=\'search-result-img-placeholder\'>${typeEmoji[type]}</div>'" />`
      : `<div class="search-result-img-placeholder">${typeEmoji[type]}</div>`;

    const rating = item.rating ? `⭐ ${item.rating}` : "";
    const year   = item.year   ? `· ${item.year}`    : "";
    const genre  = item.genres || "";

    row.innerHTML = `
      ${img}
      <div class="flex-grow-1 overflow-hidden">
        <div class="fw-semibold text-truncate">${item.title}</div>
        <small class="text-muted">${rating} ${year} ${genre ? "· " + genre : ""}</small>
        ${item.summary ? `<div class="text-muted small text-truncate" style="max-width:420px;">${item.summary}</div>` : ""}
      </div>
      <button class="btn btn-sm btn-success flex-shrink-0">
        <i class="bi bi-download"></i> Import
      </button>`;

    row.querySelector("button").addEventListener("click", () => importItem(item, type));
    results.appendChild(row);
  });
}

// ── Import výsledku do databáze ───────────────────────────────
async function importItem(item, type) {
  const token = sessionStorage.getItem(TOKEN_KEY);

  const body = {
    title:    item.title,
    type,
    summary:  item.summary  || null,
    imageUrl: item.imageUrl || null,
    rating:   item.rating   || null,
    genres:   item.genres   || null,
    year:     item.year     || null
  };

  try {
    const res = await fetch("/api/search/import", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      alert("Import selhal: " + (err.error || res.status));
      return;
    }

    const imported = await res.json();

    // Zavři modal, obnov tabulku, ukaž potvrzení
    bootstrap.Modal.getInstance(document.getElementById("addModal")).hide();
    loadAdminTable(token);

    showToast(`✅ "${imported.title}" byl přidán do databáze`);

  } catch (err) {
    alert("Chyba připojení: " + err.message);
  }
}

// ── Ruční přidání ─────────────────────────────────────────────
async function handleAdd() {
  const token    = sessionStorage.getItem(TOKEN_KEY);
  const title    = document.getElementById("addTitle").value.trim();
  const type     = document.getElementById("addType").value;
  const genre    = document.getElementById("addGenre").value.trim();
  const imageUrl = document.getElementById("addImageUrl").value.trim();

  if (!title || !type) { alert("Název a typ jsou povinné!"); return; }

  const res = await fetch("/api/media", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ title, type, genre, imageUrl })
  });

  if (res.ok) {
    bootstrap.Modal.getInstance(document.getElementById("addModal")).hide();
    loadAdminTable(token);
    ["addTitle","addType","addGenre","addImageUrl"].forEach(id => {
      document.getElementById(id).value = "";
    });
    showToast("✅ Položka přidána");
  } else {
    const err = await res.json();
    alert("Chyba: " + err.error);
  }
}

// ── Toast notifikace ──────────────────────────────────────────
function showToast(message) {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:#198754; color:#fff; padding:12px 20px;
    border-radius:8px; font-size:.9rem; box-shadow:0 4px 12px rgba(0,0,0,.2);
    animation: fadeIn .2s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
