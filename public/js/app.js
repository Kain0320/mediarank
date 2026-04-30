// ============================================================
//  public/js/app.js  –  Logika veřejné stránky (index.html)
// ============================================================
//
//  Tento soubor:
//  1. Při načtení stránky zavolá GET /api/media
//  2. Vykreslí karty media položek
//  3. Obsluhuje tlačítka filtrů
//
//  TODO pro tebe (postupně doplňuj):
//  - [ ] Kliknutí na kartu → detail s recenzemi
//  - [ ] Přidání recenze z frontendu (POST /api/reviews)
//  - [ ] Vyhledávání / třídění
//  - [ ] Grafy (Chart.js) – volitelné
//
// ============================================================

// Tuto proměnnou použijeme pro filtrování bez dalšího API volání
let allMedia = [];

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  updateNavbar();
  loadMedia();
  loadStats();
  setupFilters();
});

// ── Auth stav v navbaru ───────────────────────────────────────
function updateNavbar() {
  const token    = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  const role     = localStorage.getItem("role");

  const navLogin    = document.getElementById("navLogin");
  const navRegister = document.getElementById("navRegister");
  const navUser     = document.getElementById("navUser");
  const navAdmin    = document.getElementById("navAdmin");
  const navUsername = document.getElementById("navUsername");
  const navRole     = document.getElementById("navRole");
  const logoutBtn   = document.getElementById("logoutBtn");

  if (token && username) {
    // Přihlášený stav
    navLogin.classList.add("d-none");
    navRegister.classList.add("d-none");
    navUser.classList.remove("d-none");
    navUsername.textContent = username;
    navRole.textContent     = role === "admin" ? "Administrátor" : "Uživatel";

    if (role === "admin") {
      navAdmin.classList.remove("d-none");
    }
  }

  logoutBtn && logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    window.location.reload();
  });
}

// ── Načtení dat z API ─────────────────────────────────────────
async function loadMedia() {
  try {
    const response = await fetch("/api/media");

    if (!response.ok) {
      throw new Error(`API vrátilo chybu: ${response.status}`);
    }

    allMedia = await response.json();
    renderCards(allMedia);

  } catch (err) {
    console.error("Chyba při načítání:", err);
    document.getElementById("loader").innerHTML =
      `<p class="text-danger">Nepodařilo se načíst data. Je server spuštěný?</p>`;
  }
}

// ── Vykreslení karet ──────────────────────────────────────────
function renderCards(items) {
  const loader    = document.getElementById("loader");
  const grid      = document.getElementById("mediaGrid");
  const emptyState = document.getElementById("emptyState");

  loader.style.display = "none";

  if (items.length === 0) {
    grid.style.display      = "none";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  grid.style.display       = "flex"; // Bootstrap row potřebuje display:flex

  // Vymaž předchozí obsah
  grid.innerHTML = "";

  items.forEach(item => {
    const col = document.createElement("div");
    col.className = "col-12 col-sm-6 col-md-4 col-lg-3";
    col.innerHTML = buildCard(item);
    grid.appendChild(col);
  });
}

// ── Šablona jedné karty ───────────────────────────────────────
function buildCard(item) {
  const tierBadgeColor = { S: "danger", A: "warning", B: "success", C: "info", D: "secondary" };
  const typEmoji       = { Movie: "🎬", Series: "📺", Game: "🎮" };

  const tierBadge = item.overallTier
    ? `<span class="badge bg-${tierBadgeColor[item.overallTier] || "secondary"} ms-1">
         Tier ${item.overallTier}
       </span>`
    : `<span class="badge bg-secondary ms-1">Bez hodnocení</span>`;

  const scoreText = item.overallScore !== null
    ? `⭐ ${item.overallScore.toFixed(1)} / 10`
    : "Zatím bez skóre";

  const typeBg = { Movie: "#1a1a2e", Series: "#16213e", Game: "#0f3460" };
  // Fallback div vždy přítomen – onerror ho odkryje odstraněním d-none
  // (nelze použít inline style, Bootstrap d-none má !important)
  const fallbackDiv = `
    <div class="fallback-img d-none align-items-center justify-content-center flex-column"
         style="height:180px; background:${typeBg[item.type] || "#333"};">
      <span style="font-size:3rem;">${typEmoji[item.type] || "📄"}</span>
      <small class="text-white-50 mt-1" style="font-size:.75rem;">${item.title}</small>
    </div>`;

  const imageHtml = item.imageUrl
    ? `<img src="${item.imageUrl}" class="card-img-top" alt="${item.title}"
            style="height:180px; object-fit:cover;"
            onerror="this.classList.add('d-none'); this.nextElementSibling.classList.remove('d-none'); this.nextElementSibling.classList.add('d-flex');" />
       ${fallbackDiv}`
    : fallbackDiv.replace("d-none", "d-flex");

  return `
    <div class="card h-100 shadow-sm">
      ${imageHtml}
      <div class="card-body d-flex flex-column">
        <h5 class="card-title mb-1">${item.title}</h5>
        <p class="text-muted small mb-2">
          ${typEmoji[item.type] || ""} ${item.type}
          ${item.genre ? `· ${item.genre}` : ""}
        </p>
        <div class="mt-auto">
          <small class="text-muted">${scoreText}</small>
          <br/>
          ${tierBadge}
        </div>
      </div>
    </div>
  `;
}

// ── Statistiky + grafy ────────────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch("/api/stats");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const stats = await res.json();

    document.getElementById("statTotal").textContent  = stats.total;
    document.getElementById("statMovies").textContent = stats.byType.Movie;
    document.getElementById("statSeries").textContent = stats.byType.Series;
    document.getElementById("statGames").textContent  = stats.byType.Game;

    renderCharts(stats);
  } catch (err) {
    console.error("Stats error:", err);
    // Zobraz čísla aspoň z karet pokud stats API chybí
    document.getElementById("statTotal").textContent  = allMedia.length || "?";
  }
}

