// ============================================================
//  helpers/tmdb.js  –  TMDB API (filmy + seriály)
// ============================================================

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const TMDB_FACE = "https://image.tmdb.org/t/p/w185";

function apiKey() { return process.env.TMDB_API_KEY; }

// ── Vyhledávání ───────────────────────────────────────────────
async function searchMedia(query, type = "Movie", limit = 6) {
  const endpoint = type === "Series" ? "tv" : "movie";
  const url = `${TMDB_BASE}/search/${endpoint}?query=${encodeURIComponent(query)}&api_key=${apiKey()}&language=cs-CZ`;

  const res  = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(`TMDB error: ${data.status_message}`);

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

// ── Detail filmu ──────────────────────────────────────────────
async function getMovieDetails(tmdbId) {
  const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${apiKey()}&language=cs-CZ&append_to_response=videos,credits`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`TMDB movie detail error: ${res.status}`);
  const d = await res.json();

  // Trailer – hledáme YouTube Official Trailer, jinak první YouTube video
  const videos   = d.videos?.results || [];
  const trailer  = videos.find(v => v.site === "YouTube" && v.type === "Trailer")
                || videos.find(v => v.site === "YouTube");
  const trailerKey = trailer?.key || null;

  // Obsazení – max 10 herců
  const cast = (d.credits?.cast || []).slice(0, 10).map(p => ({
    name:      p.name,
    character: p.character || null,
    photo:     p.profile_path ? `${TMDB_FACE}${p.profile_path}` : null
  }));

  // Režisér, scénárista
  const crew      = d.credits?.crew || [];
  const directors = crew.filter(c => c.job === "Director").map(c => c.name);
  const writers   = crew.filter(c => c.department === "Writing").slice(0, 3).map(c => c.name);
  const productionCo = (d.production_companies || []).slice(0, 3).map(c => c.name);

  return {
    trailerKey,
    cast,
    runtime:       d.runtime || null,
    originalTitle: d.original_title !== d.title ? d.original_title : null,
    status:        d.status || null,
    budget:        d.budget || null,
    revenue:       d.revenue || null,
    directors,
    writers,
    productionCo
  };
}

// ── Detail seriálu ────────────────────────────────────────────
async function getSeriesDetails(tmdbId) {
  const url = `${TMDB_BASE}/tv/${tmdbId}?api_key=${apiKey()}&language=cs-CZ&append_to_response=videos,credits`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`TMDB series detail error: ${res.status}`);
  const d = await res.json();

  const videos  = d.videos?.results || [];
  const trailer = videos.find(v => v.site === "YouTube" && v.type === "Trailer")
               || videos.find(v => v.site === "YouTube");

  const cast = (d.credits?.cast || []).slice(0, 10).map(p => ({
    name:      p.name,
    character: p.character || null,
    photo:     p.profile_path ? `${TMDB_FACE}${p.profile_path}` : null
  }));

  const creators = (d.created_by || []).map(c => c.name);
  const networks = (d.networks   || []).map(n => n.name);

  return {
    trailerKey:        trailer?.key || null,
    cast,
    numberOfSeasons:   d.number_of_seasons  || 0,
    numberOfEpisodes:  d.number_of_episodes || 0,
    episodeRuntime:    d.episode_run_time?.[0] || null,
    originalTitle:     d.original_name !== d.name ? d.original_name : null,
    status:            d.status || null,
    creators,
    networks
  };
}

// ── Epizody jedné sezóny ──────────────────────────────────────
async function getSeasonEpisodes(tmdbId, seasonNum) {
  const url = `${TMDB_BASE}/tv/${tmdbId}/season/${seasonNum}?api_key=${apiKey()}&language=cs-CZ`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`TMDB season error: ${res.status}`);
  const d = await res.json();

  return (d.episodes || []).map(ep => ({
    episode:  ep.episode_number,
    name:     ep.name || null,
    overview: ep.overview || null,
    airDate:  ep.air_date || null,
    runtime:  ep.runtime  || null
  }));
}

module.exports = { searchMedia, getMovieDetails, getSeriesDetails, getSeasonEpisodes };
