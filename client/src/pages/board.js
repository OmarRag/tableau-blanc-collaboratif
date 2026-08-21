// Page du tableau blanc : assemble le moteur de dessin, le réseau et l'UI.
import { api } from "../api.js";
import { createCamera } from "../board/camera.js";
import { createStore } from "../board/store.js";
import { createRenderer } from "../board/render.js";
import { createTools } from "../board/tools.js";
import { createNet } from "../board/net.js";
import { exportPng, exportJson, readJsonFile } from "../board/exporters.js";
import { createVoice, voiceSupported } from "../board/voice.js";

const boardId = location.pathname.split("/").filter(Boolean)[1];
const shareToken = new URLSearchParams(location.search).get("k");

const canvas = document.getElementById("board");
const el = (id) => document.getElementById(id);

const COLORS = ["#1b1f24", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#2563eb", "#7c3aed", "#db2777"];

let board = null;
let role = "view";
let net = null;
let tools = null;
let store = null;
let camera = null;
let voice = null;
const peers = new Map(); // socketId → { name, color, x, y }

start();

async function start() {
  try {
    const data = await api.getBoard(boardId, shareToken);
    board = data.board;
    role = data.role;
  } catch (error) {
    document.body.innerHTML = `<div class="home-shell"><h1>Board inaccessible</h1>
      <p class="subtitle">${error.message}</p><a href="/">← Retour à mes boards</a></div>`;
    return;
  }

  document.title = `${board.title} — Tableau blanc`;
  el("title").value = board.title;
  el("title").disabled = role !== "owner";
  el("readonly").hidden = canEdit();

  camera = createCamera();
  store = createStore({
    // Identité provisoire, le temps que le serveur nous donne la vraie (voir
    // onReady). Elle est tirée au hasard pour que deux navigateurs qui
    // dessineraient avant d'être connectés ne portent pas le même nom.
    actorId: `local-${crypto.randomUUID().slice(0, 8)}`,
    send: (op) => net?.send(op),
  });

  const renderer = createRenderer(canvas, camera);

  tools = createTools({
    canvas,
    camera,
    store,
    renderer,
    readOnly: () => !canEdit(),
    onCursor: (point) => net?.sendCursor(point),
    onStateChange: refreshUi,
  });

  net = createNet({
    boardId,
    shareToken,
    store,
    onStatus: setStatus,
    onReady: (payload) => {
      // Le serveur impose notre identité : on la répercute dans le magasin
      // pour que nos formes portent le bon auteur.
      store.setActor(payload.me.id);
      role = payload.me.role;
      el("readonly").hidden = canEdit();
      if (store.ordered().length) tools.fitToContent();
      refreshUi();
    },
    onPresence: handlePresence,
  });

  setupVoice();
  setupUi();
  refreshUi();
}

function canEdit() {
  return role === "edit" || role === "owner";
}

// --- Présence -------------------------------------------------------------

function handlePresence(event) {
  if (event.type === "reset") {
    peers.clear();
    for (const peer of event.peers) peers.set(peer.socketId, { ...peer });
  } else if (event.type === "join") {
    peers.set(event.peer.socketId, { ...event.peer });
  } else if (event.type === "leave") {
    peers.delete(event.socketId);
  } else if (event.type === "cursor") {
    const peer = peers.get(event.socketId);
    if (peer) {
      peer.x = event.x;
      peer.y = event.y;
    }
  }
  tools?.pushScene({ peers: [...peers.values()] });
  renderPeerBadges();
}

function renderPeerBadges() {
  el("peers").innerHTML = [...peers.values()]
    .map(
      (peer) =>
        `<span class="peer-dot" style="background:${peer.color}" title="${escapeHtml(peer.name)}">
           ${escapeHtml(initials(peer.name))}</span>`
    )
    .join("");
}

function initials(name) {
  return String(name || "?").trim().slice(0, 2).toUpperCase();
}

function setStatus({ connected, warning }) {
  const badge = el("connection");
  if (warning) return toast(warning);
  badge.textContent = connected ? "en ligne" : "hors ligne — vos traits seront renvoyés";
  badge.className = `badge ${connected ? "ok" : "off"}`;
}

// --- Chat vocal -----------------------------------------------------------
//
// Entièrement facultatif : si le navigateur ne sait pas faire de WebRTC, ou si
// le micro est refusé, le tableau continue de fonctionner exactement pareil.

function setupVoice() {
  const bouton = el("btn-voice");
  const micro = el("btn-mic");

  // Navigateur trop ancien (ou navigateur simulé des tests) : on n'affiche
  // même pas le bouton, plutôt que de proposer quelque chose qui échouera.
  if (!voiceSupported()) return;
  bouton.hidden = false;

  voice = createVoice({
    net,
    onChange: renderVoice,
    // Le message d'erreur reste affiché plus longtemps que d'habitude : il
    // explique quoi faire, il faut avoir le temps de le lire.
    onError: (message) => toast(message, 8000),
  });

  bouton.onclick = () => (voice.joined ? voice.leave() : voice.join());
  micro.onclick = () => voice.toggleMic();

  // Quitter proprement l'appel si on ferme l'onglet : sans cela, les autres
  // continueraient d'afficher quelqu'un qui n'est plus là.
  window.addEventListener("pagehide", () => voice?.destroy());

  renderVoice(voice.etat());
}

function renderVoice(etat) {
  const bouton = el("btn-voice");
  const micro = el("btn-mic");

  bouton.textContent = etat.joined ? "⏻ Quitter l'audio" : "🎙 Rejoindre l'audio";
  bouton.classList.toggle("in-call", etat.joined);

  micro.hidden = !etat.joined;
  micro.textContent = etat.micOn ? "🎤" : "🔇";
  micro.title = etat.micOn ? "Couper le micro" : "Activer le micro";
  micro.classList.toggle("muted", !etat.micOn);

  // Une pastille par personne dans l'appel, moi compris. Celle de la personne
  // qui parle s'entoure d'un halo (classe « speaking »).
  const moi = etat.joined
    ? [{ socketId: "moi", name: "Moi", color: "#0f766e", speaking: etat.speaking && etat.micOn }]
    : [];
  el("voice-peers").innerHTML = [...moi, ...etat.peers]
    .map(
      (peer) =>
        `<span class="peer-dot voice-dot${peer.speaking ? " speaking" : ""}"
               style="background:${peer.color}"
               title="${escapeHtml(peer.name)}${peer.speaking ? " — parle" : ""}">
           ${escapeHtml(initials(peer.name))}</span>`
    )
    .join("");
}

// --- Interface ------------------------------------------------------------

function setupUi() {
  // Outils
  for (const button of document.querySelectorAll("#toolbar [data-tool]")) {
    button.onclick = () => tools.setTool(button.dataset.tool);
  }

  // Couleurs
  el("swatches").innerHTML = COLORS.map(
    (color) => `<button data-color="${color}" style="background:${color}"></button>`
  ).join("");
  for (const button of el("swatches").querySelectorAll("[data-color]")) {
    button.onclick = () => tools.setStyle({ stroke: button.dataset.color });
  }

  el("stroke-width").oninput = (event) =>
    tools.setStyle({ strokeWidth: Number(event.target.value) });

  el("fill-toggle").onchange = (event) =>
    tools.setStyle({ fill: event.target.checked ? tools.state.style.stroke : null });

  // Historique
  el("btn-undo").onclick = () => store.undo();
  el("btn-redo").onclick = () => store.redo();

  // Zoom
  el("zoom-in").onclick = () => tools.zoomBy(1.2);
  el("zoom-out").onclick = () => tools.zoomBy(1 / 1.2);
  el("zoom-reset").onclick = () => tools.resetZoom();

  // Titre du board
  el("title").onchange = async (event) => {
    board = (await api.updateBoard(boardId, { title: event.target.value })).board;
    document.title = `${board.title} — Tableau blanc`;
    toast("Titre enregistré");
  };

  // Export / import
  el("btn-export").onclick = () => {
    el("export-menu").hidden = !el("export-menu").hidden;
  };
  el("export-png").onclick = async () => {
    el("export-menu").hidden = true;
    try {
      await exportPng(store.ordered(), { title: board.title });
    } catch (error) {
      toast(error.message);
    }
  };
  el("export-json").onclick = () => {
    el("export-menu").hidden = true;
    exportJson(store.ordered(), { title: board.title, boardId });
  };
  el("import-json").onclick = () => el("import-file").click();
  el("import-file").onchange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    el("export-menu").hidden = true;
    if (!file) return;
    if (!canEdit()) return toast("Lecture seule : import impossible.");
    try {
      const shapes = await readJsonFile(file);
      store.commit(shapes.map((shape) => ({ before: null, after: shape })), true);
      tools.fitToContent();
      toast(`${shapes.length} formes importées`);
    } catch (error) {
      toast(`Import impossible : ${error.message}`);
    }
  };

  // Partage — trois façons de refermer la fenêtre : le bouton, la touche
  // Échap, et un clic en dehors de la boîte blanche.
  el("btn-share").onclick = openShare;
  el("share-close").onclick = closeShare;
  el("share-modal").onclick = (event) => {
    // On ne ferme que si le clic a touché le fond gris lui-même : un clic
    // sur la boîte remonte jusqu'ici, mais ne doit rien fermer.
    if (event.target === el("share-modal")) closeShare();
  };
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!el("share-modal").hidden) closeShare();
    else el("export-menu").hidden = true;
  });
  el("share-copy").onclick = async () => {
    await navigator.clipboard.writeText(el("share-link").value);
    toast("Lien copié");
  };
  el("share-public").onchange = async (event) => {
    board = (await api.updateBoard(boardId, { isPublic: event.target.checked })).board;
    toast(board.isPublic ? "Board public" : "Board privé");
  };
  el("share-role").onchange = async (event) => {
    board = (await api.updateBoard(boardId, { shareRole: event.target.value })).board;
    updateShareLink();
  };
  el("share-rotate").onclick = async () => {
    const { shareToken: token } = await api.rotateShare(boardId);
    board.shareToken = token;
    updateShareLink();
    toast("Ancien lien désactivé");
  };
  el("invite-form").onsubmit = async (event) => {
    event.preventDefault();
    el("share-error").textContent = "";
    try {
      const { members } = await api.invite(boardId, el("invite-email").value, el("invite-role").value);
      el("invite-email").value = "";
      renderMembers(members);
    } catch (error) {
      el("share-error").textContent = error.message;
    }
  };

  document.addEventListener("click", (event) => {
    if (!el("export-menu").hidden && !event.target.closest("#export-menu, #btn-export")) {
      el("export-menu").hidden = true;
    }
  });

  // Le zoom du navigateur (Ctrl + molette) est déjà capté par le canvas.
  window.addEventListener("beforeunload", () => net?.destroy());
}

