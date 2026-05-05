// ============================================================
//  server.js  –  Vstupní bod celé aplikace
// ============================================================

require("dotenv").config();

const express = require("express");
const path    = require("path");

const mediaRouter     = require("./routes/media");
const reviewRouter    = require("./routes/reviews");
const authRouter      = require("./routes/auth");
const searchRouter    = require("./routes/search");
const statsRouter     = require("./routes/stats");
const watchlistRouter = require("./routes/watchlist");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/media",     mediaRouter);
app.use("/api/reviews",   reviewRouter);
app.use("/api/auth",      authRouter);
app.use("/api/search",    searchRouter);
app.use("/api/stats",     statsRouter);
app.use("/api/watchlist", watchlistRouter);

// Detail stránka media
app.get("/media/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "media.html"));
});

// Profilová stránka
app.get("/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "profile.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅  Server běží na http://localhost:${PORT}`);
  console.log(`📁  Data se ukládají do: ./data/data.json`);
});
