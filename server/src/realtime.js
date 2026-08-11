// Temps réel : Socket.IO.
//
// Socket.IO maintient une connexion ouverte en permanence entre le navigateur
// et le serveur (WebSocket). Chaque board est une « room » : un message envoyé
// dans une room n'est reçu que par les personnes présentes sur ce board.
import { Server } from "socket.io";
import { userFromCookieHeader } from "./auth.js";
import { getBoard, roleFor, canView, canEdit } from "./permissions.js";
import { loadShapes, maxClock, applyShapeOp, touchBoard, setMember } from "./boards.js";
import { colorFor, shortId } from "./ids.js";
import { config } from "./config.js";

// Anti-spam : nombre maximum d'opérations de dessin par seconde et par socket.
const MAX_OPS_PER_SECOND = 120;
// Les curseurs bougent beaucoup : on les limite séparément et on ne les
// enregistre jamais en base.
const MAX_CURSORS_PER_SECOND = 40;

export function setupRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigin, credentials: true },
    // Si la connexion tombe, Socket.IO retente tout seul côté client.
    pingTimeout: 20000,
  });

  io.use((socket, next) => {
    const { boardId, shareToken } = socket.handshake.auth || {};
    const board = getBoard(boardId);
    const user = userFromCookieHeader(socket.handshake.headers.cookie);
    const role = roleFor(board, user, shareToken || null);

    if (!canView(role)) return next(new Error("Accès refusé à ce board."));

    // Quelqu'un qui arrive par un lien de partage devient membre du board.
    if (user && shareToken && board.share_token === shareToken && board.owner_id !== user.id) {
      setMember(board.id, user.id, board.share_role);
    }

    socket.data.boardId = board.id;
    socket.data.role = role;
    socket.data.user = user;
    // Un visiteur non connecté reçoit quand même une identité éphémère,
    // pour que son curseur soit visible et distinguable des autres.
    socket.data.identity = user
      ? { id: user.id, name: user.name, color: user.color, guest: false }
      : { id: `guest-${shortId(6)}`, name: `Invité ${shortId(3)}`, color: colorFor(socket.id), guest: true };
    socket.data.opBudget = { ops: MAX_OPS_PER_SECOND, cursors: MAX_CURSORS_PER_SECOND, last: Date.now() };
    next();
  });

  io.on("connection", (socket) => {
    const boardId = socket.data.boardId;
    socket.join(boardId);

    // 1) On envoie au nouvel arrivant l'état complet du board.
    socket.emit("init", {
      shapes: loadShapes(boardId),
      clock: maxClock(boardId),
      me: { ...socket.data.identity, role: socket.data.role, socketId: socket.id },
      peers: peersOf(io, boardId, socket.id),
    });

    // 2) On prévient les autres qu'il est arrivé.
    socket.to(boardId).emit("presence:join", {
      socketId: socket.id,
      ...socket.data.identity,
    });

    socket.on("shape:op", (op, ack) => {
      if (!canEdit(socket.data.role)) return ack?.({ ok: false, error: "lecture seule" });
      if (!allow(socket, "ops")) return ack?.({ ok: false, error: "trop d'opérations" });
      if (!isValidOp(op)) return ack?.({ ok: false, error: "opération invalide" });

      // L'auteur est imposé par le serveur : on ne fait pas confiance au
      // client pour dire qui il est.
      const clean = {
        id: String(op.id),
        type: op.type === "delete" ? "delete" : "upsert",
        clock: Math.floor(op.clock),
        actor: socket.data.identity.id,
        shape: op.type === "delete" ? null : op.shape,
      };

      const applied = applyShapeOp(boardId, clean);
      // On accuse toujours réception (même si l'opération a perdu) pour que le
      // client puisse vider sa file d'attente.
      ack?.({ ok: true, applied });
      if (applied) {
        touchBoard(boardId);
        socket.to(boardId).emit("shape:op", clean);
      } else {
        // L'opération a perdu : on renvoie à l'expéditeur la version qui gagne
        // pour qu'il se resynchronise immédiatement.
        const winners = loadShapes(boardId).filter((s) => s.id === clean.id);
        socket.emit("shape:resync", { id: clean.id, shape: winners[0] || null });
      }
    });

    socket.on("cursor", (position) => {
      if (!allow(socket, "cursors")) return;
      if (!position || typeof position.x !== "number" || typeof position.y !== "number") return;
      socket.to(boardId).emit("presence:cursor", {
        socketId: socket.id,
        x: position.x,
        y: position.y,
      });
    });

    socket.on("disconnect", () => {
      socket.to(boardId).emit("presence:leave", { socketId: socket.id });
    });
  });

  return io;
}

function peersOf(io, boardId, exceptSocketId) {
  const room = io.sockets.adapter.rooms.get(boardId);
  if (!room) return [];
  const out = [];
  for (const socketId of room) {
    if (socketId === exceptSocketId) continue;
    const other = io.sockets.sockets.get(socketId);
    if (other) out.push({ socketId, ...other.data.identity });
  }
  return out;
}

/** Seau à jetons simplifié, appliqué à chaque socket. */
function allow(socket, kind) {
  const budget = socket.data.opBudget;
  const elapsed = (Date.now() - budget.last) / 1000;
  budget.last = Date.now();
  budget.ops = Math.min(MAX_OPS_PER_SECOND, budget.ops + elapsed * MAX_OPS_PER_SECOND);
  budget.cursors = Math.min(MAX_CURSORS_PER_SECOND, budget.cursors + elapsed * MAX_CURSORS_PER_SECOND);
  if (budget[kind] < 1) return false;
  budget[kind] -= 1;
  return true;
}

const SHAPE_KINDS = new Set(["rect", "ellipse", "arrow", "pen", "text"]);

/** Contrôle basique : on n'enregistre jamais n'importe quoi en base. */
export function isValidOp(op) {
  if (!op || typeof op !== "object") return false;
  if (typeof op.id !== "string" || op.id.length === 0 || op.id.length > 64) return false;
  if (!Number.isFinite(op.clock) || op.clock < 0) return false;
  if (op.type === "delete") return true;
  const shape = op.shape;
  if (!shape || typeof shape !== "object") return false;
  if (!SHAPE_KINDS.has(shape.kind)) return false;
  // Garde-fou sur la taille : un tracé à main levée très long resterait
  // acceptable, mais on refuse l'absurde.
  if (Array.isArray(shape.points) && shape.points.length > 20000) return false;
  return JSON.stringify(shape).length <= 200_000;
}
