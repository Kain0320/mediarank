// ============================================================
//  helpers/scoring.js  –  Sjednocení hodnocení hvězdy ↔ tier
// ============================================================
//
//  MATEMATICKÝ MODEL
//  ─────────────────
//  Cílem je převést obě škály na společnou číselnou osu 1–10,
//  ze které pak spočítáme průměr a zpětně odvodíme Tier.
//
//  Tier → číslo (střed rozsahu každého tieru):
//    S = 9.5   (rozsah 9–10)
//    A = 7.5   (rozsah 7–8.9)
//    B = 5.5   (rozsah 5–6.9)
//    C = 3.5   (rozsah 3–4.9)
//    D = 1.5   (rozsah 1–2.9)
//
//  Hvězdy 1–10 → číslo: beze změny (už jsou na škále 1–10)
//
//  Výpočet průměru pro MediaItem:
//    overallScore = průměr všech normalizovaných hodnot recenzí
//
//  Zpětný převod průměru → Tier:
//    >= 8.5  → S
//    >= 6.5  → A
//    >= 4.5  → B
//    >= 2.5  → C
//    <  2.5  → D
//
// ============================================================

const TIER_TO_NUMBER = {
  S: 9.5,
  A: 7.5,
  B: 5.5,
  C: 3.5,
  D: 1.5
};

/**
 * Normalizuje jednu recenzi na číslo 1–10.
 * @param {"stars"|"tier"} ratingType
 * @param {number|string}  ratingValue  – číslo 1-10, nebo "S"/"A"/"B"/"C"/"D"
 * @returns {number}
 */
function normalize(ratingType, ratingValue) {
  if (ratingType === "stars") {
    const n = Number(ratingValue);
    if (n < 1 || n > 10) throw new Error("Hvězdy musí být 1–10");
    return n;
  }
  if (ratingType === "tier") {
    const upper = String(ratingValue).toUpperCase();
    if (!TIER_TO_NUMBER[upper]) throw new Error("Tier musí být S/A/B/C/D");
    return TIER_TO_NUMBER[upper];
  }
  throw new Error("Neznámý typ hodnocení: " + ratingType);
}

/**
 * Převede průměrné skóre zpět na Tier štítek.
 * @param {number} score  – průměr na škále 1–10
 * @returns {"S"|"A"|"B"|"C"|"D"}
 */
function scoreToTier(score) {
  if (score >= 8.5) return "S";
  if (score >= 6.5) return "A";
  if (score >= 4.5) return "B";
  if (score >= 2.5) return "C";
  return "D";
}

/**
 * Přepočítá overallScore a overallTier pro danou media položku
 * na základě všech jejích recenzí.
 *
 * Volej tuto funkci po každém přidání / smazání recenze.
 *
 * @param {Object}   mediaItem  – objekt MediaItem (bude mutován)
 * @param {Array}    reviews    – všechny recenze z DB (budou filtrovány)
 * @returns {Object} aktualizovaný mediaItem
 */
function recalculate(mediaItem, reviews) {
  // Vyber jen recenze patřící k tomuto media
  const relevant = reviews.filter(r => r.mediaId === mediaItem.id);

  if (relevant.length === 0) {
    mediaItem.overallScore = null;
    mediaItem.overallTier  = null;
    return mediaItem;
  }

  // Normalizuj každou recenzi a spočítej průměr
  const values = relevant.map(r => normalize(r.ratingType, r.ratingValue));
  const avg    = values.reduce((sum, v) => sum + v, 0) / values.length;

  mediaItem.overallScore = Math.round(avg * 10) / 10;  // 1 desetinné místo
  mediaItem.overallTier  = scoreToTier(avg);

  return mediaItem;
}

module.exports = { normalize, scoreToTier, recalculate };