function renderCharts(stats) {
  // Společné nastavení – tmavé pozadí, bílý text
  Chart.defaults.color = "#adb5bd";
  Chart.defaults.borderColor = "rgba(255,255,255,0.07)";

  // ── Graf 1: Doughnut – rozložení typů ──────────────────────
  new Chart(document.getElementById("chartTypes"), {
    type: "doughnut",
    data: {
      labels: ["🎬 Filmy", "📺 Seriály", "🎮 Hry"],
      datasets: [{
        data: [stats.byType.Movie, stats.byType.Series, stats.byType.Game],
        backgroundColor: ["#0d6efd", "#198754", "#ffc107"],
        borderWidth: 2,
        borderColor: "#1a1a2e"
      }]
    },
    options: {
      plugins: { legend: { position: "bottom", labels: { padding: 12, font: { size: 12 } } } },
      cutout: "60%"
    }
  });

  // ── Graf 2: Bar – tier distribuce ──────────────────────────
  const tierColors = {
    S: "#dc3545", A: "#ffc107", B: "#198754", C: "#0dcaf0", D: "#6c757d"
  };
  new Chart(document.getElementById("chartTiers"), {
    type: "bar",
    data: {
      labels: ["S", "A", "B", "C", "D"],
      datasets: [{
        label: "Počet položek",
        data: ["S","A","B","C","D"].map(t => stats.byTier[t]),
        backgroundColor: ["S","A","B","C","D"].map(t => tierColors[t]),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: "rgba(255,255,255,0.05)" } },
        x: { grid: { display: false } }
      }
    }
  });

  // ── Graf 3: Horizontal bar – Top 5 ─────────────────────────
  if (stats.top5.length === 0) {
    document.getElementById("chartTop5").closest(".chart-box").innerHTML =
      `<p class="text-muted text-center mt-5 small">Zatím žádná hodnocení</p>`;
    return;
  }

  const typeColor = { Movie: "#0d6efd", Series: "#198754", Game: "#ffc107" };
  new Chart(document.getElementById("chartTop5"), {
    type: "bar",
    data: {
      labels: stats.top5.map(i => i.title.length > 14 ? i.title.slice(0,13)+"…" : i.title),
      datasets: [{
        label: "Skóre",
        data: stats.top5.map(i => i.score),
        backgroundColor: stats.top5.map(i => typeColor[i.type] || "#6c757d"),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { min: 0, max: 10, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { grid: { display: false } }
      }
    }
  });
}

// ── Filtrovací tlačítka ───────────────────────────────────────
function setupFilters() {
  const buttons = document.querySelectorAll("#filterButtons button");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      // Aktivuj kliknuté tlačítko
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const filter = btn.dataset.filter;
      const filtered = filter === "all"
        ? allMedia
        : allMedia.filter(m => m.type === filter);

      renderCards(filtered);
    });
  });
}
