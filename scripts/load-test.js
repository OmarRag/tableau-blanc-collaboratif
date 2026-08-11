// Test de charge : plusieurs personnes dessinent en même temps sur le même
// board. Le sujet demande de vérifier le comportement à 5 participants ou plus.
//
// Ce qu'on mesure :
//   - la latence de propagation d'une forme (le sujet exige ~200 ms max) ;
//   - la convergence : tout le monde doit finir avec EXACTEMENT le même dessin ;
//   - l'absence de perte : aucune forme envoyée ne doit disparaître.
//
// Prérequis : le serveur doit tourner. Lancer avec : npm run load
import { io } from "socket.io-client";
import { createHttpClient } from "./http.js";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const UTILISATEURS = Number(process.env.LOAD_USERS || 6);
const FORMES_PAR_UTILISATEUR = Number(process.env.LOAD_SHAPES || 40);
const suffix = Date.now().toString(36);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function inscrire(index) {
  const client = createHttpClient(BASE);
  client.email = `charge-${suffix}-${index}@test.fr`;
  await client.call("POST", "/api/auth/register", {
    email: client.email,
    password: "motdepasse123",
    name: `User${index}`,
  });
  return client;
}

function connecter(client, boardId) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, {
      extraHeaders: { cookie: client.cookie },
      auth: { boardId },
      transports: ["websocket"],
      reconnection: false,
    });
    const timer = setTimeout(() => reject(new Error("connexion trop lente")), 8000);
    socket.on("init", (payload) => {
      clearTimeout(timer);
      socket.identite = payload.me;
      socket.recues = new Map();
      socket.on("shape:op", (op) => {
        if (op.type === "delete") socket.recues.delete(op.id);
        else socket.recues.set(op.id, op);
      });
      resolve(socket);
    });
    socket.on("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function main() {
  console.log(`Test de charge : ${UTILISATEURS} participants, ` +
    `${FORMES_PAR_UTILISATEUR} formes chacun (${UTILISATEURS * FORMES_PAR_UTILISATEUR} au total)`);

  const clients = [];
  for (let i = 0; i < UTILISATEURS; i++) clients.push(await inscrire(i));

  const { data } = await clients[0].call("POST", "/api/boards", { title: "Test de charge" });
  const board = data.board;
  // Tout le monde peut dessiner.
  for (let i = 1; i < clients.length; i++) {
    await clients[0].call("POST", `/api/boards/${board.id}/members`, {
      email: clients[i].email,
      role: "edit",
    });
  }

  const sockets = [];
  for (const client of clients) sockets.push(await connecter(client, board.id));
  console.log(`${sockets.length} participants connectés.\n`);

  // --- Mesure de la latence sur un aller simple --------------------------
  const latences = [];
  for (let essai = 0; essai < 20; essai++) {
    const emetteur = sockets[essai % sockets.length];
    const recepteur = sockets[(essai + 1) % sockets.length];
    const id = `ping-${essai}`;
    const depart = Date.now();
    const recu = new Promise((resolve) => {
      const handler = (op) => {
        if (op.id === id) {
          recepteur.off("shape:op", handler);
          resolve(Date.now() - depart);
        }
      };
      recepteur.on("shape:op", handler);
    });
    emetteur.emit("shape:op", {
      id,
      type: "upsert",
      clock: 1000 + essai,
      shape: { kind: "rect", x: essai, y: 0, w: 10, h: 10, stroke: "#000", strokeWidth: 2, z: essai },
    });
    latences.push(await recu);
  }
  latences.sort((a, b) => a - b);
  const moyenne = Math.round(latences.reduce((a, b) => a + b, 0) / latences.length);
  const p95 = latences[Math.floor(latences.length * 0.95)];
  console.log(`Latence : moyenne ${moyenne} ms, médiane ${latences[10]} ms, p95 ${p95} ms`);
  console.log(`  ${p95 < 200 ? "✔" : "✖"} objectif du sujet : moins de 200 ms\n`);

  // --- Rafale : tout le monde dessine en même temps -----------------------
  const debut = Date.now();
  const attendus = new Set();
  let horloge = 2000;

  await Promise.all(
    sockets.map(async (socket, index) => {
      for (let i = 0; i < FORMES_PAR_UTILISATEUR; i++) {
        const id = `u${index}-f${i}`;
        attendus.add(id);
        socket.emit("shape:op", {
          id,
          type: "upsert",
          clock: horloge++,
          shape: {
            kind: "pen",
            x: index * 100,
            y: i * 10,
            points: Array.from({ length: 30 }, (_, k) => [k, Math.sin(k) * 10]),
            stroke: "#2563eb",
            strokeWidth: 3,
            z: horloge,
          },
        });
        // Cadence réaliste : ~50 formes par seconde et par personne.
        if (i % 5 === 0) await wait(20);
      }
    })
  );

  console.log(`Rafale envoyée en ${Date.now() - debut} ms. Attente de la stabilisation…`);
  await wait(2500);

  // --- Vérifications ------------------------------------------------------
  const referenceReponse = await clients[0].call("GET", `/api/boards/${board.id}/export`);
  const enBase = referenceReponse.data.shapes;
  const idsEnBase = new Set(enBase.map((s) => s.id));

  const manquantes = [...attendus].filter((id) => !idsEnBase.has(id));
  console.log(`\nFormes enregistrées en base : ${enBase.length}`);
  console.log(`  ${manquantes.length === 0 ? "✔" : "✖"} aucune forme perdue (${manquantes.length} manquante(s))`);

  let convergent = true;
  for (const socket of sockets) {
    // Chaque participant doit avoir reçu toutes les formes des autres.
    const vues = new Set(socket.recues.keys());
    const manque = [...attendus].filter((id) => !vues.has(id) && !id.startsWith(`u${sockets.indexOf(socket)}-`));
    if (manque.length) {
      convergent = false;
      console.log(`  ✖ ${socket.identite.name} n'a pas reçu ${manque.length} forme(s)`);
    }
  }
  if (convergent) console.log("  ✔ tous les participants ont reçu toutes les formes des autres");

  const doublons = enBase.length !== new Set(enBase.map((s) => s.id)).size;
  console.log(`  ${doublons ? "✖" : "✔"} aucune forme en double`);

  for (const socket of sockets) socket.close();
  await clients[0].call("DELETE", `/api/boards/${board.id}`);

  const ok = manquantes.length === 0 && convergent && !doublons && p95 < 200;
  console.log(`\n${ok ? "Test de charge réussi." : "Test de charge en échec."}`);
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error("Erreur pendant le test de charge :", error.message);
  process.exit(1);
});
