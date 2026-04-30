// ============================================================
//  routes/reviews.js  –  CRUD operace pro Review
// ============================================================
//
//  Dostupné endpointy (prefix /api/reviews je v server.js):
//
//  GET    /api/reviews              – všechny recenze
//  GET    /api/reviews?mediaId=xyz  – recenze pro jedno media
//  POST   /api/reviews              – nová recenze (přepočítá skóre)
//  DELETE /api/reviews/:id          – smazání recenze (přepočítá skóre)
//
// ============================================================

const express  = require("express");
const router   = express.Router();
const { v4: uuidv4 } = require("uuid");
const db       = require("../helpers/db");
const { normalize, recalculate } = require("../helpers/scoring");

// ── GET /api/reviews ──────────────────────────────────────────
// Volitelný query parametr: ?mediaId=<id>
router.get("/", (req, res) => {
  const data = db.read();
  const { mediaId } = req.query;

  const result = mediaId
    ? data.reviews.filter(r => r.mediaId === mediaId)
    : data.reviews;

  res.json(result);
});

// ── POST /api/reviews ─────────────────────────────────────────
// Přidá novou recenzi a přepočítá overallScore/Tier na media položce
// Tělo: { mediaId, username, ratingType, ratingValue, comment }
router.post("/", (req, res) => {
  const { mediaId, username, ratingType, ratingValue, comment } = req.body;

  if (!mediaId || !username || !ratingType || ratingValue === undefined) {
    return res.status(400).json({ error: "Chybí povinná pole" });
  }

  // Validuj a normalizuj hodnocení (throws při chybě)
  try {
    normalize(ratingType, ratingValue);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const data      = db.read();
  const mediaItem = data.media.find(m => m.id === mediaId);

  if (!mediaItem) {
    return res.status(404).json({ error: "MediaItem nenalezen" });
  }

  const newReview = {
    id:          uuidv4(),
    mediaId,
    username:    username.trim(),
    ratingType,                        // "stars" nebo "tier"
    ratingValue,                       // 1-10 nebo "S"/"A"/"B"/"C"/"D"
    comment:     comment || null,
    createdAt:   new Date().toISOString()
  };

  data.reviews.push(newReview);

  // ⬇️ KLÍČOVÁ ČÁST: po přidání recenze přepočítáme skóre media
  const mediaIndex = data.media.findIndex(m => m.id === mediaId);
  data.media[mediaIndex] = recalculate(mediaItem, data.reviews);

  db.write(data);
  res.status(201).json(newReview);
});

// ── DELETE /api/reviews/:id ───────────────────────────────────
// Smaže recenzi a přepočítá skóre nadřazeného media
router.delete("/:id", (req, res) => {
  const data  = db.read();
  const index = data.reviews.findIndex(r => r.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Recenze nenalezena" });
  }

  const { mediaId } = data.reviews[index];
  data.reviews.splice(index, 1);

  // Přepočítej skóre media po smazání recenze
  const mediaIndex = data.media.findIndex(m => m.id === mediaId);
  if (mediaIndex !== -1) {
    data.media[mediaIndex] = recalculate(data.media[mediaIndex], data.reviews);
  }

  db.write(data);
  res.status(204).send();
});

module.exports = router;
