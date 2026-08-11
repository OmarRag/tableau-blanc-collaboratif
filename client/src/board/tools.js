// Les outils : tout ce qui se passe quand on utilise la souris ou le clavier
// sur le canvas.
import { toWorld, zoomAt, clampZoom } from "./camera.js";
import { hitTest, intersectsBox, boundsOfMany } from "./shapes.js";

export function createTools({ canvas, camera, store, renderer, readOnly, onCursor, onStateChange }) {
  const state = {
    tool: "select",
    style: { stroke: "#1b1f24", strokeWidth: 3, fill: null },
    selection: new Set(),
  };

  let drag = null; // action en cours
  let spaceHeld = false;
  let textEditor = null;

  // --- Boucle d'affichage : on redonne la scène au moteur de rendu -------
  function pushScene(extra = {}) {
    renderer.setScene({
      shapes: store.ordered(),
      selection: state.selection,
      preview: drag?.preview || null,
      marquee: drag?.marquee || null,
      ...extra,
    });
    onStateChange?.();
  }
  store.subscribe(pushScene);

  // --- Utilitaires ------------------------------------------------------
  const pointerWorld = (event) => {
    const rect = canvas.getBoundingClientRect();
    return toWorld(camera, event.clientX - rect.left, event.clientY - rect.top);
  };

  function topShapeAt(point) {
    const ordered = store.ordered();
    for (let i = ordered.length - 1; i >= 0; i--) {
      if (hitTest(ordered[i], point.x, point.y, renderer.ctx)) return ordered[i];
    }
    return null;
  }

  function newShape(kind, point) {
    return {
      id: crypto.randomUUID(),
      kind,
      x: point.x,
      y: point.y,
      stroke: state.style.stroke,
      strokeWidth: state.style.strokeWidth,
      fill: state.style.fill,
    };
  }

  // --- Souris -----------------------------------------------------------
  canvas.addEventListener("pointerdown", (event) => {
    if (textEditor) closeTextEditor();
    canvas.setPointerCapture(event.pointerId);
    const point = pointerWorld(event);

    // Déplacement de la vue : molette enfoncée, barre d'espace, ou clic droit.
    if (event.button === 1 || event.button === 2 || spaceHeld) {
      drag = { mode: "pan", startX: event.clientX, startY: event.clientY, camX: camera.x, camY: camera.y };
      canvas.classList.add("panning");
      return;
    }
    if (event.button !== 0) return;

    if (readOnly() || state.tool === "select") return startSelect(point, event);

    switch (state.tool) {
      case "pen": {
        const shape = { ...newShape("pen", point), points: [[0, 0]] };
        drag = { mode: "pen", shape };
        store.commit([{ before: null, after: shape }], false);
        break;
      }
      case "rect":
      case "ellipse":
      case "arrow": {
        const shape = { ...newShape(state.tool, point), w: 0, h: 0 };
        drag = { mode: "shape", shape, origin: point };
        break;
      }
      case "text":
        // On empêche le comportement par défaut du navigateur : sans cela il
        // déplace le focus vers la page juste après notre code, ce qui ferme
        // aussitôt la zone de saisie qu'on vient d'ouvrir.
        event.preventDefault();
        openTextEditor(point);
        break;
      case "eraser":
        drag = { mode: "erase", changes: [] };
        eraseAt(point);
        break;
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    const point = pointerWorld(event);
    onCursor?.(point);

    if (!drag) return;

    switch (drag.mode) {
      case "pan": {
        camera.x = drag.camX + (event.clientX - drag.startX);
        camera.y = drag.camY + (event.clientY - drag.startY);
        renderer.invalidate();
        break;
      }
      case "pen": {
        const points = drag.shape.points;
        const last = points[points.length - 1];
        const dx = point.x - drag.shape.x;
        const dy = point.y - drag.shape.y;
        // On ignore les micro-déplacements : moins de points = plus fluide et
        // moins de données à envoyer sur le réseau.
        if (Math.hypot(dx - last[0], dy - last[1]) < 1.5 / camera.zoom) return;
        points.push([round(dx), round(dy)]);
        store.commit([{ before: null, after: { ...drag.shape, points: [...points] } }], false);
        break;
      }
      case "shape": {
        drag.shape = {
          ...drag.shape,
          w: point.x - drag.origin.x,
          h: point.y - drag.origin.y,
        };
        drag.preview = drag.shape;
        pushScene();
        break;
      }
      case "move": {
        const dx = point.x - drag.origin.x;
        const dy = point.y - drag.origin.y;
        const changes = drag.originals.map((original) => ({
          before: null,
          after: { ...original, x: original.x + dx, y: original.y + dy },
        }));
        store.commit(changes, false);
        break;
      }
      case "marquee": {
        drag.marquee = { x1: drag.origin.x, y1: drag.origin.y, x2: point.x, y2: point.y };
        pushScene();
        break;
      }
      case "erase":
        eraseAt(point);
        break;
    }
  });

  canvas.addEventListener("pointerup", (event) => {
    canvas.classList.remove("panning");
    if (!drag) return;
    const point = pointerWorld(event);

    switch (drag.mode) {
      case "pen":
        // On enregistre l'action complète dans l'historique en une seule fois.
        store.commit(
          [{ before: null, after: { ...drag.shape, points: [...drag.shape.points] } }],
          true
        );
        break;
      case "shape": {
        const shape = drag.shape;
        // Un simple clic sans glisser ne crée rien.
        if (Math.abs(shape.w) < 2 && Math.abs(shape.h) < 2) break;
        store.commit([{ before: null, after: shape }], true);
        state.selection = new Set([shape.id]);
        break;
      }
      case "move": {
        const dx = point.x - drag.origin.x;
        const dy = point.y - drag.origin.y;
        if (dx !== 0 || dy !== 0) {
          store.commit(
            drag.originals.map((original) => ({
              before: original,
              after: { ...original, x: original.x + dx, y: original.y + dy },
            })),
            true
          );
        }
        break;
      }
      case "marquee": {
        const box = normalizeBox(drag.marquee);
        state.selection = new Set(
          store.ordered()
            .filter((shape) => intersectsBox(shape, box, renderer.ctx))
            .map((shape) => shape.id)
        );
        break;
      }
      case "erase":
        if (drag.changes.length) store.commit(drag.changes, true);
        break;
    }

    drag = null;
    pushScene();
  });

  canvas.addEventListener("pointercancel", () => {
    drag = null;
    canvas.classList.remove("panning");
    pushScene();
  });

  // Le clic droit sert à déplacer la vue : on empêche le menu contextuel.
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  // Molette : zoom avec Ctrl (ou pincement sur pavé tactile), sinon défilement.
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (event.ctrlKey || event.metaKey) {
        zoomAt(camera, x, y, Math.exp(-event.deltaY * 0.01));
      } else {
        camera.x -= event.deltaX;
        camera.y -= event.deltaY;
      }
      renderer.invalidate();
      onStateChange?.();
    },
    { passive: false }
  );

  // --- Sélection --------------------------------------------------------
  function startSelect(point, event) {
    const hit = topShapeAt(point);
    if (hit) {
      if (event.shiftKey) {
        state.selection.has(hit.id) ? state.selection.delete(hit.id) : state.selection.add(hit.id);
      } else if (!state.selection.has(hit.id)) {
        state.selection = new Set([hit.id]);
      }
      if (!readOnly()) {
        drag = {
          mode: "move",
          origin: point,
          originals: [...state.selection].map((id) => ({ ...store.shapes.get(id) })).filter(Boolean),
        };
      }
    } else {
      if (!event.shiftKey) state.selection = new Set();
      drag = { mode: "marquee", origin: point, marquee: { x1: point.x, y1: point.y, x2: point.x, y2: point.y } };
    }
    pushScene();
  }

  function eraseAt(point) {
    const hit = topShapeAt(point);
    if (!hit) return;
    drag.changes.push({ before: hit, after: null });
    store.commit([{ before: hit, after: null }], false);
  }

  // --- Saisie de texte --------------------------------------------------
  function openTextEditor(point, existing = null) {
    const rect = canvas.getBoundingClientRect();
    const fontSize = existing?.fontSize || Math.max(14, state.style.strokeWidth * 6);
    const editor = document.createElement("div");
    editor.className = "text-editor";
    // « plaintext-only » empêche de coller du texte mis en forme. Les
    // navigateurs anciens ne le connaissent pas : on retombe sur « true ».
    editor.contentEditable = "plaintext-only";
    if (editor.contentEditable !== "plaintext-only") editor.contentEditable = "true";
    editor.textContent = existing?.text || "";
    editor.style.left = `${rect.left + point.x * camera.zoom + camera.x}px`;
    editor.style.top = `${rect.top + point.y * camera.zoom + camera.y}px`;
    editor.style.fontSize = `${fontSize * camera.zoom}px`;
    editor.style.color = state.style.stroke;
    document.body.appendChild(editor);
    textEditor = { editor, point, fontSize, existing };

    // On donne le focus à l'image suivante, une fois que le navigateur a fini
    // de traiter le clic ; sinon il nous le reprend immédiatement. Le
    // détecteur de perte de focus n'est branché qu'après, pour la même raison.
    requestAnimationFrame(() => {
      editor.focus();
      const selection = window.getSelection();
      if (selection && editor.firstChild) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false); // curseur à la fin du texte existant
        selection.removeAllRanges();
        selection.addRange(range);
      }
      editor.addEventListener("blur", closeTextEditor);
    });

    editor.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        editor.dataset.cancel = "1";
        editor.blur();
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        editor.blur();
      }
      event.stopPropagation();
    });
    editor.addEventListener("blur", closeTextEditor);
  }

  function closeTextEditor() {
    if (!textEditor) return;
    const { editor, point, fontSize, existing } = textEditor;
    textEditor = null;
    const text = editor.textContent.trim();
    const cancelled = editor.dataset.cancel === "1";
    editor.remove();
    if (cancelled || !text) return;

    if (existing) {
      store.commit([{ before: existing, after: { ...existing, text } }], true);
    } else {
      const shape = { ...newShape("text", point), text, fontSize };
      store.commit([{ before: null, after: shape }], true);
    }
  }

  // Double-clic sur un texte : on le rouvre pour le modifier.
  canvas.addEventListener("dblclick", (event) => {
    if (readOnly()) return;
    const point = pointerWorld(event);
    const hit = topShapeAt(point);
    if (hit?.kind === "text") {
      state.selection = new Set();
      openTextEditor({ x: hit.x, y: hit.y }, hit);
    }
  });

  // --- Clavier ----------------------------------------------------------
  const SHORTCUTS = { v: "select", p: "pen", r: "rect", e: "ellipse", a: "arrow", t: "text", g: "eraser" };

  window.addEventListener("keydown", (event) => {
    if (isTypingElsewhere(event.target)) return;
    // Quand une fenêtre est ouverte par-dessus le tableau, les raccourcis du
    // canvas ne doivent plus répondre (Échap doit fermer la fenêtre, pas
    // désélectionner les formes derrière).
    if (document.querySelector(".modal:not([hidden])")) return;

    if (event.code === "Space" && !spaceHeld) {
      spaceHeld = true;
      canvas.classList.add("panning");
      event.preventDefault();
      return;
    }

    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && event.key.toLowerCase() === "z") {
      event.preventDefault();
      event.shiftKey ? store.redo() : store.undo();
      return;
    }
    if (ctrl && event.key.toLowerCase() === "y") {
      event.preventDefault();
      store.redo();
      return;
    }
    if (ctrl && event.key.toLowerCase() === "a") {
      event.preventDefault();
      state.selection = new Set(store.ordered().map((shape) => shape.id));
      pushScene();
      return;
    }

    if ((event.key === "Delete" || event.key === "Backspace") && state.selection.size && !readOnly()) {
      event.preventDefault();
      deleteSelection();
      return;
    }
    if (event.key === "Escape") {
      state.selection = new Set();
      pushScene();
      return;
    }
    if (!ctrl && SHORTCUTS[event.key.toLowerCase()]) {
      setTool(SHORTCUTS[event.key.toLowerCase()]);
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "Space") {
      spaceHeld = false;
      canvas.classList.remove("panning");
    }
  });

  function deleteSelection() {
    const changes = [...state.selection]
      .map((id) => store.shapes.get(id))
      .filter(Boolean)
      .map((shape) => ({ before: shape, after: null }));
    state.selection = new Set();
    store.commit(changes, true);
  }

  // --- API publique -----------------------------------------------------
  function setTool(tool) {
    state.tool = tool;
    if (tool !== "select") state.selection = new Set();
    canvas.classList.toggle("tool-select", tool === "select");
    pushScene();
  }

  function setStyle(patch) {
    Object.assign(state.style, patch);
    // Si des formes sont sélectionnées, on leur applique aussi le nouveau style.
    if (state.selection.size && !readOnly()) {
      const changes = [...state.selection]
        .map((id) => store.shapes.get(id))
        .filter(Boolean)
        .map((shape) => ({ before: shape, after: { ...shape, ...patch } }));
      store.commit(changes, true);
    }
    onStateChange?.();
  }

  function zoomBy(factor) {
    zoomAt(camera, canvas.clientWidth / 2, canvas.clientHeight / 2, factor);
    renderer.invalidate();
    onStateChange?.();
  }

  function resetZoom() {
    camera.zoom = 1;
    renderer.invalidate();
    onStateChange?.();
  }

  /** Recentre la vue sur l'ensemble du dessin. */
  function fitToContent() {
    const box = boundsOfMany(store.ordered(), renderer.ctx);
    if (!box || !box.w || !box.h) return;
    const margin = 80;
    const zoom = clampZoom(
      Math.min(
        (canvas.clientWidth - margin) / box.w,
        (canvas.clientHeight - margin) / box.h,
        1.5
      )
    );
    camera.zoom = zoom;
    camera.x = canvas.clientWidth / 2 - (box.x + box.w / 2) * zoom;
    camera.y = canvas.clientHeight / 2 - (box.y + box.h / 2) * zoom;
    renderer.invalidate();
    onStateChange?.();
  }

  setTool("select");

  return { state, setTool, setStyle, zoomBy, resetZoom, fitToContent, pushScene, deleteSelection };
}

function isTypingElsewhere(target) {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
}

function normalizeBox(marquee) {
  return {
    x: Math.min(marquee.x1, marquee.x2),
    y: Math.min(marquee.y1, marquee.y2),
    w: Math.abs(marquee.x2 - marquee.x1),
    h: Math.abs(marquee.y2 - marquee.y1),
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}
