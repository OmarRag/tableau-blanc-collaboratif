// Base de données — deux moteurs possibles, une seule interface.
//
//   • En local  : SQLite via « node:sqlite », intégré à Node.js 24. Zéro
//                 dépendance, zéro compilation, un seul fichier sur le disque.
//   • En ligne  : PostgreSQL, dès que la variable DATABASE_URL est fournie.
//                 Render efface le disque à chaque redéploiement : un fichier
//                 SQLite y serait perdu. PostgreSQL est hébergé à part, donc
//                 les données survivent.
//
// Tout le reste du serveur passe par les trois fonctions `all`, `get` et
// `run` : il ne sait pas quel moteur tourne dessous, et n'a pas à le savoir.
//
// Les requêtes s'écrivent TOUJOURS avec des « ? » comme emplacements de
// paramètres (style SQLite). Pour PostgreSQL, qui attend « $1, $2… », la
// traduction est faite ici, à un seul endroit.
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export const dialect = config.usePostgres ? "postgres" : "sqlite";

let sqliteDb = null;
let pgPool = null;

/** Traduit « ... ? ... ? ... » en « ... $1 ... $2 ... » pour PostgreSQL. */
function toPostgresPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/** Exécute une requête et renvoie toujours un tableau de lignes. */
export async function query(sql, params = []) {
  if (dialect === "postgres") {
    const result = await pgPool.query(toPostgresPlaceholders(sql), params);
    return result.rows;
  }
  return sqliteDb.prepare(sql).all(...params);
}

export async function all(sql, params = []) {
  return query(sql, params);
}

export async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0];
}

export async function run(sql, params = []) {
  return query(sql, params);
}

export function now() {
  return Date.now();
}

// --- Création des tables --------------------------------------------------
//
// Une seule différence entre les deux moteurs : le type des dates. On stocke
// un nombre de millisecondes (Date.now()), qui dépasse la capacité d'un
// INTEGER PostgreSQL (limité à ~2,1 milliards). Il faut donc BIGINT là-bas.
function schemaSql() {
  const DATE = dialect === "postgres" ? "BIGINT" : "INTEGER";
  return `
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL,
      color         TEXT NOT NULL,
      created_at    ${DATE} NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at ${DATE} NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boards (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_public   INTEGER NOT NULL DEFAULT 0,
      share_token TEXT NOT NULL UNIQUE,
      share_role  TEXT NOT NULL DEFAULT 'view',
      created_at  ${DATE} NOT NULL,
      updated_at  ${DATE} NOT NULL
    );

    CREATE TABLE IF NOT EXISTS board_members (
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role     TEXT NOT NULL,
      PRIMARY KEY (board_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS shapes (
      board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      id         TEXT NOT NULL,
      data       TEXT NOT NULL,
      clock      INTEGER NOT NULL,
      actor      TEXT NOT NULL,
      deleted    INTEGER NOT NULL DEFAULT 0,
      updated_at ${DATE} NOT NULL,
      PRIMARY KEY (board_id, id)
    );

    CREATE INDEX IF NOT EXISTS idx_shapes_board ON shapes(board_id);
    CREATE INDEX IF NOT EXISTS idx_members_user ON board_members(user_id);
  `;
}

let initialised = null;

/** À appeler une fois au démarrage, avant d'accepter la moindre requête. */
export function initDb() {
  if (initialised) return initialised;
  initialised = dialect === "postgres" ? initPostgres() : initSqlite();
  return initialised;
}

async function initSqlite() {
  const { DatabaseSync } = await import("node:sqlite");
  fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
  sqliteDb = new DatabaseSync(config.dbFile);
  // WAL = « write-ahead logging » : permet de lire pendant qu'on écrit.
  sqliteDb.exec("PRAGMA journal_mode = WAL");
  sqliteDb.exec("PRAGMA foreign_keys = ON");
  sqliteDb.exec(schemaSql());
  return { dialect };
}

async function initPostgres() {
  const pg = (await import("pg")).default;

  // Sans cette ligne, le pilote renvoie les BIGINT sous forme de TEXTE (pour
  // ne pas perdre de précision sur de très grands nombres). Nos dates en
  // millisecondes tiennent largement dans un nombre JavaScript : on les
  // reconvertit, sinon les tris et les affichages de date seraient faux.
  pg.types.setTypeParser(20, (value) => Number(value));

  pgPool = new pg.Pool({
    connectionString: config.databaseUrl,
    // Supabase et Neon n'acceptent que des connexions chiffrées. Leur
    // certificat n'est pas dans la liste de confiance de Node : on chiffre
    // sans exiger la vérification du certificat, ce qui est la configuration
    // documentée par ces deux hébergeurs.
    ssl: config.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    // Les offres gratuites limitent fortement le nombre de connexions.
    max: 5,
    idleTimeoutMillis: 30_000,
  });

  await pgPool.query(schemaSql());
  return { dialect };
}

/** Ferme proprement la base (utilisé par les tests et à l'arrêt du serveur). */
export async function closeDb() {
  if (pgPool) await pgPool.end();
  if (sqliteDb) sqliteDb.close();
  pgPool = null;
  sqliteDb = null;
  initialised = null;
}
