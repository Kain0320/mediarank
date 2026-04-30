// ============================================================
//  server.js  –  Vstupní bod celé aplikace
// ============================================================
//
//  Spuštění:  node server.js        (produkce)
//             nodemon server.js     (vývoj – auto-restart)
//
// ============================================================

require("dotenv").config(); // načte .env proměnné (TWITCH_*, TMDB_*)

const express = require("express");
const path    = require("path");

const mediaRouter   = require("./routes/media");    // CRUD pro media položky
const reviewRouter  = require("./routes/reviews");  // CRUD pro recenze
const authRouter    = require("./routes/auth");      // Přihlášení + registrace
const searchRouter  = require("./routes/search");    // IGDB + TMDB vyhledávání
const statsRouter   = require("./routes/stats");     // Agregovaná statistika

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
// Parsování JSON těla požadavku (Content-Type: application/json)
app.use(express.json());

// Servírování statických souborů z /public  (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// ── API Routes ────────────────────────────────────────────────
// Všechny cesty začínající /api/media jdou do routes/media.js
app.use("/api/media",   mediaRouter);

// Všechny cesty začínající /api/reviews jdou do routes/reviews.js
app.use("/api/reviews", reviewRouter);

// Přihlášení: POST /api/auth/login
app.use("/api/auth",    authRouter);

// Vyhledávání přes IGDB a TMDB: GET /api/search?q=...&type=...
app.use("/api/search",  searchRouter);

// Statistiky pro grafy: GET /api/stats
app.use("/api/stats",   statsRouter);

// ── Fallback pro SPA ─────────────────────────────────────────
// Pokud URL neodpovídá žádné API cestě, vrátíme index.html
// (hodí se až budeš mít client-side routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start serveru ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Server běží na http://localhost:${PORT}`);
  console.log(`📁  Data se ukládají do: ./data/data.json`);
});
