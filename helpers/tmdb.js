// ============================================================
//  helpers/tmdb.js  –  TMDB API (filmy + seriály)
// ============================================================
//
//  Dokumentace: https://developer.themoviedb.org/docs
//  API klíč nastavíš v .env jako TMDB_API_KEY
//
// ============================================================

const TMDB_BASE    = "https://api.themoviedb.org/3";
const TMDB_IMG     = "https://image.tmdb.org/t/p/w500";

/**
 * Vyhledá filmy nebo seriály na TMDB.
 * @param {string} query   – název
 * @param {"Movie"|"Series"} type – typ hledání
 * @param {number} limit   – max výsledků (default 6)
 */
async function searchMedia(query, type = "Movie", limit = 6) {
  const endpoint = type === "Series" ? "tv" : "movie";
  const url = `${TMDB_BASE}/search/${endpoint}?query=${encodeURIComponent(query)}&api_key=${process.env.TMDB_API_KEY}&language=cs-CZ`;

  const res  = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`TMDB error: ${data.status_message}`);
  }

  return data.results.slice(0, limit).map(item => ({
    tmdbId:   item.id,
    title:    item.title || item.name,
    type,
    summary:  item.overview || null,
    imageUrl: item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null,
    rating:   item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
    year:     (item.release_date || item.first_air_date || "").slice(0, 4) || null
  }));
}

module.exports = { searchMedia };
