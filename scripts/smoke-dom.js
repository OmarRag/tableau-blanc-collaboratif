// Test « à blanc » de la page du tableau, sans navigateur.
//
// Pourquoi : le reste du code est testé automatiquement, mais tout ce qui
// touche à la page (identifiants HTML, branchement des boutons, dessin sur le
// canvas) ne s'exécute que dans un navigateur. On simule donc un navigateur
// minimal avec jsdom : si un identifiant HTML est mal écrit ou si le code
// plante au chargement, ce test le voit.
//
// Prérequis : le serveur doit tourner. Lancer avec : npm run smoke
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { createHttpClient } from "./http.js";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const suffix = Date.now().toString(36);

let passed = 0;
let failed = 0;
const check = (label, ok) => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "✔" : "✖"} ${label}`);
};

// --- Un « faux » contexte 2D qui compte les appels de dessin -------------
function fakeContext() {
  const calls = { strokeRect: 0, fillRect: 0, stroke: 0, fill: 0, fillText: 0, ellipse: 0 };
  const noop = () => {};
  const context = {
    calls,
    canvas: null,
    save: noop, restore: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, quadraticCurveTo: noop,
    clearRect: noop, setTransform: noop, setLineDash: noop, translate: noop, scale: noop,
    strokeRect: () => calls.strokeRect++,
    fillRect: () => calls.fillRect++,
    stroke: () => calls.stroke++,
    fill: () => calls.fill++,
    fillText: () => calls.fillText++,
    ellipse: () => calls.ellipse++,
    measureText: (text) => ({ width: String(text).length * 8 }),
    toBlob: (callback) => callback(new Blob([])),
  };
  return context;
}

async function main() {
  console.log(`Test de la page (DOM simulé) sur ${BASE}`);

  // 1) On prépare un board via l'API, comme le ferait un utilisateur.
  const client = createHttpClient(BASE);
  await client.call("POST", "/api/auth/register", {
    email: `dom-${suffix}@test.fr`,
    password: "motdepasse123",
    name: "Testeur DOM",
  });
  const cookie = client.cookie;
  const authed = async (method, url, body) => (await client.call(method, url, body)).data;

  const { board } = await authed("POST", "/api/boards", { title: "Board DOM" });
  // On ouvrira la page via un lien de partage « peut dessiner ». Raison
  // technique : dans ce DOM simulé, la connexion temps réel n'envoie pas les
  // cookies du navigateur ; le lien de partage donne les droits sans cookie.
  await authed("PATCH", `/api/boards/${board.id}`, { shareRole: "edit" });
  const { shareToken } = await authed("GET", `/api/boards/${board.id}/members`);

  // On y place une forme, pour vérifier qu'elle est bien dessinée à l'écran.
  const socketModule = await import("socket.io-client");
  const socket = socketModule.io(BASE, {
    extraHeaders: { cookie },
    auth: { boardId: board.id },
    transports: ["websocket"],
  });
  await new Promise((resolve) => socket.on("init", resolve));
  socket.emit("shape:op", {
    id: "carre",
    type: "upsert",
    clock: 1,
    shape: { kind: "rect", x: 0, y: 0, w: 80, h: 60, stroke: "#1b1f24", strokeWidth: 3, z: 1 },
  });
  socket.emit("shape:op", {
    id: "texte",
    type: "upsert",
    clock: 2,
    shape: { kind: "text", x: 10, y: 90, text: "bonjour", fontSize: 20, stroke: "#dc2626", z: 2 },
  });
  await new Promise((resolve) => setTimeout(resolve, 200));

  // 2) On charge la vraie page board.html dans le DOM simulé.
  const html = fs.readFileSync(path.resolve("client/board.html"), "utf8");
  const dom = new JSDOM(html, {
    url: `${BASE}/b/${board.id}?k=${shareToken}`,
    pretendToBeVisual: true, // fournit requestAnimationFrame
  });

  const context = fakeContext();
  dom.window.HTMLCanvasElement.prototype.getContext = function () {
    context.canvas = this;
    return context;
  };
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", { get: () => 1280 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", { get: () => 720 });
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
    left: 0, top: 0, right: 1280, bottom: 720, width: 1280, height: 720,
  });
  // jsdom ne connaît pas la « capture du pointeur » (utile pour continuer à
  // suivre la souris quand elle sort du canvas) : on la neutralise.
  dom.window.HTMLElement.prototype.setPointerCapture = () => {};
  dom.window.HTMLElement.prototype.releasePointerCapture = () => {};

  // On expose les objets du navigateur simulé au code de la page.
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  // « navigator » existe déjà dans Node et n'est pas remplaçable directement.
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  globalThis.Blob = dom.window.Blob;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  globalThis.HTMLElement = dom.window.HTMLElement;
  Object.defineProperty(dom.window, "crypto", {
    value: globalThis.crypto,
    configurable: true,
  });

  // fetch : le code de la page utilise des adresses relatives (« /api/… »).
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, options = {}) =>
    realFetch(String(url).startsWith("/") ? BASE + url : url, {
      ...options,
      headers: { ...(options.headers || {}), cookie },
    });

  const erreurs = [];
  dom.window.addEventListener("error", (event) => erreurs.push(event.message));
  process.on("unhandledRejection", (reason) => erreurs.push(String(reason)));

  // 3) On exécute le vrai code de la page.
  await import("../client/src/pages/board.js");
  await new Promise((resolve) => setTimeout(resolve, 1200));

  // 4) Vérifications
  const el = (id) => dom.window.document.getElementById(id);

  check("la page se charge sans erreur JavaScript", erreurs.length === 0);
  if (erreurs.length) console.log("    →", erreurs.slice(0, 3).join(" | "));

  check("le titre du board est affiché", el("title").value === "Board DOM");
  check("l'état de la connexion est affiché", /en ligne/.test(el("connection").textContent));
  check("le rectangle du serveur a été dessiné", context.calls.strokeRect > 0);
  check("le texte du serveur a été dessiné", context.calls.fillText > 0);
  check("les 7 outils sont présents", dom.window.document.querySelectorAll("#toolbar [data-tool]").length === 7);
  check("les couleurs ont été générées", dom.window.document.querySelectorAll("#swatches [data-color]").length === 8);
  check("l'outil sélection est actif au départ", el("toolbar").querySelector(".active")?.dataset.tool === "select");
  check("le niveau de zoom est affiché", /%/.test(el("zoom-reset").textContent));
  check("les boutons annuler/rétablir sont désactivés au départ", el("btn-undo").disabled && el("btn-redo").disabled);

  // Changement d'outil par un clic, comme le ferait l'utilisateur.
  el("toolbar").querySelector('[data-tool="rect"]').dispatchEvent(new dom.window.Event("click"));
  check("cliquer sur « rectangle » change l'outil actif",
    el("toolbar").querySelector(".active")?.dataset.tool === "rect");

  // Le menu d'export s'ouvre.
  el("btn-export").dispatchEvent(new dom.window.Event("click"));
  check("le menu Exporter s'ouvre", el("export-menu").hidden === false);

  // Un curseur distant apparaît bien.
  const avantCurseur = context.calls.fillText;
  socket.emit("cursor", { x: 50, y: 50 });
  await new Promise((resolve) => setTimeout(resolve, 400));
  check("le curseur d'un autre participant est dessiné", context.calls.fillText > avantCurseur);
  check("la pastille du participant apparaît en haut", el("peers").children.length >= 1);

  // 5) On dessine vraiment, en simulant la souris.
  const canvas = el("board");
  const pointer = (type, x, y, extra = {}) => {
    const event = new dom.window.MouseEvent(type, {
      clientX: x, clientY: y, button: 0, bubbles: true, ...extra,
    });
    Object.defineProperty(event, "pointerId", { value: 1 });
    canvas.dispatchEvent(event);
  };

  const formesAvant = async () => (await authed("GET", `/api/boards/${board.id}/export`)).shapes;

  pointer("pointerdown", 300, 300);
  pointer("pointermove", 420, 380);
  pointer("pointerup", 420, 380);
  await new Promise((resolve) => setTimeout(resolve, 400));

  let formes = await formesAvant();
  const dessine = formes.find((s) => s.kind === "rect" && s.id !== "carre");
  check("un rectangle dessiné à la souris est envoyé au serveur", Boolean(dessine));
  // Le glissé fait 120 × 80 pixels à l'écran. En coordonnées monde la taille
  // dépend du zoom, mais les proportions (1,5) doivent être conservées.
  check("le rectangle a les bonnes proportions", dessine && Math.abs(dessine.w / dessine.h - 1.5) < 0.02);
  check("le bouton annuler est maintenant actif", el("btn-undo").disabled === false);

  el("btn-undo").dispatchEvent(new dom.window.Event("click"));
  await new Promise((resolve) => setTimeout(resolve, 400));
  formes = await formesAvant();
  check("annuler retire le rectangle", !formes.some((s) => s.id === dessine.id));

  el("btn-redo").dispatchEvent(new dom.window.Event("click"));
  await new Promise((resolve) => setTimeout(resolve, 400));
  formes = await formesAvant();
  check("rétablir le remet", formes.some((s) => s.id === dessine.id));

  // 6) Gomme : on efface le rectangle qu'on vient de dessiner, en cliquant
  //    exactement là où on avait commencé à le tracer (donc sur son contour).
  el("toolbar").querySelector('[data-tool="eraser"]').dispatchEvent(new dom.window.Event("click"));
  pointer("pointerdown", 300, 300);
  pointer("pointerup", 300, 300);
  await new Promise((resolve) => setTimeout(resolve, 400));
  formes = await formesAvant();
  check("la gomme supprime la forme cliquée", !formes.some((s) => s.id === dessine.id));

  // 7) Zoom.
  const zoomAvant = el("zoom-reset").textContent;
  el("zoom-in").dispatchEvent(new dom.window.Event("click"));
  check("le bouton zoom + change le niveau de zoom", el("zoom-reset").textContent !== zoomAvant);
  el("zoom-reset").dispatchEvent(new dom.window.Event("click"));
  check("le bouton 100 % remet le zoom à 100 %", el("zoom-reset").textContent.startsWith("100"));

  socket.close();
  await authed("DELETE", `/api/boards/${board.id}`);

  console.log(`\n${passed} vérifications réussies, ${failed} échec(s).`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nErreur pendant le test :", error);
  process.exit(1);
});
