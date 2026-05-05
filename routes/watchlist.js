// ============================================================
//  routes/watchlist.js  –  Watchlist (chci sledovat)
// ============================================================
//
//  GET    /api/watchlist         – watchlist přihlášeného uživatele
//  GET    /api/watchlist/ids     – jen seznam mediaId
//  POST   /api/watchlist/:id     – přidat do watchlistu
//  DELETE /api/watchlist/:id     – odebrat z watchlistu
//
// ============================================================

const express = require("express");
const router  = express.Router();
const db      = require("../helpers/db");
const { requireLogin } = require("./auth");

// ── GET /api/watchlist ────────────────────────────────────────
// Vrátí watchlist s připojenými media objekty
router.get("/", requireLogin, (req, res) => {
  const data     = db.read();
  const username = req.user.username;

  const result = (data.watchlist || [])
    .filter(w => w.username === username)
    .map(w => ({ ...w, media: data.media.find(m => m.id === w.mediaId) || null }))
    .filter(w => w.media)
    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

  res.json(result);
});

// ── GET /api/watchlist/ids ────────────────────────────────────
// Jen seznam mediaId (pro rychlé zobrazení stavu tlačítek)
router.get("/ids", requireLogin, (req, res) => {
  const data     = db.read();
  const username = req.user.username;

  const mediaIds = (data.watchlist || [])
    .filter(w => w.username === username)
    .map(w => w.mediaId);

  res.json({ mediaIds });
});

// ── POST /api/watchlist/:mediaId ──────────────────────────────
// Přidá media do watchlistu
router.post("/:mediaId", requireLogin, (req, res) => {
  const data     = db.read();
  const username = req.user.username;
  const mediaId  = req.params.mediaId;

  if (!data.media.find(m => m.id === mediaId)) {
    return res.status(404).json({ error: "Media nenalezeno" });
  }

  if (!data.watchlist) data.watchlist = [];

  if (data.watchlist.find(w => w.username === username && w.mediaId === mediaId)) {
    return res.status(409).json({ error: "Již ve watchlistu" });
  }

  data.watchlist.push({ username, mediaId, addedAt: new Date().toISOString() });
  db.write(data);
  res.status(201).json({ ok: true });
});

// ── DELETE /api/watchlist/:mediaId ────────────────────────────
// Odebere media z watchlistu
router.delete("/:mediaId", requireLogin, (req, res) => {
  const data     = db.read();
  const username = req.user.username;
  const mediaId  = req.params.mediaId;

  if (!data.watchlist) {
    return res.status(404).json({ error: "Nenalezeno" });
  }

  const before = data.watchlist.length;
  data.watchlist = data.watchlist.filter(
    w => !(w.username === username && w.mediaId === mediaId)
  );

  if (data.watchlist.length === before) {
    return res.status(404).json({ error: "Nenalezeno ve watchlistu" });
  }

  db.write(data);
  res.status(204).send();
});

module.exports = router;
