// Accès aux boards et aux formes en base.
import { db, now } from "./db.js";
import { shortId, longToken } from "./ids.js";
import { shouldApply } from "../../shared/merge.js";

export function createBoard({ title, ownerId }) {
  const id = shortId(10);
  const timestamp = now();
  db.prepare(
    `INSERT INTO boards
       (id, title, owner_id, is_public, share_token, share_role, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, 'view', ?, ?)`
  ).run(id, title || "Board sans titre", ownerId, longToken(), timestamp, timestamp);
  return db.prepare("SELECT * FROM boards WHERE id = ?").get(id);
}

export function listBoardsFor(userId) {
  const owned = db
    .prepare(
      `SELECT b.*, 'owner' AS role FROM boards b
       WHERE b.owner_id = ? ORDER BY b.updated_at DESC`
    )
    .all(userId);
  const shared = db
    .prepare(
      `SELECT b.*, m.role AS role FROM boards b
       JOIN board_members m ON m.board_id = b.id
       WHERE m.user_id = ? AND b.owner_id <> ?
       ORDER BY b.updated_at DESC`
    )
    .all(userId, userId);
  return { owned, shared };
}

export function touchBoard(boardId) {
  db.prepare("UPDATE boards SET updated_at = ? WHERE id = ?").run(now(), boardId);
}

export function deleteBoard(boardId) {
  db.prepare("DELETE FROM boards WHERE id = ?").run(boardId);
}

export function updateBoard(boardId, { title, isPublic, shareRole }) {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId);
  if (!board) return null;
  db.prepare(
    `UPDATE boards SET title = ?, is_public = ?, share_role = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    title ?? board.title,
    isPublic === undefined ? board.is_public : isPublic ? 1 : 0,
    shareRole ?? board.share_role,
    now(),
    boardId
  );
  return db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId);
}

export function rotateShareToken(boardId) {
  const token = longToken();
  db.prepare("UPDATE boards SET share_token = ? WHERE id = ?").run(token, boardId);
  return token;
}

// --- Membres -------------------------------------------------------------

export function listMembers(boardId) {
  return db
    .prepare(
      `SELECT u.id, u.email, u.name, u.color, m.role
       FROM board_members m JOIN users u ON u.id = m.user_id
       WHERE m.board_id = ?`
    )
    .all(boardId);
}

export function setMember(boardId, userId, role) {
  db.prepare(
    `INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)
     ON CONFLICT(board_id, user_id) DO UPDATE SET role = excluded.role`
  ).run(boardId, userId, role);
}

export function removeMember(boardId, userId) {
  db.prepare("DELETE FROM board_members WHERE board_id = ? AND user_id = ?").run(
    boardId,
    userId
  );
}

// --- Formes --------------------------------------------------------------

/** Toutes les formes vivantes d'un board, prêtes à être envoyées au client. */
export function loadShapes(boardId) {
  const rows = db
    .prepare("SELECT * FROM shapes WHERE board_id = ? AND deleted = 0")
    .all(boardId);
  return rows.map((row) => ({
    ...JSON.parse(row.data),
    id: row.id,
    clock: row.clock,
    actor: row.actor,
  }));
}

/** L'horloge de Lamport la plus élevée déjà vue sur ce board. */
export function maxClock(boardId) {
  const row = db
    .prepare("SELECT MAX(clock) AS c FROM shapes WHERE board_id = ?")
    .get(boardId);
  return row?.c || 0;
}

function currentOp(boardId, shapeId) {
  return db
    .prepare("SELECT clock, actor FROM shapes WHERE board_id = ? AND id = ?")
    .get(boardId, shapeId);
}

/**
 * Applique une opération reçue si elle gagne face à celle déjà en base.
 * @returns {boolean} true si l'opération a été appliquée (donc à rediffuser).
 */
export function applyShapeOp(boardId, op) {
  const existing = currentOp(boardId, op.id);
  if (!shouldApply(op, existing)) return false;

  const isDelete = op.type === "delete";
  db.prepare(
    `INSERT INTO shapes (board_id, id, data, clock, actor, deleted, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(board_id, id) DO UPDATE SET
       data = excluded.data, clock = excluded.clock, actor = excluded.actor,
       deleted = excluded.deleted, updated_at = excluded.updated_at`
  ).run(
    boardId,
    op.id,
    JSON.stringify(isDelete ? {} : op.shape),
    op.clock,
    op.actor,
    isDelete ? 1 : 0,
    now()
  );
  return true;
}
