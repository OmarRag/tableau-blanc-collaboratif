// Lecture de la configuration depuis les variables d'environnement.
//
// Règle du sujet : aucun secret n'est écrit dans le code. Tout vient de
// l'environnement — un fichier « .env » en local, les « Environment
// Variables » du tableau de bord Render une fois en ligne.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

// Charge « server/.env » s'il existe. Format : CLE=valeur, une par ligne.
// En production ce fichier n'existe pas : les valeurs viennent de l'hébergeur.
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

const databaseUrl = (process.env.DATABASE_URL || "").trim();

export const config = {
  rootDir,
  // Render impose le port par la variable PORT : on doit l'écouter, sinon
  // l'hébergeur considère que l'application n'a jamais démarré.
  port: Number(process.env.PORT || 3000),
  sessionSecret: process.env.SESSION_SECRET || "dev-secret-a-changer",

  // Choix de la base : PostgreSQL si DATABASE_URL est fournie, SQLite sinon.
  // C'est le seul interrupteur : rien d'autre à changer pour passer en ligne.
  databaseUrl,
  usePostgres: databaseUrl.length > 0,
  dbFile: path.resolve(rootDir, process.env.DB_FILE || "./data/whiteboard.db"),

  // Limitation de débit. Les valeurs par défaut sont celles de la production
  // (strictes). On peut les assouplir en local par variables d'environnement,
  // sans jamais toucher au code — les tests automatiques enchaînent beaucoup
  // de créations de comptes depuis la même adresse IP et se bloqueraient
  // eux-mêmes avec les réglages de production.
  rateLimit: {
    apiCapacity: Number(process.env.RATE_LIMIT_API_CAPACITY || 120),
    apiRefillPerSecond: Number(process.env.RATE_LIMIT_API_REFILL || 2),
    authCapacity: Number(process.env.RATE_LIMIT_AUTH_CAPACITY || 10),
    authRefillPerSecond: Number(process.env.RATE_LIMIT_AUTH_REFILL || 0.1),
  },

  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",
  // Dossier des fichiers compilés du client, servis en production.
  clientDist: path.resolve(rootDir, "../client/dist"),
};

// En production, un secret de session laissé par défaut permettrait à
// n'importe qui de fabriquer un cookie de connexion valide. On refuse de
// démarrer plutôt que de mettre les comptes en danger.
if (config.isProduction && config.sessionSecret.startsWith("dev-secret")) {
  throw new Error(
    "SESSION_SECRET doit être défini en production.\n" +
      "Sur Render : Environment → Add Environment Variable → SESSION_SECRET.\n" +
      "Valeur : une longue chaîne aléatoire, par exemple le résultat de\n" +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}
