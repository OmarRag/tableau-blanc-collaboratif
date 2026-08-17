// Toutes les routes HTTP « /api/... ».
//
// Les gestionnaires sont asynchrones : depuis le passage à PostgreSQL, chaque
// accès à la base est une promesse. Express 5 sait attraper tout seul une
// promesse rejetée et la transformer en erreur 500 — pas besoin d'entourer
// chaque route d'un try/catch.
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
import { config } from "./config.js";

export const api = express.Router();

api.use(express.json({ limit: "2mb" }));
api.use(attachUser);

// Plafond général sur toute l'API (par défaut : 120 requêtes par minute et
// par adresse IP).
api.use(
  rateLimit({
    capacity: config.rateLimit.apiCapacity,
    refillPerSecond: config.rateLimit.apiRefillPerSecond,
  })
);

// Beaucoup plus strict sur inscription et connexion (par défaut : 10 essais,
// puis 1 toutes les 10 s) : c'est là qu'on essaie de deviner un mot de passe.
const authLimit = rateLimit({
  capacity: config.rateLimit.authCapacity,
  refillPerSecond: config.rateLimit.authRefillPerSecond,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Comptes -------------------------------------------------------------

api.post("/auth/register", authLimit, async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!EMAIL_RE.test(String(email || "")))
    return res.status(400).json({ error: "Adresse email invalide." });
  if (String(password || "").length < 8)
    return res.status(400).json({ error: "Le mot de passe doit faire au moins 8 caractères." });
  if (await getUserByEmail(email))
    return res.status(409).json({ error: "Un compte existe déjà avec cet email." });

  const user = await createUser({ email, password, name });
  setSessionCookie(res, await createSession(user.id));
  res.json({ user: publicUser(user) });
});

api.post("/auth/login", authLimit, async (req, res) => {
  const { email, password } = req.body || {};
  const user = await getUserByEmail(email || "");
  if (!user || !verifyPassword(String(password || ""), user.password_hash))
    return res.status(401).json({ error: "Email ou mot de passe incorrect." });
  setSessionCookie(res, await createSession(user.id));
  res.json({ user: publicUser(user) });
});

api.post("/auth/logout", async (req, res) => {
  await destroySession(sessionTokenFromCookieHeader(req.headers.cookie));
  clearSessionCookie(res);
  res.json({ ok: true });
});

api.get("/auth/me", (req, res) => {
  res.json({
    user: publicUser(req.user),
    // Dit au navigateur quels moyens de connexion proposer. Si Google n'est
    // pas configuré sur ce serveur, le bouton ne s'affiche pas du tout.
    providers: { google: config.google.enabled },
  });
});

// --- Boards --------------------------------------------------------------

api.get("/boards", requireUser, async (req, res) => {
  const { owned, shared } = await listBoardsFor(req.user.id);
  res.json({ owned: owned.map(viewBoard), shared: shared.map(viewBoard) });
});

api.post("/boards", requireUser, async (req, res) => {
  const board = await createBoard({ title: req.body?.title, ownerId: req.user.id });
  res.json({ board: viewBoard({ ...board, role: "owner" }) });
});

// Accès à un board : renvoie le board, le rôle du visiteur et les formes.
api.get("/boards/:id", async (req, res) => {
  const board = await getBoard(req.params.id);
  const role = await roleFor(board, req.user, req.query.k || null);
  if (!canView(role)) return res.status(404).json({ error: "Board introuvable ou privé." });

  // Si on arrive par un lien de partage en étant connecté, on devient membre :
  // le board apparaîtra ensuite dans « Mes boards ».
  if (req.user && req.query.k && req.query.k === board.share_token && board.owner_id !== req.user.id) {
    await setMember(board.id, req.user.id, board.share_role);
  }

  res.json({
    board: viewBoard({ ...board, role }),
    role,
    shapes: await loadShapes(board.id),
  });
});

api.patch("/boards/:id", requireUser, async (req, res) => {
  const board = await getBoard(req.params.id);
  if (!canAdmin(await roleFor(board, req.user)))
    return res.status(403).json({ error: "Seul le propriétaire peut modifier ce board." });
  const updated = await updateBoard(board.id, {
    title: req.body?.title,
    isPublic: req.body?.isPublic,
    shareRole: req.body?.shareRole === "edit" ? "edit" : req.body?.shareRole === "view" ? "view" : undefined,
  });
  res.json({ board: viewBoard({ ...updated, role: "owner" }) });
});

api.delete("/boards/:id", requireUser, async (req, res) => {
  const board = await getBoard(req.params.id);
  if (!canAdmin(await roleFor(board, req.user)))
    return res.status(403).json({ error: "Seul le propriétaire peut supprimer ce board." });
  await deleteBoard(board.id);
  res.json({ ok: true });
});

// --- Partage -------------------------------------------------------------

api.get("/boards/:id/members", requireUser, async (req, res) => {
  const board = await getBoard(req.params.id);
  if (!canAdmin(await roleFor(board, req.user)))
    return res.status(403).json({ error: "Accès refusé." });
  res.json({ members: await listMembers(board.id), shareToken: board.share_token });
});

// Invitation par email : la personne doit déjà avoir un compte.
api.post("/boards/:id/members", requireUser, async (req, res) => {
  const board = await getBoard(req.params.id);
  if (!canAdmin(await roleFor(board, req.user)))
    return res.status(403).json({ error: "Accès refusé." });

  const role = req.body?.role === "edit" ? "edit" : "view";
  const invited = await getUserByEmail(req.body?.email || "");
  if (!invited)
    return res.status(404).json({ error: "Aucun compte avec cet email. La personne doit d'abord s'inscrire." });
  if (invited.id === board.owner_id)
    return res.status(400).json({ error: "Cette personne est déjà propriétaire du board." });

  await setMember(board.id, invited.id, role);
  res.json({ members: await listMembers(board.id) });
});

api.delete("/boards/:id/members/:userId", requireUser, async (req, res) => {
  const board = await getBoard(req.params.id);
  if (!canAdmin(await roleFor(board, req.user)))
    return res.status(403).json({ error: "Accès refusé." });
  await removeMember(board.id, req.params.userId);
  res.json({ members: await listMembers(board.id) });
});

// Régénère le lien de partage : les anciens liens cessent de fonctionner.
api.post("/boards/:id/share/rotate", requireUser, async (req, res) => {
  const board = await getBoard(req.params.id);
  if (!canAdmin(await roleFor(board, req.user)))
    return res.status(403).json({ error: "Accès refusé." });
  res.json({ shareToken: await rotateShareToken(board.id) });
});

// --- Export --------------------------------------------------------------

api.get("/boards/:id/export", async (req, res) => {
  const board = await getBoard(req.params.id);
  const role = await roleFor(board, req.user, req.query.k || null);
  if (!canView(role)) return res.status(404).json({ error: "Board introuvable." });
  res.json({
    version: 1,
    board: { id: board.id, title: board.title },
    shapes: await loadShapes(board.id),
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
    updatedAt: Number(board.updated_at),
  };
}
