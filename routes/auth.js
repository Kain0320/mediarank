// ============================================================
//  routes/auth.js  –  Registrace, přihlášení, middleware
// ============================================================

const express = require("express");
const router  = express.Router();
const { v4: uuidv4 } = require("uuid");
const crypto  = require("crypto");
const db      = require("../helpers/db");

const ADMIN_TOKEN = "supersecret-admin-token-2024";

function sha256(str) {
  return crypto.createHash("sha256").update(String(str)).digest("hex");
}

// ── POST /api/auth/register ───────────────────────────────────
// Tělo: { username, email, password, gender }
router.post("/register", (req, res) => {
  const { username, email, password, gender } = req.body;

  const errors = [];
  if (!username || username.trim().length < 3)
    errors.push("Username musí mít aspoň 3 znaky");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push("Zadej platný e-mail");
  if (!password || password.length < 4)
    errors.push("Heslo musí mít aspoň 4 znaky");
  if (!gender || !["Male", "Female"].includes(gender))
    errors.push("Vyber pohlaví");

  if (errors.length > 0) return res.status(400).json({ errors });

  const data = db.read();

  if (data.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
    return res.status(409).json({ errors: ["Uživatelské jméno je již obsazené"] });
  }

  const emailHash = sha256(email.toLowerCase());
  if (data.users.find(u => (u.emailHash || sha256(u.email || "")) === emailHash)) {
    return res.status(409).json({ errors: ["E-mail je již registrován"] });
  }

  const newUser = {
    id:          uuidv4(),
    username:    username.trim(),
    emailHash,               // SHA-256 pro porovnávání, nikdy nereversibilní
    passwordHash: sha256(password),
    gender,
    role:        "user",
    createdAt:   new Date().toISOString()
  };

  data.users.push(newUser);
  db.write(data);

  const token = `user-token-${newUser.id}`;
  res.status(201).json({ message: "Registrace úspěšná", token, username: newUser.username, role: newUser.role });
});

// ── POST /api/auth/login ──────────────────────────────────────
// Tělo: { username, password }  (username = username nebo e-mail)
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Zadej přihlašovací jméno a heslo" });
  }

  // Pevný admin
  if (username === "admin" && password === "admin123") {
    return res.json({ token: ADMIN_TOKEN, username: "admin", role: "admin", message: "Přihlášení úspěšné" });
  }

  const data = db.read();
  const input = username.trim().toLowerCase();
  const emailHash = sha256(input);
  const passHash  = sha256(password);

  const user = data.users.find(u => {
    const usernameMatch = u.username.toLowerCase() === input;
    const emailMatch    = u.emailHash
      ? u.emailHash === emailHash
      : (u.email || "").toLowerCase() === input; // zpětná kompatibilita starých záznamů

    if (!usernameMatch && !emailMatch) return false;

    // Ověř heslo – nové hashované nebo staré plaintext (zpětná kompatibilita)
    return u.passwordHash
      ? u.passwordHash === passHash
      : u.password === password;
  });

  if (!user) {
    return res.status(401).json({ error: "Nesprávné přihlašovací údaje" });
  }

  const token = `user-token-${user.id}`;
  res.json({ token, username: user.username, role: user.role, message: "Přihlášení úspěšné" });
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get("/me", (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Nejsi přihlášen" });
  }

  const token = authHeader.split(" ")[1];
  if (token === ADMIN_TOKEN) return res.json({ username: "admin", role: "admin" });

  const data = db.read();
  const user = data.users.find(u => `user-token-${u.id}` === token);
  if (!user) return res.status(401).json({ error: "Neplatný token" });

  res.json({ username: user.username, role: user.role });
});

// ── Middleware ─────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Chybí autorizační token" });
  if (authHeader.split(" ")[1] !== ADMIN_TOKEN) return res.status(403).json({ error: "Přístup odepřen – pouze admin" });
  next();
}

function requireLogin(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Musíš být přihlášen" });

  const token = authHeader.split(" ")[1];
  if (token === ADMIN_TOKEN) {
    req.user = { username: "admin", role: "admin" };
    return next();
  }

  const data = db.read();
  const user = data.users.find(u => `user-token-${u.id}` === token);
  if (!user) return res.status(401).json({ error: "Neplatný token" });

  req.user = { username: user.username, role: user.role, id: user.id };
  next();
}

module.exports = router;
module.exports.requireAdmin = requireAdmin;
module.exports.requireLogin = requireLogin;
