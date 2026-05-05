// ============================================================
//  scripts/migrate-passwords.js
//  Jednorázová migrace plaintext hesel → bcrypt hashe.
//  Spusť jednou po přidání bcryptjs:  node scripts/migrate-passwords.js
// ============================================================

require("dotenv").config();
const bcrypt = require("bcryptjs");
const db     = require("../helpers/db");

const SALT_ROUNDS = 12;

const C = {
  reset: "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m",
  cyan: "\x1b[36m", gray: "\x1b[90m",  bold: "\x1b[1m", red: "\x1b[31m",
};

async function main() {
  console.log(`\n${C.bold}${C.cyan}🔐  Migrace hesel → bcrypt${C.reset}`);
  console.log("═".repeat(40));

  const data = db.read();
  let migrated = 0;
  let skipped  = 0;

  for (const user of data.users) {
    // Bcrypt hashe začínají $2b$ nebo $2a$ – přeskočíme
    if (user.password && user.password.startsWith("$2")) {
      console.log(`  ${C.gray}– ${user.username}: already hashed${C.reset}`);
      skipped++;
      continue;
    }

    const plain = user.password;
    user.password = await bcrypt.hash(plain, SALT_ROUNDS);
    console.log(`  ${C.green}✓${C.reset} ${user.username}: hashed`);
    migrated++;
  }

  db.write(data);

  console.log("\n" + "═".repeat(40));
  console.log(`${C.bold}Hotovo!${C.reset}`);
  console.log(`  Migrováno: ${C.green}${migrated}${C.reset}`);
  console.log(`  Přeskočeno (již hash): ${C.gray}${skipped}${C.reset}\n`);
}

main().catch(e => {
  console.error(`${C.red}Chyba: ${e.message}${C.reset}`);
  process.exit(1);
});
