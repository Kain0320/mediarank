// ============================================================
//  routes/search.js  –  Vyhledávání přes IGDB a TMDB
// ============================================================
//
//  GET  /api/search?q=witcher&type=Game    → výsledky z IGDB
//  GET  /api/search?q=inception&type=Movie → výsledky z TMDB
//  GET  /api/search?q=breaking&type=Series → výsledky z TMDB
//
//  POST /api/search/import  → přidá vybraný výsledek do data.json
//
// ============================================================

const express      = require("express");
const router       = express.Router();
const { v4: uuidv4 } = require("uuid");
const db           = require("../helpers/db");
const { searchGames }  = require("../helpers/igdb");
const { searchMedia }  = require("../helpers/tmdb");
const { requireAdmin } = require("./auth");

// ── GET /api/search ───────────────────────────────────────────
router.get("/", async (req, res) => {
  const { q, type } = req.query;

  if (!q || !type) {
    return res.status(400).json({ error: "Parametry q (dotaz) a type jsou povinné" });
  }

  const validTypes = ["Movie", "Series", "Game"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: "type musí být Movie, Series nebo Game" });
  }

  try {
    let results;

    if (type === "Game") {
      results = await searchGames(q);
    } else {
      results = await searchMedia(q, type);
    }

    res.json(results);

  } catch (err) {
    console.error("Search error:", err.message);
    res.status(502).json({ error: `Chyba při volání externího API: ${err.message}` });
  }
});

// ── POST /api/search/import ───────────────────────────────────
// Přijme jeden výsledek z /api/search a uloží ho do data.json
// Tělo: { title, type, summary, imageUrl, rating, genres, year }
router.post("/import", requireAdmin, (req, res) => {
  const { title, type, summary, imageUrl, rating, genres, year } = req.body;

  if (!title || !type) {
    return res.status(400).json({ error: "title a type jsou povinné" });
  }

  const newItem = {
    id:           uuidv4(),
    title,
    type,
    genre:        genres || null,
    summary:      summary || null,
    imageUrl:     imageUrl || null,
    year:         year || null,
    overallScore: null,
    overallTier:  null,
    createdAt:    new Date().toISOString()
  };

  const data = db.read();
  data.media.push(newItem);
  db.write(data);

  res.status(201).json(newItem);
});

module.exports = router;
