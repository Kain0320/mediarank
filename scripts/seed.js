// ============================================================
//  scripts/seed.js  –  Naplní DB populárními filmy, seriály, hrami
//
//  Použití:
//    node scripts/seed.js
//
//  Přidá ~150 položek (50 filmů + 50 seriálů + 50 her).
//  Přeskočí duplicity (kontroluje tmdbId / igdbId).
// ============================================================

require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const db   = require("../helpers/db");
const { scoreToTier } = require("../helpers/scoring");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const IGDB_URL  = "https://api.igdb.com/v4";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";

// ── Barvy & emoji pro výpis ───────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  gray:   "\x1b[90m",
  bold:   "\x1b[1m",
  red:    "\x1b[31m",
};
const ok   = (s) => console.log(`  ${C.green}✓${C.reset} ${s}`);
const skip = (s) => console.log(`  ${C.gray}– ${s} (přeskočeno)${C.reset}`);
const info = (s) => console.log(`\n${C.bold}${C.cyan}${s}${C.reset}`);
const err  = (s) => console.log(`  ${C.red}✗ ${s}${C.reset}`);

// ── TMDB – seznam endpointů k načtení ─────────────────────────
// Každý endpoint = 1 stránka (20 výsledků)
const TMDB_MOVIE_PAGES = [
  "movie/popular",
  "movie/top_rated",
  "movie/now_playing",
];

const TMDB_SERIES_PAGES = [
  "tv/popular",
  "tv/top_rated",
  "tv/on_the_air",
];

// ── TMDB: načti jednu stránku výsledků ───────────────────────
async function fetchTmdbPage(endpoint, page = 1) {
  const url = `${TMDB_BASE}/${endpoint}?api_key=${process.env.TMDB_API_KEY}&language=cs-CZ&page=${page}`;
  const res  = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(`TMDB ${endpoint}: ${data.status_message}`);
  return data.results || [];
}

// ── TMDB: zpracuj výsledek na MediaItem ──────────────────────
function tmdbItemToMedia(item, type) {
  const score = item.vote_average
    ? Math.round(item.vote_average * 10) / 10
    : null;
  return {
    id:           uuidv4(),
    title:        (item.title || item.name || "").trim(),
    type,
    genre:        null,                     // genres v tomto endpointu jsou jen ID, necháme null
    summary:      item.overview || null,
    imageUrl:     item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null,
    year:         (item.release_date || item.first_air_date || "").slice(0, 4) || null,
    tmdbId:       item.id,
    igdbId:       null,
    overallScore: score,
    overallTier:  score ? scoreToTier(score) : null,
    createdAt:    new Date().toISOString(),
  };
}

