// Toutes les routes HTTP « /api/... ».
import express from "express";
import {
  attachUser,
  requireUser,
  createUser,
  getUserByEmail,
  verifyPassword,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  sessionTokenFromCookieHeader,
  publicUser,
} from "./auth.js";
import {
  createBoard,
  listBoardsFor,
  updateBoard,
  deleteBoard,
  rotateShareToken,
  listMembers,
  setMember,
  removeMember,
  loadShapes,
} from "./boards.js";
import { getBoard, roleFor, canView, canAdmin } from "./permissions.js";
import { rateLimit } from "./rateLimit.js";

export const api = express.Router();

api.use(express.json({ limit: "2mb" }));
api.use(attachUser);

// 120 requêtes par minute et par IP sur toute l'API.
api.use(rateLimit({ capacity: 120, refillPerSecond: 2 }));

// Beaucoup plus strict sur la connexion et l'inscription : 10 essais d'un
// coup, puis 1 toutes les 2 secondes. Combiné au hachage scrypt (volontairement
// lent), cela rend une attaque par essais successifs inexploitable.
const authLimit = rateLimit({ capacity: 10, refillPerSecond: 0.5 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Comptes -------------------------------------------------------------

api.post("/auth/register", authLimit, (req, res) => {
  const { email, password, name } = req.body || {};
  if (!EMAIL_RE.test(String(email || "")))
    return res.status(400).json({ error: "Adresse email invalide." });
  if (String(password || "").length < 8)
    return res.status(400).json({ error: "Le mot de passe doit faire au moins 8 caractères." });
  if (getUserByEmail(email))
    return res.status(409).json({ error: "Un compte existe déjà avec cet email." });

  const user = createUser({ email, password, name });
  setSessionCookie(res, createSession(user.id));
  res.json({ user: publicUser(user) });
});

api.post("/auth/login", authLimit, (req, res) => {
  const { email, password } = req.body || {};
  const user = getUserByEmail(email || "");
  if (!user || !verifyPassword(String(password || ""), user.password_hash))
    return res.status(401).json({ error: "Email ou mot de passe incorrect." });
  setSessionCookie(res, createSession(user.id));
  res.json({ user: publicUser(user) });
});

api.post("/auth/logout", (req, res) => {
  destroySession(sessionTokenFromCookieHeader(req.headers.cookie));
  clearSessionCookie(res);
  res.json({ ok: true });
});

api.get("/auth/me", (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// --- Boards --------------------------------------------------------------

api.get("/boards", requireUser, (req, res) => {
  const { owned, shared } = listBoardsFor(req.user.id);
  res.json({ owned: owned.map(viewBoard), shared: shared.map(viewBoard) });
});

api.post("/boards", requireUser, (req, res) => {
  const board = createBoard({ title: req.body?.title, ownerId: req.user.id });
  res.json({ board: viewBoard({ ...board, role: "owner" }) });
});

// Accès à un board : renvoie le board, le rôle du visiteur et les formes.
api.get("/boards/:id", (req, res) => {
  const board = getBoard(req.params.id);
  const role = roleFor(board, req.user, req.query.k || null);
  if (!canView(role)) return res.status(404).json({ error: "Board introuvable ou privé." });

  // Si on arrive par un lien de partage en étant connecté, on devient membre :
  // le board apparaîtra ensuite dans « Mes boards ».
  if (req.user && req.query.k && req.query.k === board.share_token && board.owner_id !== req.user.id) {
    setMember(board.id, req.user.id, board.share_role);
  }

  res.json({
    board: viewBoard({ ...board, role }),
    role,
    shapes: loadShapes(board.id),
  });
});

api.patch("/boards/:id", requireUser, (req, res) => {
  const board = getBoard(req.params.id);
  if (!canAdmin(roleFor(board, req.user)))
    return res.status(403).json({ error: "Seul le propriétaire peut modifier ce board." });
  const updated = updateBoard(board.id, {
    title: req.body?.title,
    isPublic: req.body?.isPublic,
    shareRole: req.body?.shareRole === "edit" ? "edit" : req.body?.shareRole === "view" ? "view" : undefined,
  });
  res.json({ board: viewBoard({ ...updated, role: "owner" }) });
});

api.delete("/boards/:id", requireUser, (req, res) => {
  const board = getBoard(req.params.id);
  if (!canAdmin(roleFor(board, req.user)))
    return res.status(403).json({ error: "Seul le propriétaire peut supprimer ce board." });
  deleteBoard(board.id);
  res.json({ ok: true });
});

// --- Partage -------------------------------------------------------------

api.get("/boards/:id/members", requireUser, (req, res) => {
  const board = getBoard(req.params.id);
  if (!canAdmin(roleFor(board, req.user)))
    return res.status(403).json({ error: "Accès refusé." });
  res.json({ members: listMembers(board.id), shareToken: board.share_token });
});

// Invitation par email : la personne doit déjà avoir un compte.
api.post("/boards/:id/members", requireUser, (req, res) => {
  const board = getBoard(req.params.id);
  if (!canAdmin(roleFor(board, req.user)))
    return res.status(403).json({ error: "Accès refusé." });

  const role = req.body?.role === "edit" ? "edit" : "view";
  const invited = getUserByEmail(req.body?.email || "");
  if (!invited)
    return res.status(404).json({ error: "Aucun compte avec cet email. La personne doit d'abord s'inscrire." });
  if (invited.id === board.owner_id)
    return res.status(400).json({ error: "Cette personne est déjà propriétaire du board." });

  setMember(board.id, invited.id, role);
  res.json({ members: listMembers(board.id) });
});

api.delete("/boards/:id/members/:userId", requireUser, (req, res) => {
  const board = getBoard(req.params.id);
  if (!canAdmin(roleFor(board, req.user)))
    return res.status(403).json({ error: "Accès refusé." });
  removeMember(board.id, req.params.userId);
  res.json({ members: listMembers(board.id) });
});

// Régénère le lien de partage : les anciens liens cessent de fonctionner.
api.post("/boards/:id/share/rotate", requireUser, (req, res) => {
  const board = getBoard(req.params.id);
  if (!canAdmin(roleFor(board, req.user)))
    return res.status(403).json({ error: "Accès refusé." });
  res.json({ shareToken: rotateShareToken(board.id) });
});

// --- Export --------------------------------------------------------------

api.get("/boards/:id/export", (req, res) => {
  const board = getBoard(req.params.id);
  const role = roleFor(board, req.user, req.query.k || null);
  if (!canView(role)) return res.status(404).json({ error: "Board introuvable." });
  res.json({
    version: 1,
    board: { id: board.id, title: board.title },
    shapes: loadShapes(board.id),
  });
});

// Le jeton de partage n'est JAMAIS renvoyé à quelqu'un qui n'est pas
// propriétaire : sinon un simple lecteur récupérerait le lien d'écriture.
function viewBoard(board) {
  return {
    id: board.id,
    title: board.title,
    isPublic: !!board.is_public,
    shareRole: board.share_role,
    shareToken: board.role === "owner" ? board.share_token : undefined,
    ownerId: board.owner_id,
    role: board.role,
    updatedAt: board.updated_at,
  };
}
