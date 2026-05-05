# 🎬 Media Ranker

> Osobní databáze filmů, seriálů a her s hodnocením, tiery, watchlistem a statistikami.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![Bootstrap 5](https://img.shields.io/badge/Bootstrap_5-7952B3?style=flat&logo=bootstrap&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=flat&logo=chartdotjs&logoColor=white)

---

## 📸 Náhled

| Hlavní stránka | Detail média | Admin panel |
|---|---|---|
| Karty s filtry, grafy, watchlist | Trailer, obsazení, hodnocení | Správa položek, import, hromadné akce |

---

## ✨ Funkce

### Pro uživatele
- 🔍 **Filtry a vyhledávání** — podle typu (film / seriál / hra), žánru, skóre, tieru, řazení
- ⭐ **Hodnocení** — hvězdičky (1–10) nebo tier (S / A / B / C / D) s komentářem
- 🔖 **Watchlist** — přidávání filmů a seriálů, hry do "Do hraní" seznamu
- 📺 **Sezóny a epizody** — hodnocení každé epizody seriálu zvlášť
- 🎬 **Detail média** — trailer (YouTube), obsazení, runtime, produkce (TMDB / IGDB)
- 👤 **Profil** — přehled hodnocení, watchlist, statistiky (průměrné skóre, oblíbený typ)
- 🌓 **Světlé / tmavé téma** — uložené v localStorage, bez bliknutí při načtení
- 📄 **Stránkování** — čísla stránek s elipsou (1 … 4 5 6 … 24)

### Pro admina
- ➕ **Import z TMDB / IGDB** — vyhledávání filmů, seriálů a her s náhledem před importem
- ✏️ **Úprava položek** — název, typ, žánr, rok, URL obrázku, popis
- 🗑️ **Hromadné mazání** — výběr více položek najednou
- 📊 **Přehled** — počet recenzí u každé položky, řazení a filtrování tabulky
- 🎮 **Správa epizod** — přidávání a mazání hodnocení epizod (admin bez loginu)

---

## 🛠️ Technologie

| Vrstva | Technologie |
|---|---|
| **Backend** | Node.js, Express.js |
| **Databáze** | JSON soubor (`data/data.json`) |
| **Autentizace** | Token-based (SHA-256 hash hesel a emailů) |
| **Frontend** | Vanilla JS, Bootstrap 5, Bootstrap Icons |
| **Grafy** | Chart.js (doughnut, bar, horizontal bar) |
| **Filmová API** | TMDB (filmy + seriály), IGDB (hry přes Twitch) |

---

## 🚀 Spuštění

### Požadavky
- Node.js ≥ 18
- TMDB API klíč → [themoviedb.org](https://www.themoviedb.org/settings/api)
- Twitch Client ID + Secret → [dev.twitch.tv](https://dev.twitch.tv/console)

### Instalace

```bash
git clone https://github.com/Kain0320/mediarank.git
cd mediarank
npm install
```

### Konfigurace

Vytvoř soubor `.env` v kořeni projektu:

```env
TMDB_API_KEY=tvuj_tmdb_klic
TWITCH_CLIENT_ID=tvuj_twitch_client_id
TWITCH_CLIENT_SECRET=tvuj_twitch_secret
```

### Spuštění

```bash
# Produkce
npm start

# Vývoj (auto-restart)
npm run dev
```

Aplikace běží na **http://localhost:3000**

---

## 📁 Struktura projektu

```
mediarank/
├── routes/
│   ├── auth.js          # Registrace, přihlášení, middleware
│   ├── media.js         # CRUD médií, epizody, TMDB/IGDB detail
│   ├── reviews.js       # Recenze, profil, "Moje hodnocení"
│   ├── search.js        # Vyhledávání TMDB + IGDB, import
│   ├── stats.js         # Statistiky pro grafy
│   └── watchlist.js     # Watchlist / seznam hraní
├── helpers/
│   ├── db.js            # Čtení/zápis data.json
│   ├── tmdb.js          # TMDB API (filmy, seriály, sezóny, trailer)
│   ├── igdb.js          # IGDB API (hry, screenshoty)
│   └── scoring.js       # Výpočet skóre a tieru
├── public/
│   ├── index.html       # Hlavní stránka
│   ├── media.html       # Detail média
│   ├── profile.html     # Profil uživatele
│   ├── admin.html       # Admin panel
│   ├── login.html       # Přihlášení
│   ├── register.html    # Registrace
│   ├── css/style.css    # Vlastní styly + témata
│   └── js/
│       ├── app.js       # Logika hlavní stránky
│       ├── admin.js     # Logika admin panelu
│       ├── profile.js   # Logika profilu
│       └── toast.js     # Toast notifikace
├── data/
│   └── data.json        # Databáze (gitignored)
├── server.js            # Vstupní bod aplikace
└── .env                 # API klíče (gitignored)
```

---

## 🔑 API přehled

| Metoda | Endpoint | Popis |
|---|---|---|
| `GET` | `/api/media` | Seznam všech médií |
| `GET` | `/api/media/:id` | Detail jednoho média |
| `GET` | `/api/media/:id/extra` | Trailer, obsazení, runtime (TMDB/IGDB) |
| `POST` | `/api/media` | Přidat médium |
| `PUT` | `/api/media/:id` | Upravit médium |
| `DELETE` | `/api/media/:id` | Smazat médium |
| `GET` | `/api/reviews` | Seznam recenzí (filtrovatelný) |
| `POST` | `/api/reviews` | Přidat recenzi |
| `GET` | `/api/reviews/my-full` | Profil – hodnocení + statistiky |
| `GET` | `/api/watchlist` | Watchlist přihlášeného uživatele |
| `POST` | `/api/watchlist/:mediaId` | Přidat do watchlistu |
| `DELETE` | `/api/watchlist/:mediaId` | Odebrat z watchlistu |
| `GET` | `/api/search?q=&type=` | Vyhledávání v TMDB/IGDB |
| `POST` | `/api/search/import` | Importovat výsledek do databáze |
| `POST` | `/api/auth/register` | Registrace |
| `POST` | `/api/auth/login` | Přihlášení (username nebo e-mail) |
| `GET` | `/api/stats` | Statistiky pro grafy |

---

## 👤 Přihlášení

| Role | Jméno | Heslo |
|---|---|---|
| Admin | `admin` | `admin123` |
| Uživatel | registrace přes `/register.html` | — |

> Hesla a e-maily jsou uloženy jako SHA-256 hash – nikdy v plaintextu.

---

## 📊 Systém hodnocení

**Hvězdičky (1–10)** → průměr všech hodnocení = `overallScore`

**Tier (S–D)** → převod na numerickou hodnotu (S=10, A=8, B=6, C=4, D=2) → průměr

Pokud je kombinace obou typů, finální skóre = vážený průměr.

| Tier | Skóre | Barva |
|---|---|---|
| **S** | 9+ | 🔴 Červená |
| **A** | 7–9 | 🟡 Žlutá |
| **B** | 5–7 | 🟢 Zelená |
| **C** | 3–5 | 🔵 Modrá |
| **D** | < 3 | ⚫ Šedá |

---

*Semestrální projekt – Media Ranker*
