// ============================================================
//  public/js/profile.js  –  Logika profilové stránky
// ============================================================

const token    = localStorage.getItem("token");
const username = localStorage.getItem("username");
const role     = localStorage.getItem("role");

const typEmoji = { Movie: "🎬", Series: "📺", Game: "🎮" };

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setupNavbar();

  if (!token || !username) {
    document.getElementById("authGuard").classList.remove("d-none");
    return;
  }

  document.getElementById("profileContent").style.display = "block";
  renderProfileHero();
  loadReviews();
  loadWatchlistCount(); // načte jen počet pro stats header
  setupTabs();
});

// ── Navbar ────────────────────────────────────────────────────
function setupNavbar() {
  const navUser  = document.getElementById("navbarUser");
  const logoutEl = document.getElementById("logoutBtn");

  if (token && username) {
    navUser.textContent = `👤 ${username}`;
    logoutEl.style.display = "inline-flex";
    logoutEl.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      localStorage.removeItem("role");
      window.location.href = "/";
    });
  }
}

// ── Profilový hero ────────────────────────────────────────────
function renderProfileHero() {
  // Avatar – první písmeno jména
  const avatar = document.getElementById("avatarCircle");
  avatar.textContent = username.charAt(0).toUpperCase();

  document.getElementById("profileUsername").textContent = username;
  document.getElementById("profileRole").textContent =
    role === "admin" ? "👑 Administrátor" : "👤 Uživatel";
}

// ── Tabs ──────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll(".profile-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".profile-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      document.getElementById("panelReviews").classList.toggle("d-none", tab !== "reviews");
      document.getElementById("panelWatchlist").classList.toggle("d-none", tab !== "watchlist");

      if (tab === "watchlist") loadWatchlist();
    });
  });
}

