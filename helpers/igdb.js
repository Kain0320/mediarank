// ============================================================
//  helpers/igdb.js  –  IGDB API (hry, powered by Twitch)
// ============================================================
//
//  Jak IGDB autentizace funguje:
//  1. Pošleš POST na Twitch token endpoint s Client ID + Secret
//  2. Dostaneš access_token (platí ~60 dní)
//  3. Každý dotaz na IGDB API posíláš s tímto tokenem v hlavičce
//
//  Dokumentace: https://api-docs.igdb.com/
//
// ============================================================

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_URL  = "https://api.igdb.com/v4";

// Token cachujeme v paměti – nemusíme ho získávat při každém dotazu
let cachedToken     = null;
let tokenExpiresAt  = 0;

async function getAccessToken() {
  // Pokud token stále platí (s 60s rezervou), vrátíme ho rovnou
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    client_id:     process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type:    "client_credentials"
  });

  const res  = await fetch(`${TOKEN_URL}?${params}`, { method: "POST" });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`IGDB token error: ${data.message}`);
  }

  cachedToken    = data.access_token;
  // expires_in je v sekundách, převedeme na ms
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  return cachedToken;
}

/**
 * Vyhledá hry na IGDB podle názvu.
 * @param {string} query – název hry
 * @param {number} limit – max výsledků (default 6)
 * @returns {Array} pole her s id, name, cover, summary, rating
 */
async function searchGames(query, limit = 6) {
  const token = await getAccessToken();

  // IGDB používá vlastní query jazyk (Apicalypse)
  const body = `
    search "${query}";
    fields name, cover.image_id, summary, rating, genres.name, first_release_date;
    where version_parent = null;
    limit ${limit};
  `;

  const res  = await fetch(`${IGDB_URL}/games`, {
    method:  "POST",
    headers: {
      "Client-ID":     process.env.TWITCH_CLIENT_ID,
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "text/plain"
    },
    body
  });

  if (!res.ok) {
    throw new Error(`IGDB search error: ${res.status}`);
  }

  const games = await res.json();

  // Normalizujeme data do stejného formátu jako naše MediaItem
  return games.map(g => ({
    igdbId:    g.id,
    title:     g.name,
    type:      "Game",
    summary:   g.summary || null,
    imageUrl:  g.cover
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`
      : null,
    rating:    g.rating ? Math.round(g.rating) / 10 : null, // IGDB dává 0–100, my chceme 0–10
    genres:    g.genres ? g.genres.map(gr => gr.name).join(", ") : null,
    year:      g.first_release_date
      ? new Date(g.first_release_date * 1000).getFullYear()
      : null
  }));
}

/**
 * Načte detail hry z IGDB (screenshoty, vývojáři, platformy, atd.)
 * @param {number} igdbId – IGDB ID hry
 */
async function getGameDetails(igdbId) {
  const token = await getAccessToken();

  const body = `
    fields name, summary, storyline,
           screenshots.image_id,
           involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
           platforms.name,
           game_modes.name,
           websites.url, websites.category,
           rating;
    where id = ${igdbId};
    limit 1;
  `;

  const res = await fetch(`${IGDB_URL}/games`, {
    method:  "POST",
    headers: {
      "Client-ID":     process.env.TWITCH_CLIENT_ID,
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "text/plain"
    },
    body
  });

  if (!res.ok) throw new Error(`IGDB detail error: ${res.status}`);

  const games = await res.json();
  if (!games.length) throw new Error("Game not found");
  const g = games[0];

  const screenshots = (g.screenshots || []).slice(0, 8).map(s =>
    `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`
  );

  const companies   = g.involved_companies || [];
  const developers  = companies.filter(c => c.developer).map(c => c.company?.name).filter(Boolean);
  const publishers  = companies.filter(c => c.publisher).map(c => c.company?.name).filter(Boolean);

  // Web – kategorie 1 = official
  const website = (g.websites || []).find(w => w.category === 1)?.url || null;

  const platforms  = (g.platforms  || []).map(p => p.name);
  const gameModes  = (g.game_modes || []).map(m => m.name);
  const criticScore = g.rating ? Math.round(g.rating) / 10 : null;
  const storyline  = g.storyline || null;

  return { screenshots, developers, publishers, platforms, gameModes, website, criticScore, storyline };
}

module.exports = { searchGames, getGameDetails };
