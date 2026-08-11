// Le magasin de formes : la source de vérité côté navigateur.
//
// Il contient :
//   - toutes les formes du board ;
//   - l'horloge de Lamport locale (voir shared/merge.js) ;
//   - l'historique undo / redo, qui est LOCAL (le sujet le demande ainsi :
//     annuler ne doit défaire QUE ses propres actions, pas celles des autres).
import { shouldApply, tickClock, observeClock } from "../../../shared/merge.js";

export function createStore({ actorId, send }) {
  // L'auteur de mes formes. Provisoire au départ, puis remplacé par
  // l'identité que le serveur m'attribue à la connexion (voir setActor).
  let actor = actorId;
  const shapes = new Map(); // id → forme (avec clock, actor, z)
  const undoStack = [];
  const redoStack = [];
  const listeners = new Set();
  let clock = 0;

  function notify() {
    for (const listener of listeners) listener();
  }

  function ordered() {
    // z = valeur de l'horloge au moment de la création. Trier dessus donne
    // le même ordre d'empilement sur toutes les machines.
    return [...shapes.values()].sort((a, b) => (a.z - b.z) || (a.id < b.id ? -1 : 1));
  }

  /**
   * Applique une liste de changements faits PAR MOI et les envoie au serveur.
   * @param {Array<{before: object|null, after: object|null}>} changes
   * @param {boolean} recordHistory  false pendant un aperçu (drag en cours)
   */
  function commit(changes, recordHistory = true) {
    const effective = changes.filter((change) => change.before || change.after);
    if (!effective.length) return;

    for (const change of effective) {
      clock = tickClock(clock);
      const id = (change.after || change.before).id;

      if (change.after) {
        const shape = {
          ...change.after,
          id,
          clock,
          actor,
          z: change.before?.z ?? change.after.z ?? clock,
        };
        shapes.set(id, shape);
        send({ id, type: "upsert", clock, actor, shape: stripMeta(shape) });
      } else {
        shapes.delete(id);
        send({ id, type: "delete", clock, actor });
      }
    }

    if (recordHistory) {
      undoStack.push(effective.map((c) => ({ before: c.before, after: c.after })));
      redoStack.length = 0;
      if (undoStack.length > 200) undoStack.shift();
    }
    notify();
  }

  /** Rejoue un ensemble de changements (utilisé par undo et redo). */
  function replay(changes, direction) {
    const applied = [];
    for (const change of changes) {
      const target = direction === "undo" ? change.before : change.after;
      const id = (change.after || change.before).id;
      clock = tickClock(clock);
      if (target) {
        const shape = { ...target, id, clock, actor, z: target.z ?? clock };
        shapes.set(id, shape);
        send({ id, type: "upsert", clock, actor, shape: stripMeta(shape) });
      } else {
        shapes.delete(id);
        send({ id, type: "delete", clock, actor });
      }
      applied.push(change);
    }
    notify();
    return applied;
  }

  function undo() {
    const entry = undoStack.pop();
    if (!entry) return false;
    replay(entry, "undo");
    redoStack.push(entry);
    return true;
  }

  function redo() {
    const entry = redoStack.pop();
    if (!entry) return false;
    replay(entry, "redo");
    undoStack.push(entry);
    return true;
  }

  /** Opération reçue du serveur : on n'applique que si elle « gagne ». */
  function applyRemote(op) {
    clock = observeClock(clock, op.clock);
    const existing = shapes.get(op.id);
    const existingOp = existing ? { clock: existing.clock, actor: existing.actor } : undefined;
    if (!shouldApply(op, existingOp)) return false;

    if (op.type === "delete") shapes.delete(op.id);
    else shapes.set(op.id, { ...op.shape, id: op.id, clock: op.clock, actor: op.actor, z: op.shape.z ?? op.clock });
    notify();
    return true;
  }

  /**
   * Remise à niveau complète : à la première connexion et à chaque
   * reconnexion. On FUSIONNE (on n'écrase pas) pour ne pas perdre ce qui a
   * été dessiné pendant la coupure réseau.
   * @param {Array} serverShapes formes connues du serveur
   * @param {number} serverClock horloge maximale du serveur
   * @param {Set<string>} keepIds identifiants dont on a des envois en attente
   */
  function mergeSnapshot(serverShapes, serverClock, keepIds = new Set()) {
    clock = observeClock(clock, serverClock);
    const seen = new Set();

    for (const shape of serverShapes) {
      seen.add(shape.id);
      const existing = shapes.get(shape.id);
      const existingOp = existing ? { clock: existing.clock, actor: existing.actor } : undefined;
      if (shouldApply({ clock: shape.clock, actor: shape.actor }, existingOp)) {
        shapes.set(shape.id, { ...shape, z: shape.z ?? shape.clock });
      }
    }

    // Une forme que le serveur ne connaît pas et que je n'ai pas en attente
    // d'envoi a été supprimée par quelqu'un d'autre : je la retire aussi.
    for (const id of [...shapes.keys()]) {
      if (!seen.has(id) && !keepIds.has(id)) shapes.delete(id);
    }
    notify();
  }

  /**
   * Retire une forme sans rien envoyer : uniquement quand le serveur nous
   * apprend qu'elle n'existe plus (resynchronisation).
   */
  function forceRemove(id) {
    if (shapes.delete(id)) notify();
  }

  return {
    shapes,
    ordered,
    commit,
    undo,
    redo,
    applyRemote,
    forceRemove,
    mergeSnapshot,
    /** Identité définitive fournie par le serveur à la connexion. */
    setActor(id) { actor = id; },
    getActor: () => actor,
    get clock() { return clock; },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

/** Enlève les champs de synchronisation avant l'envoi réseau. */
function stripMeta(shape) {
  const { clock, actor, ...rest } = shape;
  return rest;
}
