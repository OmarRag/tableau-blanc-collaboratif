// Connexion temps réel avec le serveur (Socket.IO).
//
// Deux idées importantes ici :
//
// 1) FILE D'ATTENTE + REGROUPEMENT. On n'envoie pas un message réseau à
//    chaque pixel dessiné. Les opérations sont rangées dans une « boîte
//    d'envoi » indexée par forme, vidée toutes les 40 ms. Comme la règle de
//    fusion est « la dernière version gagne », ne garder que la dernière
//    version d'une forme ne perd aucune information.
//
// 2) RECONNEXION SANS PERTE. Tant qu'une opération n'a pas été confirmée par
//    le serveur, elle reste dans la boîte d'envoi. Si le réseau tombe, on
//    continue de dessiner ; au retour de la connexion, tout est renvoyé, puis
//    on fusionne l'état du serveur avec le nôtre.
import { io } from "socket.io-client";

const FLUSH_MS = 40;
const CURSOR_MS = 50;

export function createNet({ boardId, shareToken, store, onPresence, onStatus, onReady }) {
  const outbox = new Map(); // id de forme → dernière opération à envoyer
  const inFlight = new Map(); // opérations envoyées, en attente de confirmation
  let socket = null;
  let lastCursorSent = 0;

  socket = io({
    auth: { boardId, shareToken },
    transports: ["websocket", "polling"],
    // Socket.IO retente tout seul, avec un délai qui augmente à chaque échec.
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", () => {
    onStatus?.({ connected: true });
    flush(); // on renvoie ce qui n'était pas parti
  });

  socket.on("disconnect", () => {
    // Les opérations parties mais jamais confirmées retournent dans la boîte
    // d'envoi : sans cela, elles seraient perdues à la reconnexion.
    for (const [id, op] of inFlight) if (!outbox.has(id)) outbox.set(id, op);
    inFlight.clear();
    onStatus?.({ connected: false });
  });
  socket.on("connect_error", (error) => onStatus?.({ connected: false, error: error.message }));

  socket.on("init", (payload) => {
    const keep = new Set([...outbox.keys(), ...inFlight.keys()]);
    store.mergeSnapshot(payload.shapes, payload.clock, keep);
    onReady?.(payload);
    onPresence?.({ type: "reset", peers: payload.peers });
  });

  socket.on("shape:op", (op) => store.applyRemote(op));

  // Mon opération a perdu face à celle de quelqu'un d'autre : le serveur me
  // renvoie la version qui fait foi.
  socket.on("shape:resync", ({ id, shape }) => {
    if (shape) store.applyRemote({ id, type: "upsert", clock: shape.clock, actor: shape.actor, shape });
    else store.forceRemove(id);
  });

  socket.on("presence:join", (peer) => onPresence?.({ type: "join", peer }));
  socket.on("presence:leave", ({ socketId }) => onPresence?.({ type: "leave", socketId }));
  socket.on("presence:cursor", (payload) => onPresence?.({ type: "cursor", ...payload }));

  function send(op) {
    outbox.set(op.id, op);
  }

  function flush() {
    if (!socket.connected || outbox.size === 0) return;
    for (const [id, op] of outbox) {
      outbox.delete(id);
      inFlight.set(id, op);
      socket.emit("shape:op", op, (reply) => {
        // On ne retire l'opération de la file que si le serveur a répondu.
        if (inFlight.get(id) === op) inFlight.delete(id);
        if (reply && reply.ok === false && reply.error) onStatus?.({ warning: reply.error });
      });
    }
  }

  const timer = setInterval(flush, FLUSH_MS);

  function sendCursor(point) {
    const now = Date.now();
    if (now - lastCursorSent < CURSOR_MS) return;
    lastCursorSent = now;
    socket.emit("cursor", { x: Math.round(point.x), y: Math.round(point.y) });
  }

  function destroy() {
    clearInterval(timer);
    socket.close();
  }

  return { send, sendCursor, destroy, get connected() { return socket.connected; } };
}
