// Base de données SQLite.
//
// On utilise « node:sqlite », intégré à Node.js 24 : aucune dépendance à
// installer, aucun outil de compilation C++ à avoir sur la machine.
// SQLite range toute la base dans un seul fichier.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new DatabaseSync(config.dbFile);

// WAL = « write-ahead logging » : permet de lire pendant qu'on écrit.
// Indispensable ici car plusieurs personnes écrivent sur le même board.
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL,
    color         TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS boards (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_public   INTEGER NOT NULL DEFAULT 0,
    share_token TEXT NOT NULL UNIQUE,
    share_role  TEXT NOT NULL DEFAULT 'view',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS board_members (
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role     TEXT NOT NULL,
    PRIMARY KEY (board_id, user_id)
  );

  -- Une ligne par forme dessinée. « clock » sert à départager deux
  -- modifications concurrentes de la même forme (voir merge.js).
  CREATE TABLE IF NOT EXISTS shapes (
    board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    id         TEXT NOT NULL,
    data       TEXT NOT NULL,
    clock      INTEGER NOT NULL,
    actor      TEXT NOT NULL,
    deleted    INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (board_id, id)
  );

  CREATE INDEX IF NOT EXISTS idx_shapes_board ON shapes(board_id);
  CREATE INDEX IF NOT EXISTS idx_members_user ON board_members(user_id);
`);

export function now() {
  return Date.now();
}
