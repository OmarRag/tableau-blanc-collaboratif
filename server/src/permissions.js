// Qui a le droit de faire quoi sur un board ?
//
// Trois niveaux, du plus fort au plus faible :
//   "owner" → propriétaire : lire, écrire, partager, supprimer
//   "edit"  → lire et dessiner
//   "view"  → lire seulement
//   null    → aucun accès
import { get } from "./db.js";

export const RANK = { view: 1, edit: 2, owner: 3 };

export async function getBoard(boardId) {
  // On force une chaîne : un identifiant absent ferait planter la requête.
  return get("SELECT * FROM boards WHERE id = ?", [String(boardId ?? "")]);
}

/**
 * Calcule le rôle d'une personne sur un board.
 * On garde le rôle LE PLUS FORT parmi toutes les raisons d'avoir accès.
 *
 * @param {object|null} board  la ligne du board
 * @param {object|null} user   l'utilisateur connecté (ou null si visiteur)
 * @param {string|null} shareToken  jeton du lien de partage (paramètre ?k=)
 * @returns {Promise<"owner"|"edit"|"view"|null>}
 */
export async function roleFor(board, user, shareToken = null) {
  if (!board) return null;
  let best = null;
  const keep = (role) => {
    if (role && (!best || RANK[role] > RANK[best])) best = role;
  };

  if (user && board.owner_id === user.id) keep("owner");

  if (user) {
    const member = await get(
      "SELECT role FROM board_members WHERE board_id = ? AND user_id = ?",
      [board.id, user.id]
    );
    if (member) keep(member.role);
  }

  // Lien de partage : quiconque possède le jeton obtient le rôle du lien.
  if (shareToken && shareToken === board.share_token) keep(board.share_role);

  // Board public : tout le monde peut regarder, même sans compte.
  if (board.is_public) keep("view");

  return best;
}

export function canView(role) {
  return role !== null && role !== undefined;
}

export function canEdit(role) {
  return role === "edit" || role === "owner";
}

export function canAdmin(role) {
  return role === "owner";
}
