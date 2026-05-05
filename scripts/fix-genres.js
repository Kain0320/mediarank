// ============================================================
//  scripts/fix-genres.js
//  Doplní žánry pro filmy a seriály z TMDB API.
//  Bezpečné opakované spouštění – přeskočí položky, které žánr mají.
//
//  Použití:  node scripts/fix-genres.js
// ============================================================

require("dotenv").config();
const db = require("../helpers/db");

const TMDB_BASE = "https://api.themoviedb.org/3";
const KEY       = process.env.TMDB_API_KEY;

const C = {
  reset:  "\x1b[0m",  green: "\x1b[32m",
  yellow: "\x1b[33m", cyan:  "\x1b[36m",
  gray:   "\x1b[90m", bold:  "\x1b[1m",  red: "\x1b[31m",
};

// ── Načti mapu genre_id → název ze TMDB ──────────────────────
async function fetchGenreMap(mediaType) {
  const url = `${TMDB_BASE}/genre/${mediaType}/list?api_key=${KEY}&language=cs-CZ`;
  const res  = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(`Genre list error: ${data.status_message}`);
  const map = {};
  data.genres.forEach(g => { map[g.id] = g.name; });
  return map;
}

// ── Stáhni detail jedné položky (má genre_ids) ───────────────
async function fetchDetails(tmdbId, mediaType) {
  const url = `${TMDB_BASE}/${mediaType}/${tmdbId}?api_key=${KEY}&language=cs-CZ`;
  const res  = await fetch(url);
  if (!res.ok) return null;
  return await res.json();
}

// ── Pauza ────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Hlavní ───────────────────────────────────────────────────
async function main() {
  console.log(`\n${C.bold}${C.cyan}🎭  Fix Genres – Media Ranker${C.reset}`);
  console.log("═".repeat(50));

  const data = db.read();

  // Položky bez žánru s tmdbId
  const movies = data.media.filter(m => m.type === "Movie" && m.tmdbId && !m.genre);
  const series = data.media.filter(m => m.type === "Series" && m.tmdbId && !m.genre);

  console.log(`\nFilmů bez žánru:   ${C.yellow}${movies.length}${C.reset}`);
  console.log(`Seriálů bez žánru: ${C.yellow}${series.length}${C.reset}`);

  if (movies.length === 0 && series.length === 0) {
    console.log(`\n${C.green}✅ Všechny položky already mají žánry!${C.reset}\n`);
    return;
  }

  let fixed = 0;
  let failed = 0;

  // ── Filmy ─────────────────────────────────────────────────
  if (movies.length > 0) {
    console.log(`\n${C.bold}🎬 Doplňuji žánry filmů...${C.reset}`);
    for (const item of movies) {
      try {
        const detail = await fetchDetails(item.tmdbId, "movie");
        if (detail && detail.genres && detail.genres.length > 0) {
          const genre = detail.genres.map(g => g.name).join(", ");
          const idx   = data.media.findIndex(m => m.id === item.id);
          if (idx !== -1) {
            data.media[idx].genre = genre;
            console.log(`  ${C.green}✓${C.reset} ${item.title.padEnd(40)} → ${C.cyan}${genre}${C.reset}`);
            fixed++;
          }
        } else {
          console.log(`  ${C.gray}– ${item.title} (bez žánru v TMDB)${C.reset}`);
        }
        await sleep(80); // ~12 req/s, TMDB limit je 50/s
      } catch (e) {
        console.log(`  ${C.red}✗ ${item.title}: ${e.message}${C.reset}`);
        failed++;
      }
    }
  }

  // ── Seriály ───────────────────────────────────────────────
  if (series.length > 0) {
    console.log(`\n${C.bold}📺 Doplňuji žánry seriálů...${C.reset}`);
    for (const item of series) {
      try {
        const detail = await fetchDetails(item.tmdbId, "tv");
        if (detail && detail.genres && detail.genres.length > 0) {
          const genre = detail.genres.map(g => g.name).join(", ");
          const idx   = data.media.findIndex(m => m.id === item.id);
          if (idx !== -1) {
            data.media[idx].genre = genre;
            console.log(`  ${C.green}✓${C.reset} ${item.title.padEnd(40)} → ${C.cyan}${genre}${C.reset}`);
            fixed++;
          }
        } else {
          console.log(`  ${C.gray}– ${item.title} (bez žánru v TMDB)${C.reset}`);
        }
        await sleep(80);
      } catch (e) {
        console.log(`  ${C.red}✗ ${item.title}: ${e.message}${C.reset}`);
        failed++;
      }
    }
  }

  // ── Uložení ───────────────────────────────────────────────
  db.write(data);

  console.log("\n" + "═".repeat(50));
  console.log(`${C.bold}✅ Hotovo!${C.reset}`);
  console.log(`   ${C.green}Doplněno žánrů:${C.reset}  ${fixed}`);
  if (failed > 0)
    console.log(`   ${C.red}Selhalo:${C.reset}         ${failed}`);

  // ── Statistika po opravě ─────────────────────────────────
  const after = db.read();
  const withGenre = after.media.filter(m => m.genre).length;
  console.log(`   ${C.bold}Celkem s žánrem:${C.reset} ${withGenre} / ${after.media.length}`);
  console.log("");
}

main().catch(e => {
  console.error(`\n${C.red}Chyba: ${e.message}${C.reset}`);
  process.exit(1);
});
