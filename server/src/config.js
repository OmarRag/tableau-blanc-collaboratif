// Lecture de la configuration depuis les variables d'environnement.
// Node 24 sait charger un fichier .env tout seul : on le fait ici pour ne pas
// dépendre du paquet « dotenv ».
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

// Charge « server/.env » s'il existe. Format : CLE=valeur, une par ligne.
const envFile = path.join(rootDir, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

export const config = {
  rootDir,
  port: Number(process.env.PORT || 3000),
  sessionSecret: process.env.SESSION_SECRET || "dev-secret-a-changer",
  dbFile: path.resolve(rootDir, process.env.DB_FILE || "./data/whiteboard.db"),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",
  // Dossier des fichiers compilés du client, servis en production.
  clientDist: path.resolve(rootDir, "../client/dist"),
};

if (config.isProduction && config.sessionSecret.startsWith("dev-secret")) {
  console.warn(
    "[config] ATTENTION : SESSION_SECRET n'a pas été changé en production."
  );
}
