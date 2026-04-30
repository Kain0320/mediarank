// ============================================================
//  helpers/db.js  –  Jednoduchá "databáze" v JSON souboru
// ============================================================
//
//  Proč helper soubor?
//  Abychom čtení/zápis JSON neopisovali v každém route souboru.
//  Stačí volat:  const db = require("./helpers/db");
//                const data = db.read();
//                db.write(data);
//
// ============================================================

const fs   = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../data/data.json");

// Výchozí struktura prázdné databáze
const DEFAULT_DATA = {
  media:   [],   // pole MediaItem objektů
  reviews: []    // pole Review objektů
};

/**
 * Přečte a vrátí celý obsah data.json.
 * Pokud soubor neexistuje, vytvoří ho s výchozí prázdnou strukturou.
 * @returns {{ media: Array, reviews: Array }}
 */
function read() {
  if (!fs.existsSync(DATA_FILE)) {
    write(DEFAULT_DATA);
    return DEFAULT_DATA;
  }
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

/**
 * Zapíše předaný objekt jako data.json (přepíše celý soubor).
 * @param {{ media: Array, reviews: Array }} data
 */
function write(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

module.exports = { read, write };
