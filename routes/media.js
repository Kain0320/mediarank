// ============================================================
//  routes/media.js  –  CRUD operace pro MediaItem
// ============================================================
//
//  Dostupné endpointy (prefix /api/media je v server.js):
//
//  GET    /api/media          – seznam všech položek
//  GET    /api/media/:id      – detail jedné položky
//  POST   /api/media          – vytvoření nové položky
//  PUT    /api/media/:id      – aktualizace položky
//  DELETE /api/media/:id      – smazání položky (+ její recenze)
//
// ============================================================

const express = require("express");
const router  = express.Router();
const { v4: uuidv4 } = require("uuid");
const db      = require("../helpers/db");
const { recalculateFromEpisodes } = require("../helpers/scoring");
const { getMovieDetails, getSeriesDetails, getSeasonEpisodes } = require("../helpers/tmdb");
const { getGameDetails } = require("../helpers/igdb");

// ── GET /api/media ────────────────────────────────────────────
// Vrátí pole všech MediaItem objektů
router.get("/", (req, res) => {
  const data = db.read();
  res.json(data.media);
});

// ── GET /api/media/:id ────────────────────────────────────────
// Vrátí jeden MediaItem podle ID
router.get("/:id", (req, res) => {
  const data  = db.read();
  const item  = data.media.find(m => m.id === req.params.id);

  if (!item) {
    return res.status(404).json({ error: "Položka nenalezena" });
  }
  res.json(item);
});

