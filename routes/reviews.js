// ============================================================
//  routes/reviews.js  –  CRUD operace pro Review
// ============================================================

const express  = require("express");
const router   = express.Router();
const { v4: uuidv4 } = require("uuid");
const db       = require("../helpers/db");
const { normalize, recalculate } = require("../helpers/scoring");
const { requireLogin } = require("./auth");

// ── GET /api/reviews ──────────────────────────────────────────
router.get("/", (req, res) => {
  const data = db.read();
  const { mediaId, username } = req.query;

  let result = data.reviews;
  if (mediaId)  result = result.filter(r => r.mediaId  === mediaId);
  if (username) result = result.filter(r => r.username === username);

  res.json(result);
});

// ── GET /api/reviews/my ───────────────────────────────────────
// Vrátí seznam mediaId přihlášeného uživatele (pro "Moje hodnocení" filtr)
router.get("/my", requireLogin, (req, res) => {
  const data     = db.read();
  const username = req.user.username;

  const fromReviews  = data.reviews
    .filter(r => r.username === username)
    .map(r => r.mediaId);

  const fromEpisodes = (data.episodes || [])
    .filter(e => e.username === username)
    .map(e => e.mediaId);

  const mediaIds = [...new Set([...fromReviews, ...fromEpisodes])];
  res.json({ mediaIds });
});

// ── GET /api/reviews/my-full ─────────────────────────────────
// Vrátí plné recenze + epizody + stats pro profilovou stránku
router.get("/my-full", requireLogin, (req, res) => {
  const data     = db.read();
  const username = req.user.username;

  const reviews = data.reviews
    .filter(r => r.username === username)
    .map(r => ({ ...r, media: data.media.find(m => m.id === r.mediaId) || null }))
    .filter(r => r.media)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const episodes = (data.episodes || [])
    .filter(e => e.username === username)
    .map(e => ({ ...e, media: data.media.find(m => m.id === e.mediaId) || null }))
    .filter(e => e.media);

  const uniqueMediaIds = new Set([
    ...reviews.map(r => r.mediaId),
    ...episodes.map(e => e.mediaId)
  ]);

  const starReviews = reviews.filter(r => r.ratingType === "stars");
  const avgScore = starReviews.length > 0
    ? (starReviews.reduce((s, r) => s + r.ratingValue, 0) / starReviews.length).toFixed(1)
    : null;

  const typeCounts = {};
  [...reviews, ...episodes].forEach(r => {
    const t = r.media?.type;
    if (t) typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  const favoriteType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  res.json({
    reviews,
    episodes,
    stats: {
      totalReviewed: uniqueMediaIds.size,
      totalReviews:  reviews.length,
      totalEpisodes: episodes.length,
      avgScore,
      favoriteType
    }
  });
});

// ── POST /api/reviews ─────────────────────────────────────────
router.post("/", (req, res) => {
  const { mediaId, username, ratingType, ratingValue, comment } = req.body;

  if (!mediaId || !username || !ratingType || ratingValue === undefined) {
    return res.status(400).json({ error: "Chybí povinná pole" });
  }

  try {
    normalize(ratingType, ratingValue);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const data      = db.read();
  const mediaItem = data.media.find(m => m.id === mediaId);
  if (!mediaItem) return res.status(404).json({ error: "MediaItem nenalezen" });

  const newReview = {
    id:        uuidv4(),
    mediaId,
    username:  username.trim(),
    ratingType,
    ratingValue,
    comment:   comment || null,
    createdAt: new Date().toISOString()
  };

  data.reviews.push(newReview);
  const mediaIndex = data.media.findIndex(m => m.id === mediaId);
  data.media[mediaIndex] = recalculate(mediaItem, data.reviews);
  db.write(data);
  res.status(201).json(newReview);
});

// ── DELETE /api/reviews/:id ───────────────────────────────────
router.delete("/:id", (req, res) => {
  const data  = db.read();
  const index = data.reviews.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Recenze nenalezena" });

  const { mediaId } = data.reviews[index];
  data.reviews.splice(index, 1);

  const mediaIndex = data.media.findIndex(m => m.id === mediaId);
  if (mediaIndex !== -1) {
    data.media[mediaIndex] = recalculate(data.media[mediaIndex], data.reviews);
  }

  db.write(data);
  res.status(204).send();
});

module.exports = router;
