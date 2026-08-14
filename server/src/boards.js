// Accès aux boards et aux formes en base.
import { all, get, run, now } from "./db.js";
import { shortId, longToken } from "./ids.js";

export async function createBoard({ title, ownerId }) {
  const id = shortId(10);
  const timestamp = now();
  await run(
    `INSERT INTO boards
       (id, title, owner_id, is_public, share_token, share_role, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, 'view', ?, ?)`,
    [id, title || "Board sans titre", ownerId, longToken(), timestamp, timestamp]
  );
  return get("SELECT * FROM boards WHERE id = ?", [id]);
}

export async function listBoardsFor(userId) {
  const owned = await all(
    `SELECT b.*, 'owner' AS role FROM boards b
     WHERE b.owner_id = ? ORDER BY b.updated_at DESC`,
    [userId]
  );
  const shared = await all(
    `SELECT b.*, m.role AS role FROM boards b
     JOIN board_members m ON m.board_id = b.id
     WHERE m.user_id = ? AND b.owner_id <> ?
     ORDER BY b.updated_at DESC`,
    [userId, userId]
  );
  return { owned, shared };
}

export async function touchBoard(boardId) {
  await run("UPDATE boards SET updated_at = ? WHERE id = ?", [now(), boardId]);
}

export async function deleteBoard(boardId) {
  await run("DELETE FROM boards WHERE id = ?", [boardId]);
}

export async function updateBoard(boardId, { title, isPublic, shareRole }) {
  const board = await get("SELECT * FROM boards WHERE id = ?", [boardId]);
  if (!board) return null;
  await run(
    `UPDATE boards SET title = ?, is_public = ?, share_role = ?, updated_at = ?
     WHERE id = ?`,
    [
      title ?? board.title,
      isPublic === undefined ? board.is_public : isPublic ? 1 : 0,
      shareRole ?? board.share_role,
      now(),
      boardId,
    ]
  );
  return get("SELECT * FROM boards WHERE id = ?", [boardId]);
}

export async function rotateShareToken(boardId) {
  const token = longToken();
  await run("UPDATE boards SET share_token = ? WHERE id = ?", [token, boardId]);
  return token;
}

// --- Membres -------------------------------------------------------------

export async function listMembers(boardId) {
  return all(
    `SELECT u.id, u.email, u.name, u.color, m.role
     FROM board_members m JOIN users u ON u.id = m.user_id
     WHERE m.board_id = ?`,
    [boardId]
  );
}

export async function setMember(boardId, userId, role) {
  await run(
    `INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)
     ON CONFLICT (board_id, user_id) DO UPDATE SET role = excluded.role`,
    [boardId, userId, role]
  );
}

export async function removeMember(boardId, userId) {
  await run("DELETE FROM board_members WHERE board_id = ? AND user_id = ?", [
    boardId,
    userId,
  ]);
}

// --- Formes --------------------------------------------------------------

/** Toutes les formes vivantes d'un board, prêtes à être envoyées au client. */
export async function loadShapes(boardId) {
  const rows = await all("SELECT * FROM shapes WHERE board_id = ? AND deleted = 0", [
    boardId,
  ]);
  return rows.map((row) => ({
    ...JSON.parse(row.data),
    id: row.id,
    clock: Number(row.clock),
    actor: row.actor,
  }));
}

/** L'horloge de Lamport la plus élevée déjà vue sur ce board. */
export async function maxClock(boardId) {
  const row = await get(
    "SELECT COALESCE(MAX(clock), 0) AS c FROM shapes WHERE board_id = ?",
    [boardId]
  );
  return Number(row?.c || 0);
}

/**
 * Applique une opération reçue si elle gagne face à celle déjà en base.
 *
 * La comparaison est faite DANS la requête SQL, et non en JavaScript. Raison :
 * avec PostgreSQL les requêtes sont asynchrones, donc deux opérations sur la
 * même forme peuvent s'entrelacer. Un « je lis, je compare, j'écris » en trois
 * temps laisserait passer la mauvaise version. Ici, lecture, comparaison et
 * écriture forment une seule instruction atomique.
 *
 * La condition ci-dessous est exactement la règle de `shared/merge.js`
 * (horloge la plus grande, puis auteur le plus grand pour départager). Le test
 * « la règle SQL et la règle JavaScript disent la même chose » vérifie que les
 * deux ne divergent jamais.
 *
 * @returns {Promise<boolean>} true si l'opération a été appliquée.
 */
export async function applyShapeOp(boardId, op) {
  const isDelete = op.type === "delete";
  const rows = await run(
    `INSERT INTO shapes (board_id, id, data, clock, actor, deleted, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (board_id, id) DO UPDATE SET
       data = excluded.data, clock = excluded.clock, actor = excluded.actor,
       deleted = excluded.deleted, updated_at = excluded.updated_at
     WHERE excluded.clock > shapes.clock
        OR (excluded.clock = shapes.clock AND excluded.actor > shapes.actor)
     RETURNING id`,
    [
      boardId,
      op.id,
      JSON.stringify(isDelete ? {} : op.shape),
      op.clock,
      op.actor,
      isDelete ? 1 : 0,
      now(),
    ]
  );
  // Aucune ligne renvoyée = la condition a rejeté l'opération : elle a perdu.
  return rows.length > 0;
}
