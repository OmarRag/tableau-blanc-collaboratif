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

/**
 * Découpe une variable d'environnement contenant plusieurs adresses séparées
 * par des virgules. Exemple :
 *   TURN_URLS=turn:exemple.com:3478,turns:exemple.com:5349
 */
function liste(valeur) {
  return String(valeur || "")
    .split(",")
    .map((element) => element.trim())
    .filter(Boolean);
}

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

  // Connexion avec Google (facultative). Si l'une des deux valeurs manque, la
  // fonctionnalité est simplement désactivée : le bouton disparaît de la page
  // et l'email/mot de passe continue de fonctionner normalement.
  google: {
    clientId: (process.env.GOOGLE_CLIENT_ID || "").trim(),
    clientSecret: (process.env.GOOGLE_CLIENT_SECRET || "").trim(),
    get enabled() {
      return this.clientId.length > 0 && this.clientSecret.length > 0;
    },
  },

  // --- Serveurs de mise en relation du chat vocal (« ICE ») --------------
  //
  // STUN : serveur qui répond seulement « voici l'adresse sous laquelle je te
  //        vois depuis Internet ». Gratuit, aucune donnée ne transite.
  //        Suffit dans la grande majorité des cas.
  //
  // TURN : serveur qui RELAIE le son quand les deux personnes n'arrivent pas
  //        à se joindre directement (réseaux d'entreprise, certaines 4G,
  //        pare-feu stricts). C'est le filet de sécurité. Il consomme de la
  //        bande passante, donc il est presque toujours payant — d'où sa
  //        configuration par variables d'environnement, et non en dur.
  //
  // Si TURN_URLS est absente, on garde le comportement d'avant : STUN seul.
  ice: {
    stunUrls: liste(process.env.STUN_URLS).length
      ? liste(process.env.STUN_URLS)
      : ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
    turnUrls: liste(process.env.TURN_URLS),
    turnUsername: (process.env.TURN_USERNAME || "").trim(),
    turnCredential: (process.env.TURN_CREDENTIAL || "").trim(),
    get turnEnabled() {
      return this.turnUrls.length > 0;
    },
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

/**
 * La liste des serveurs à donner à WebRTC, dans le format qu'il attend.
 *
 * L'ordre compte : le navigateur essaie d'abord la connexion directe (STUN),
 * et ne se rabat sur le relais (TURN) que s'il n'y arrive pas. On ne perd
 * donc rien en qualité, TURN n'est qu'un filet de sécurité.
 */
export function iceServers() {
  const serveurs = [{ urls: config.ice.stunUrls }];
  if (config.ice.turnEnabled) {
    serveurs.push({
      urls: config.ice.turnUrls,
      username: config.ice.turnUsername,
      credential: config.ice.turnCredential,
    });
  }
  return serveurs;
}