function closeShare() {
  el("share-modal").hidden = true;
}

async function openShare() {
  if (role !== "owner") return toast("Seul le propriétaire peut partager ce board.");
  const modal = el("share-modal");
  modal.hidden = false;
  el("share-public").checked = board.isPublic;
  el("share-role").value = board.shareRole;
  try {
    const { members, shareToken: token } = await api.members(boardId);
    board.shareToken = token;
    renderMembers(members);
    updateShareLink();
  } catch (error) {
    el("share-error").textContent = error.message;
  }
}

function updateShareLink() {
  el("share-link").value = `${location.origin}/b/${boardId}?k=${board.shareToken}`;
}

function renderMembers(members) {
  el("member-list").innerHTML = members.length
    ? members
        .map(
          (member) => `<li>
            <span class="peer-dot" style="background:${member.color}">${escapeHtml(initials(member.name))}</span>
            <span class="who">${escapeHtml(member.name)} — ${escapeHtml(member.email)}</span>
            <span class="tag">${member.role === "edit" ? "peut dessiner" : "lecture seule"}</span>
            <button data-remove="${member.id}">Retirer</button>
          </li>`
        )
        .join("")
    : `<li class="empty">Personne pour l'instant.</li>`;

  for (const button of el("member-list").querySelectorAll("[data-remove]")) {
    button.onclick = async () => {
      const { members: rest } = await api.removeMember(boardId, button.dataset.remove);
      renderMembers(rest);
    };
  }
}

function refreshUi() {
  for (const button of document.querySelectorAll("#toolbar [data-tool]")) {
    button.classList.toggle("active", button.dataset.tool === tools?.state.tool);
    button.disabled = !canEdit() && button.dataset.tool !== "select";
  }
  for (const button of document.querySelectorAll("#swatches [data-color]")) {
    button.classList.toggle("active", button.dataset.color === tools?.state.style.stroke);
  }
  el("btn-undo").disabled = !store?.canUndo();
  el("btn-redo").disabled = !store?.canRedo();
  el("zoom-reset").textContent = `${Math.round((camera?.zoom || 1) * 100)} %`;
  el("btn-share").hidden = role !== "owner";
}

let toastTimer = null;
function toast(message, duree = 2600) {
  const node = el("toast");
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.hidden = true), duree);
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );
}