// ── IGDB: získej access token ─────────────────────────────────
async function getIgdbToken() {
  const params = new URLSearchParams({
    client_id:     process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type:    "client_credentials",
  });
  const res  = await fetch(`${TOKEN_URL}?${params}`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(`IGDB token: ${data.message}`);
  return data.access_token;
}

// ── IGDB: načti N nejlepších her ─────────────────────────────
async function fetchTopGames(token, limit = 50) {
  const body = `
    fields name, cover.image_id, summary, rating, genres.name, first_release_date;
    where rating != null & version_parent = null & rating_count > 50;
    sort rating desc;
    limit ${limit};
  `;
  const res = await fetch(`${IGDB_URL}/games`, {
    method:  "POST",
    headers: {
      "Client-ID":     process.env.TWITCH_CLIENT_ID,
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "text/plain",
    },
    body,
  });
  if (!res.ok) throw new Error(`IGDB games: ${res.status}`);
  return await res.json();
}

// Druhá dávka her – různé žánry / platformy
async function fetchMoreGames(token, offset = 50, limit = 50) {
  const body = `
    fields name, cover.image_id, summary, rating, genres.name, first_release_date;
    where rating != null & version_parent = null & rating_count > 30;
    sort rating desc;
    limit ${limit};
    offset ${offset};
  `;
  const res = await fetch(`${IGDB_URL}/games`, {
    method:  "POST",
    headers: {
      "Client-ID":     process.env.TWITCH_CLIENT_ID,
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "text/plain",
    },
    body,
  });
  if (!res.ok) throw new Error(`IGDB games (offset): ${res.status}`);
  return await res.json();
}

// ── IGDB: zpracuj výsledek na MediaItem ──────────────────────
function igdbItemToMedia(game) {
  const rawRating = game.rating ? Math.round(game.rating) / 10 : null;
  const score     = rawRating ? Math.round(rawRating * 10) / 10 : null;
  return {
    id:           uuidv4(),
    title:        game.name,
    type:         "Game",
    genre:        game.genres ? game.genres.map(g => g.name).join(", ") : null,
    summary:      game.summary || null,
    imageUrl:     game.cover
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
      : null,
    year:         game.first_release_date
      ? new Date(game.first_release_date * 1000).getFullYear()
      : null,
    tmdbId:       null,
    igdbId:       game.id,
    overallScore: score,
    overallTier:  score ? scoreToTier(score) : null,
    createdAt:    new Date().toISOString(),
  };
}

// ── Hlavní funkce ─────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}🎬  Media Ranker – Seed skript${C.reset}`);
  console.log("═".repeat(50));

  const data = db.read();
  if (!data.reviews)  data.reviews  = [];
  if (!data.episodes) data.episodes = [];

  // Existující ID (pro přeskočení duplicit)
  const existingTmdbIds = new Set(data.media.map(m => m.tmdbId).filter(Boolean));
  const existingIgdbIds = new Set(data.media.map(m => m.igdbId).filter(Boolean));

  let addedMovies  = 0;
  let addedSeries  = 0;
  let addedGames   = 0;
  let skippedTotal = 0;

  // ── FILMY ─────────────────────────────────────────────────
  info("🎬  Načítám filmy z TMDB...");
  for (const endpoint of TMDB_MOVIE_PAGES) {
    try {
      // Stáhni 2 stránky z každého endpointu (= 40 filmů)
      for (const page of [1, 2]) {
        const results = await fetchTmdbPage(endpoint, page);
        for (const item of results) {
          if (!item.id || !item.title) continue;
          if (existingTmdbIds.has(item.id)) {
            skip(item.title);
            skippedTotal++;
            continue;
          }
          const media = tmdbItemToMedia(item, "Movie");
          if (!media.title) continue;
          data.media.push(media);
          existingTmdbIds.add(item.id);
          ok(media.title);
          addedMovies++;
        }
        // Krátká pauza aby jsme nefloodovali API
        await new Promise(r => setTimeout(r, 250));
      }
    } catch (e) {
      err(`Endpoint ${endpoint}: ${e.message}`);
    }
  }

  // ── SERIÁLY ───────────────────────────────────────────────
  info("📺  Načítám seriály z TMDB...");
  for (const endpoint of TMDB_SERIES_PAGES) {
    try {
      for (const page of [1, 2]) {
        const results = await fetchTmdbPage(endpoint, page);
        for (const item of results) {
          if (!item.id || !item.name) continue;
          if (existingTmdbIds.has(item.id)) {
            skip(item.name);
            skippedTotal++;
            continue;
          }
          const media = tmdbItemToMedia(item, "Series");
          if (!media.title) continue;
          data.media.push(media);
          existingTmdbIds.add(item.id);
          ok(media.title);
          addedSeries++;
        }
        await new Promise(r => setTimeout(r, 250));
      }
    } catch (e) {
      err(`Endpoint ${endpoint}: ${e.message}`);
    }
  }

  // ── HRY ───────────────────────────────────────────────────
  info("🎮  Načítám hry z IGDB...");
  try {
    const igdbToken = await getIgdbToken();

    const [batch1, batch2] = await Promise.all([
      fetchTopGames(igdbToken, 50),
      fetchMoreGames(igdbToken, 50, 50),
    ]);

    const allGames = [...batch1, ...batch2];

    for (const game of allGames) {
      if (!game.id || !game.name) continue;
      if (existingIgdbIds.has(game.id)) {
        skip(game.name);
        skippedTotal++;
        continue;
      }
      const media = igdbItemToMedia(game);
      data.media.push(media);
      existingIgdbIds.add(game.id);
      ok(media.title);
      addedGames++;
    }
  } catch (e) {
    err(`IGDB: ${e.message}`);
  }

  // ── Uložení ───────────────────────────────────────────────
  db.write(data);

  console.log("\n" + "═".repeat(50));
  console.log(`${C.bold}✅  Hotovo!${C.reset}`);
  console.log(`   ${C.green}Filmy přidány:${C.reset}   ${addedMovies}`);
  console.log(`   ${C.green}Seriály přidány:${C.reset} ${addedSeries}`);
  console.log(`   ${C.green}Hry přidány:${C.reset}     ${addedGames}`);
  console.log(`   ${C.gray}Přeskočeno:${C.reset}      ${skippedTotal}`);
  console.log(`   ${C.bold}Celkem v DB:${C.reset}     ${data.media.length}`);
  console.log("");
}

main().catch(e => {
  console.error(`\n${C.red}Fatální chyba: ${e.message}${C.reset}`);
  process.exit(1);
});
