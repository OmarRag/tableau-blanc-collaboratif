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
// Chat vocal : messages de « signalisation » (mise en relation des
// navigateurs). Il en faut une trentaine pour établir un appel, puis presque
// plus rien. Ce plafond laisse largement de quoi appeler plusieurs personnes.
const MAX_SIGNALS_PER_SECOND = 30;

export function setupRealtime(httpServer) {
  const io = new Server(httpServer, {
    // En production, la page et la connexion temps réel partent du même
    // domaine : aucune autorisation d'origine croisée n'est nécessaire, et en
    // demander une ouvrirait inutilement le serveur. En développement
    // seulement, la page vient de Vite (port 5173).
    cors: config.isProduction
      ? false
      : { origin: config.clientOrigin, credentials: true },
    // Si la connexion tombe, Socket.IO retente tout seul côté client.
    pingTimeout: 20000,
  });

  io.use(async (socket, next) => {
    try {
      await authenticate(socket);
      next();
    } catch (error) {
      next(error);
    }
  });

  async function authenticate(socket) {
    const { boardId, shareToken } = socket.handshake.auth || {};
    const board = await getBoard(boardId);
    const user = await userFromCookieHeader(socket.handshake.headers.cookie);
    const role = await roleFor(board, user, shareToken || null);

    if (!canView(role)) throw new Error("Accès refusé à ce board.");

    // Quelqu'un qui arrive par un lien de partage devient membre du board.
    if (user && shareToken && board.share_token === shareToken && board.owner_id !== user.id) {
      await setMember(board.id, user.id, board.share_role);
    }

    socket.data.boardId = board.id;
    socket.data.role = role;
    socket.data.user = user;
    // Un visiteur non connecté reçoit quand même une identité éphémère,
    // pour que son curseur soit visible et distinguable des autres.
    socket.data.identity = user
      ? { id: user.id, name: user.name, color: user.color, guest: false }
      : { id: `guest-${shortId(6)}`, name: `Invité ${shortId(3)}`, color: colorFor(socket.id), guest: true };
    socket.data.opBudget = {
      ops: MAX_OPS_PER_SECOND,
      cursors: MAX_CURSORS_PER_SECOND,
      signals: MAX_SIGNALS_PER_SECOND,
      last: Date.now(),
    };
    // Personne n'est dans l'appel audio tant qu'il n'a pas cliqué le bouton.
    socket.data.inVoice = false;
  }

  io.on("connection", async (socket) => {
    const boardId = socket.data.boardId;
    socket.join(boardId);

    // 1) On envoie au nouvel arrivant l'état complet du board.
    socket.emit("init", {
      shapes: await loadShapes(boardId),
      clock: await maxClock(boardId),
      me: { ...socket.data.identity, role: socket.data.role, socketId: socket.id },
      peers: peersOf(io, boardId, socket.id),
    });

    // 2) On prévient les autres qu'il est arrivé.
    socket.to(boardId).emit("presence:join", {
      socketId: socket.id,
      ...socket.data.identity,
    });

    socket.on("shape:op", async (op, ack) => {
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

      try {
        const applied = await applyShapeOp(boardId, clean);
        // On accuse toujours réception (même si l'opération a perdu) pour que
        // le client puisse vider sa file d'attente.
        ack?.({ ok: true, applied });
        if (applied) {
          await touchBoard(boardId);
          socket.to(boardId).emit("shape:op", clean);
        } else {
          // L'opération a perdu : on renvoie à l'expéditeur la version qui
          // gagne pour qu'il se resynchronise immédiatement.
          const shapes = await loadShapes(boardId);
          const gagnante = shapes.find((shape) => shape.id === clean.id);
          socket.emit("shape:resync", { id: clean.id, shape: gagnante || null });
        }
      } catch (error) {
        console.error("[temps réel] échec de l'enregistrement d'une forme :", error);
        ack?.({ ok: false, error: "erreur serveur" });
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

    // --- Chat vocal (WebRTC) ---------------------------------------------
    //
    // Le son ne passe JAMAIS par le serveur : les navigateurs se parlent
    // directement (« pair-à-pair »). Mais pour se trouver, ils doivent
    // d'abord s'échanger quelques messages techniques — c'est la
    // « signalisation », et c'est tout ce que fait le serveur ici :
    // recopier un message d'un navigateur vers un autre, sans le lire.
    //
    // On réutilise la connexion Socket.IO déjà ouverte pour le dessin :
    // aucun serveur supplémentaire, aucun port en plus.

    socket.on("voice:join", (_payload, ack) => {
      if (socket.data.inVoice) return ack?.({ ok: true, peers: voicePeersOf(io, boardId, socket.id) });
      socket.data.inVoice = true;
      // On répond à celui qui arrive avec la liste de ceux DÉJÀ dans l'appel.
      // C'est lui qui les appellera : ainsi, pour chaque paire, un seul des
      // deux lance l'appel et les deux ne se téléphonent pas en même temps.
      ack?.({ ok: true, peers: voicePeersOf(io, boardId, socket.id) });
      socket.to(boardId).emit("voice:joined", {
        socketId: socket.id,
        ...socket.data.identity,
      });
    });

    socket.on("voice:leave", () => quitterLAudio(socket, boardId));

    socket.on("voice:signal", (message) => {
      if (!socket.data.inVoice) return;
      if (!allow(socket, "signals")) return;
      if (!isValidSignal(message)) return;

      // On ne recopie le message que vers quelqu'un qui est sur LE MÊME board
      // et dans l'appel. Sans ce contrôle, un participant pourrait envoyer
      // n'importe quoi à n'importe quel autre visiteur du site.
      const cible = io.sockets.sockets.get(message.to);
      if (!cible || cible.data.boardId !== boardId || !cible.data.inVoice) return;

      cible.emit("voice:signal", {
        from: socket.id,
        kind: message.kind,
        data: message.data,
      });
    });

    // Qui parle en ce moment : une simple information d'affichage.
    socket.on("voice:speaking", (speaking) => {
      if (!socket.data.inVoice) return;
      if (!allow(socket, "cursors")) return; // même plafond que les curseurs
      socket.to(boardId).emit("voice:speaking", {
        socketId: socket.id,
        speaking: Boolean(speaking),
      });
    });

    socket.on("disconnect", () => {
      quitterLAudio(socket, boardId);
      socket.to(boardId).emit("presence:leave", { socketId: socket.id });
    });
  });

  /** Sortie de l'appel — par le bouton « Quitter » ou par déconnexion. */
  function quitterLAudio(socket, boardId) {
    if (!socket.data.inVoice) return;
    socket.data.inVoice = false;
    socket.to(boardId).emit("voice:left", { socketId: socket.id });
  }

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
  budget.signals = Math.min(MAX_SIGNALS_PER_SECOND, budget.signals + elapsed * MAX_SIGNALS_PER_SECOND);
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


/** Les participants déjà dans l'appel audio de ce board. */
function voicePeersOf(io, boardId, exceptSocketId) {
  const room = io.sockets.adapter.rooms.get(boardId);
  if (!room) return [];
  const out = [];
  for (const socketId of room) {
    if (socketId === exceptSocketId) continue;
    const other = io.sockets.sockets.get(socketId);
    if (other?.data.inVoice) out.push({ socketId, ...other.data.identity });
  }
  return out;
}

// Types de messages de signalisation acceptés :
//   offer / answer = « voici comment me joindre » (description de session)
//   ice            = un chemin réseau possible entre les deux navigateurs
const SIGNAL_KINDS = new Set(["offer", "answer", "ice"]);

/**
 * Contrôle du message de signalisation avant de le recopier.
 *
 * Le serveur ne comprend pas le contenu — et n'a pas à le comprendre. Il
 * vérifie seulement que le message a la bonne forme, qu'il vise quelqu'un, et
 * qu'il n'est pas énorme : sans cette limite, on pourrait s'en servir pour
 * faire transiter des données arbitraires par le serveur.
 */
export function isValidSignal(message) {
  if (!message || typeof message !== "object") return false;
  if (typeof message.to !== "string" || message.to.length === 0 || message.to.length > 64) return false;
  if (!SIGNAL_KINDS.has(message.kind)) return false;
  if (message.data === null || typeof message.data !== "object") return false;
  return JSON.stringify(message.data).length <= 20_000;
}