// ── Načtení recenzí ───────────────────────────────────────────
async function loadReviews() {
  try {
    const res = await fetch("/api/reviews/my-full", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { reviews, stats } = await res.json();

    // Statistiky
    document.getElementById("statReviewed").textContent  = stats.totalReviewed;
    document.getElementById("statAvgScore").textContent  = stats.avgScore ?? "–";
    document.getElementById("statEpisodes").textContent  = stats.totalEpisodes;
    document.getElementById("tabReviewsBadge").textContent = reviews.length;

    renderReviews(reviews, stats);
  } catch (err) {
    console.error("Chyba načítání recenzí:", err);
    document.getElementById("reviewsLoader").innerHTML =
      `<p class="text-danger">Nepodařilo se načíst hodnocení.</p>`;
  }
}

function renderReviews(reviews, stats) {
  document.getElementById("reviewsLoader").style.display = "none";
  const list = document.getElementById("reviewsList");
  list.style.display = "block";

  if (reviews.length === 0) {
    list.innerHTML = `
      <div class="empty-profile">
        <div class="empty-icon">⭐</div>
        <p>Ještě jsi nic nehodnotil/a</p>
        <small>Klikni na libovolné médium a přidej hodnocení!</small>
        <br><a href="/" class="btn btn-outline-primary btn-sm mt-3">Procházet media</a>
      </div>`;
    return;
  }

  // Skupiny: filmy, seriály, hry
  const byType = {};
  reviews.forEach(r => {
    const t = r.media.type;
    if (!byType[t]) byType[t] = [];
    byType[t].push(r);
  });

  let html = "";

  // Oblíbený typ – badge info
  if (stats.favoriteType) {
    html += `
      <div class="mb-3 d-flex align-items-center gap-2 flex-wrap">
        <span class="badge bg-primary bg-opacity-25 text-primary px-3 py-2" style="font-size:.82rem;">
          ${typEmoji[stats.favoriteType] || ""} Nejčastěji hodnotíš: ${stats.favoriteType === "Movie" ? "Filmy" : stats.favoriteType === "Series" ? "Seriály" : "Hry"}
        </span>
        <span class="text-muted small">${stats.totalReviews} ${pluralRecenzi(stats.totalReviews)} celkem</span>
      </div>`;
  }

  html += `<div class="d-flex flex-column gap-2">`;
  reviews.forEach(r => {
    html += buildReviewRow(r);
  });
  html += `</div>`;

  list.innerHTML = html;

  // Event listenery pro smazání
  list.querySelectorAll("[data-delete-review]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Smazat tuto recenzi?")) return;
      const id = btn.dataset.deleteReview;
      try {
        const res = await fetch(`/api/reviews/${id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok && res.status !== 204) throw new Error();
        btn.closest(".review-item").remove();
        showToast("Recenze smazána", "success");
        // Aktualizuj počet
        const badge = document.getElementById("tabReviewsBadge");
        badge.textContent = Math.max(0, parseInt(badge.textContent || "0") - 1);
      } catch {
        showToast("Nepodařilo se smazat recenzi", "danger");
      }
    });
  });
}

function buildReviewRow(r) {
  const media   = r.media;
  const poster  = media.imageUrl
    ? `<img class="review-thumb" src="${media.imageUrl}" alt="${media.title}"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />`
    : "";
  const placeholder = `<div class="review-thumb-placeholder" ${media.imageUrl ? 'style="display:none;"' : ''}>${typEmoji[media.type] || "📄"}</div>`;

  let scoreHtml = "";
  if (r.ratingType === "stars") {
    const stars = "⭐".repeat(Math.round(r.ratingValue));
    scoreHtml = `<span class="review-score">⭐ ${r.ratingValue}/10</span>`;
  } else if (r.ratingType === "tier") {
    const tierClass = `tier-${r.ratingValue}`;
    scoreHtml = `<span class="review-score fw-bold ${tierClass}">Tier ${r.ratingValue}</span>`;
  }

  const dateStr = new Date(r.createdAt).toLocaleDateString("cs-CZ", {
    day: "numeric", month: "short", year: "numeric"
  });

  const comment = r.comment
    ? `<div class="review-comment">"${r.comment}"</div>`
    : "";

  return `
    <div class="review-item">
      <a href="/media/${media.id}">
        ${poster}${placeholder}
      </a>
      <div class="flex-grow-1 min-w-0">
        <a href="/media/${media.id}">
          <div class="review-title text-truncate">${media.title}</div>
        </a>
        <div class="review-meta">${typEmoji[media.type] || ""} ${media.type}${media.year ? ` · ${media.year}` : ""}${media.genre ? ` · ${media.genre.split(",")[0].trim()}` : ""}</div>
        ${scoreHtml}
        ${comment}
      </div>
      <div class="d-flex flex-column align-items-end gap-2 flex-shrink-0">
        <span class="review-date">${dateStr}</span>
        <button class="btn btn-link btn-sm text-danger p-0" data-delete-review="${r.id}" style="font-size:.75rem;">
          <i class="bi bi-trash3"></i>
        </button>
      </div>
    </div>`;
}

// ── Watchlist – rychlý počet pro stats header ─────────────────
async function loadWatchlistCount() {
  try {
    const res = await fetch("/api/watchlist/ids", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) return;
    const { mediaIds } = await res.json();
    document.getElementById("statWatchlist").textContent       = mediaIds.length;
    document.getElementById("tabWatchlistBadge").textContent   = mediaIds.length;
  } catch { /* silent */ }
}

// ── Watchlist – plný obsah (načítá se jen při přepnutí tabu) ──
let watchlistLoaded = false;

async function loadWatchlist() {
  if (watchlistLoaded) return;
  watchlistLoaded = true;

  try {
    const res = await fetch("/api/watchlist", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();

    document.getElementById("statWatchlist").textContent    = items.length;
    document.getElementById("tabWatchlistBadge").textContent = items.length;
    renderWatchlist(items);
  } catch (err) {
    console.error("Chyba načítání watchlistu:", err);
    document.getElementById("watchlistLoader").innerHTML =
      `<p class="text-danger">Nepodařilo se načíst watchlist.</p>`;
  }
}

function renderWatchlist(items) {
  document.getElementById("watchlistLoader").style.display = "none";
  const grid = document.getElementById("watchlistGrid");
  grid.style.display = "flex";

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="col-12">
        <div class="empty-profile">
          <div class="empty-icon">🔖</div>
          <p>Watchlist je prázdný</p>
          <small>Klikni na záložku 🔖 na libovolném médiu a přidej ho sem!</small>
          <br><a href="/" class="btn btn-outline-primary btn-sm mt-3">Procházet media</a>
        </div>
      </div>`;
    return;
  }

  grid.innerHTML = items.map(w => buildWatchlistCard(w)).join("");

  // Kliknutí na kartu → detail
  grid.querySelectorAll(".wl-card[data-id]").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".wl-remove-btn")) return;
      window.location.href = `/media/${card.dataset.id}`;
    });
  });

  // Odebrání z watchlistu
  grid.querySelectorAll(".wl-remove-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const mediaId = btn.dataset.removeId;
      try {
        const res = await fetch(`/api/watchlist/${mediaId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok || res.status === 204) {
          btn.closest(".col-6").remove();
          showToast("Odebráno z watchlistu", "info");
          const remaining = grid.querySelectorAll(".wl-card").length;
          document.getElementById("statWatchlist").textContent   = remaining;
          document.getElementById("tabWatchlistBadge").textContent = remaining;
          if (remaining === 0) renderWatchlist([]);
        }
      } catch {
        showToast("Nepodařilo se odebrat", "danger");
      }
    });
  });
}

function buildWatchlistCard(w) {
  const m = w.media;
  const imgHtml = m.imageUrl
    ? `<img class="wl-card-img" src="${m.imageUrl}" alt="${m.title}"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />`
    : "";
  const placeholderHtml = `<div class="wl-card-img-placeholder" ${m.imageUrl ? 'style="display:none;"' : ''}>${typEmoji[m.type] || "📄"}</div>`;

  const addedDate = new Date(w.addedAt).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" });

  return `
    <div class="col-6 col-sm-4 col-md-3 col-lg-2">
      <div class="wl-card" data-id="${m.id}">
        ${imgHtml}${placeholderHtml}
        <button class="wl-remove-btn" data-remove-id="${m.id}" title="Odebrat ze watchlistu">
          <i class="bi bi-bookmark-x"></i>
        </button>
        <div class="wl-card-body">
          <div class="wl-card-title">${m.title}</div>
          <div class="wl-card-meta">${typEmoji[m.type] || ""} ${m.type} · přidáno ${addedDate}</div>
        </div>
      </div>
    </div>`;
}

// ── Pomocné funkce ────────────────────────────────────────────
function pluralRecenzi(n) {
  if (n === 1) return "recenze";
  if (n >= 2 && n <= 4) return "recenze";
  return "recenzí";
}
