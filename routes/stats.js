// ============================================================
//  routes/stats.js  –  Agregovaná statistika pro grafy
// ============================================================
//  GET /api/stats   → vrátí vše co potřebují Chart.js grafy
// ============================================================

const express = require("express");
const router  = express.Router();
const db      = require("../helpers/db");

router.get("/", (req, res) => {
  const { media, reviews } = db.read();

  // ── Počty podle typu ──────────────────────────────────────
  const byType = { Movie: 0, Series: 0, Game: 0 };
  media.forEach(m => { if (byType[m.type] !== undefined) byType[m.type]++; });

  // ── Počty podle tieru (jen hodnocené) ────────────────────
  const byTier = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  media.forEach(m => { if (m.overallTier) byTier[m.overallTier]++; });

  // ── Top 5 podle skóre ─────────────────────────────────────
  const top5 = [...media]
    .filter(m => m.overallScore !== null)
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 5)
    .map(m => ({ title: m.title, score: m.overallScore, type: m.type, tier: m.overallTier }));

  // ── Průměrné skóre podle typu ─────────────────────────────
  const avgByType = {};
  ["Movie", "Series", "Game"].forEach(t => {
    const items = media.filter(m => m.type === t && m.overallScore !== null);
    avgByType[t] = items.length
      ? Math.round(items.reduce((s, m) => s + m.overallScore, 0) / items.length * 10) / 10
      : 0;
  });

  res.json({
    total:    media.length,
    reviews:  reviews.length,
    byType,
    byTier,
    top5,
    avgByType
  });
});

module.exports = router;
