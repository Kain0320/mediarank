// ============================================================
//  routes/auth.js  –  Registrace, přihlášení, middleware
// ============================================================

const express = require("express");
const router  = express.Router();
const { v4: uuidv4 } = require("uuid");
const db = require("../helpers/db");

// Statický admin token (pro zpětnou kompatibilitu s admin.html)
const ADMIN_TOKEN = "supersecret-admin-token-2024";

// ── POST /api/auth/register ───────────────────────────────────
// Tělo: { username, email, password, gender }
// Pole odpovídají PHP projektu (signup.php + user.class.php)
router.post("/register", (req, res) => {
  const { username, email, password, gender } = req.body;

  const errors = [];
  if (!username || username.trim().length < 3)
    errors.push("Username musí mít aspoň 3 znaky a obsahovat jen písmena");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push("Zadej platný e-mail");
  if (!password || password.length < 4)
    errors.push("Heslo musí mít aspoň 4 znaky");
  if (!gender || !["Male", "Female"].includes(gender))
    errors.push("Vyber pohlaví");

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const data = db.read();

  if (data.users.find(u => u.username === username.trim())) {
    return res.status(409).json({ errors: ["Uživatelské jméno je již obsazené"] });
  }
  if (data.users.find(u => u.email === email.toLowerCase())) {
    return res.status(409).json({ errors: ["E-mail je již registrován"] });
  }

  const newUser = {
    id:        uuidv4(),
    username:  username.trim(),
    email:     email.toLowerCase(),
    password,
    gender,
    role:      "user",
    createdAt: new Date().toISOString()
  };

  data.users.push(newUser);
  db.write(data);

  const token = `user-token-${newUser.id}`;
  res.status(201).json({
    message:  "Registrace úspěšná",
    token,
    username: newUser.username,
    role:     newUser.role
  });
});

// ── POST /api/auth/login ──────────────────────────────────────
// Tělo: { username, password }
// Funguje pro admina i pro běžné uživatele
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Pevný admin (pro semestrálku OK)
  if (username === "admin" && password === "admin123") {
    return res.json({
      token:    ADMIN_TOKEN,
      username: "admin",
      role:     "admin",
      message:  "Přihlášení úspěšné"
    });
  }

  // Hledáme uživatele v databázi – login přes e-mail (jako PHP projekt)
  const data = db.read();
  const user = data.users.find(
    u => u.email === username.toLowerCase() && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: "Nesprávné přihlašovací údaje" });
  }

  const token = `user-token-${user.id}`;
  res.json({
    token,
    username: user.username,
    role:     user.role,
    message:  "Přihlášení úspěšné"
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────
// Vrátí info o přihlášeném uživateli (ověření tokenu)
router.get("/me", (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Nejsi přihlášen" });
  }

  const token = authHeader.split(" ")[1];

  // Pevný admin token
  if (token === ADMIN_TOKEN) {
    return res.json({ username: "admin", role: "admin" });
  }

  // Uživatelský token má tvar "user-token-<uuid>"
  const data = db.read();
  const user = data.users.find(u => `user-token-${u.id}` === token);

  if (!user) {
    return res.status(401).json({ error: "Neplatný token" });
  }

  res.json({ username: user.username, role: user.role });
});

// ── Middleware: requireAdmin ──────────────────────────────────
// Použij v route souborech pro ochranu admin endpointů:
//   const { requireAdmin } = require("./auth");
//   router.delete("/:id", requireAdmin, handler);
function requireAdmin(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Chybí autorizační token" });
  }

  const token = authHeader.split(" ")[1];
  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ error: "Přístup odepřen – pouze admin" });
  }

  next();
}

// ── Middleware: requireLogin ──────────────────────────────────
// Použij pro endpointy, které potřebují přihlášeného uživatele (admin i user):
//   router.post("/reviews", requireLogin, handler);
function requireLogin(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Musíš být přihlášen" });
  }

  const token = authHeader.split(" ")[1];

  if (token === ADMIN_TOKEN) {
    req.user = { username: "admin", role: "admin" };
    return next();
  }

  const data = db.read();
  const user = data.users.find(u => `user-token-${u.id}` === token);

  if (!user) {
    return res.status(401).json({ error: "Neplatný token" });
  }

  req.user = { username: user.username, role: user.role, id: user.id };
  next();
}

module.exports = router;
module.exports.requireAdmin = requireAdmin;
module.exports.requireLogin = requireLogin;
