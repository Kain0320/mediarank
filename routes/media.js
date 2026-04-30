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
const { v4: uuidv4 } = require("uuid"); // npm install uuid
const db      = require("../helpers/db");

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
  const { title, type, genre, imageUrl } = req.body;
  const updated = {
    ...data.media[index],
    ...(title    && { title:    title.trim() }),
    ...(type     && { type }),
    ...(genre    !== undefined && { genre }),
    ...(imageUrl !== undefined && { imageUrl })
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
  // Kaskádové smazání recenzí patřících k tomuto media
  data.reviews = data.reviews.filter(r => r.mediaId !== req.params.id);
  db.write(data);

  // HTTP 204 = No Content (úspěch, ale bez těla odpovědi)
  res.status(204).send();
});

module.exports = router;