// ── POST /api/media ───────────────────────────────────────────
// Vytvoří nový MediaItem
// Očekávané tělo: { title, type, genre, imageUrl }
router.post("/", (req, res) => {
  const { title, type, genre, imageUrl } = req.body;

  // Základní validace – title a type jsou povinné
  if (!title || !type) {
    return res.status(400).json({ error: "Pole title a type jsou povinná" });
  }

  const validTypes = ["Movie", "Series", "Game"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Typ musí být: ${validTypes.join(", ")}` });
  }

  const newItem = {
    id:           uuidv4(),
    title:        title.trim(),
    type,
    genre:        genre  || null,
    imageUrl:     imageUrl || null,
    overallScore: null,   // spočítá se až po první recenzi
    overallTier:  null,
    createdAt:    new Date().toISOString()
  };

  const data = db.read();
  data.media.push(newItem);
  db.write(data);

  // HTTP 201 = Created
  res.status(201).json(newItem);
});

// ── PUT /api/media/:id ────────────────────────────────────────
// Aktualizuje existující MediaItem (pouze poslané pole)
router.put("/:id", (req, res) => {
  const data  = db.read();
  const index = data.media.findIndex(m => m.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Položka nenalezena" });
  }

  // Sloučíme starý objekt s novými poli (tzv. partial update)
  // overallScore a overallTier se nemění ručně – počítá je scoring helper
  const { title, type, genre, imageUrl, year, summary } = req.body;
  const updated = {
    ...data.media[index],
    ...(title    && { title:    title.trim() }),
    ...(type     && { type }),
    ...(genre    !== undefined && { genre }),
    ...(imageUrl !== undefined && { imageUrl }),
    ...(year     !== undefined && { year: year ? Number(year) : null }),
    ...(summary  !== undefined && { summary: summary || null })
  };

  data.media[index] = updated;
  db.write(data);

  res.json(updated);
});

// ── DELETE /api/media/:id ─────────────────────────────────────
// Smaže MediaItem A všechny jeho recenze (cascade delete)
router.delete("/:id", (req, res) => {
  const data  = db.read();
  const index = data.media.findIndex(m => m.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Položka nenalezena" });
  }

  data.media.splice(index, 1);
  data.reviews  = data.reviews.filter(r => r.mediaId !== req.params.id);
  if (data.episodes) {
    data.episodes = data.episodes.filter(e => e.mediaId !== req.params.id);
  }
  db.write(data);

  // HTTP 204 = No Content (úspěch, ale bez těla odpovědi)
  res.status(204).send();
});

// ── GET /api/media/:id/extra ──────────────────────────────────
// Vrátí detail (trailer, obsazení, screenshoty…) z TMDB / IGDB
router.get("/:id/extra", async (req, res) => {
  const data = db.read();
  const item = data.media.find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Položka nenalezena" });

  try {
    let extra = {};

    if (item.type === "Movie" && item.tmdbId) {
      extra = await getMovieDetails(item.tmdbId);
    } else if (item.type === "Series" && item.tmdbId) {
      const d = await getSeriesDetails(item.tmdbId);
      extra = d;
    } else if (item.type === "Game" && item.igdbId) {
      extra = await getGameDetails(item.igdbId);
    } else {
      return res.status(404).json({ error: "Žádné externí ID (tmdbId/igdbId) pro tuto položku" });
    }

    res.json(extra);
  } catch (err) {
    console.error("Extra detail error:", err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── GET /api/media/:id/tmdb-info ─────────────────────────────
// Vrátí základní info o seriálu (počet sezón) z TMDB
router.get("/:id/tmdb-info", async (req, res) => {
  const data = db.read();
  const item = data.media.find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Položka nenalezena" });
  if (!item.tmdbId) return res.status(404).json({ error: "Chybí tmdbId" });

  try {
    const d = await getSeriesDetails(item.tmdbId);
    res.json({ numberOfSeasons: d.numberOfSeasons, numberOfEpisodes: d.numberOfEpisodes });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── GET /api/media/:id/tmdb-season/:num ──────────────────────
// Vrátí epizody jedné sezóny seriálu z TMDB
router.get("/:id/tmdb-season/:num", async (req, res) => {
  const data = db.read();
  const item = data.media.find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Položka nenalezena" });
  if (!item.tmdbId) return res.status(404).json({ error: "Chybí tmdbId" });

  try {
    const episodes = await getSeasonEpisodes(item.tmdbId, Number(req.params.num));
    res.json(episodes);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── GET /api/media/:id/episodes ───────────────────────────────
// Vrátí všechny hodnocení epizod pro daný seriál
router.get("/:id/episodes", (req, res) => {
  const data = db.read();
  const item = data.media.find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Položka nenalezena" });

  const episodes = (data.episodes || []).filter(e => e.mediaId === req.params.id);
  res.json(episodes);
});

// ── POST /api/media/:id/episodes ──────────────────────────────
// Přidá hodnocení epizody. Tělo: { season, episode, rating, title? }
router.post("/:id/episodes", (req, res) => {
  const data = db.read();
  const idx  = data.media.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Položka nenalezena" });
  if (data.media[idx].type !== "Series") {
    return res.status(400).json({ error: "Epizody lze přidat pouze u seriálů" });
  }

  const { season, episode, rating, title } = req.body;
  if (!season || !episode || rating == null) {
    return res.status(400).json({ error: "season, episode a rating jsou povinné" });
  }
  const r = Number(rating);
  if (isNaN(r) || r < 1 || r > 10) {
    return res.status(400).json({ error: "rating musí být číslo 1–10" });
  }

  if (!data.episodes) data.episodes = [];

  const newEp = {
    id:        uuidv4(),
    mediaId:   req.params.id,
    season:    Number(season),
    episode:   Number(episode),
    title:     title || null,
    rating:    Math.round(r * 10) / 10,
    createdAt: new Date().toISOString()
  };

  data.episodes.push(newEp);

  // Přepočítej skóre seriálu
  const { mediaItem } = recalculateFromEpisodes(data.media[idx], data.episodes);
  data.media[idx] = mediaItem;

  db.write(data);
  res.status(201).json(newEp);
});

// ── DELETE /api/media/:id/episodes/:epId ──────────────────────
router.delete("/:id/episodes/:epId", (req, res) => {
  const data = db.read();
  const idx  = data.media.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Položka nenalezena" });

  if (!data.episodes) data.episodes = [];
  const before = data.episodes.length;
  data.episodes = data.episodes.filter(e => e.id !== req.params.epId);
  if (data.episodes.length === before) {
    return res.status(404).json({ error: "Epizoda nenalezena" });
  }

  const { mediaItem } = recalculateFromEpisodes(data.media[idx], data.episodes);
  data.media[idx] = mediaItem;

  db.write(data);
  res.status(204).send();
});

module.exports = router;
