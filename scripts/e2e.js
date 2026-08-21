// Test de bout en bout, sans navigateur.
//
// Il simule DEUX personnes connectées au même board et vérifie que tout le
// parcours fonctionne : inscription, création de board, synchronisation des
// formes, curseurs, droits de lecture seule, partage par lien, persistance
// après reconnexion.
//
// Prérequis : le serveur doit tourner (npm run dev:server ou npm start).
// Lancer avec : npm run e2e
import { io } from "socket.io-client";
import { createHttpClient } from "./http.js";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const suffix = Date.now().toString(36);

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed++;
    console.log(`  ✔ ${label}`);
  } else {
    failed++;
    console.error(`  ✖ ${label}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/** Un « navigateur » simulé : il garde son cookie de session. */
function createClient(name) {
  const client = createHttpClient(BASE);
  client.name = name;
  return client;
}

function connect(client, boardId, shareToken) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, {
      extraHeaders: { cookie: client.cookie },
      auth: { boardId, shareToken },
      transports: ["websocket"],
      reconnection: false,
    });
    const timer = setTimeout(() => reject(new Error("délai dépassé à la connexion")), 5000);
    socket.on("init", (payload) => {
      clearTimeout(timer);
      socket.initPayload = payload;
      resolve(socket);
    });
    socket.on("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

const waitFor = (socket, event, timeout = 3000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`aucun « ${event} » reçu`)), timeout);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const rect = (id, x, clock, actor) => ({
  id,
  type: "upsert",
  clock,
  actor,
  shape: { kind: "rect", x, y: 0, w: 50, h: 50, stroke: "#1b1f24", strokeWidth: 3, z: clock },
});

async function main() {
  console.log(`Test de bout en bout sur ${BASE}`);

  // --- Comptes ----------------------------------------------------------
  section("1. Comptes");
  const alice = createClient("Alice");
  const bob = createClient("Bob");

  const inscription = await alice.call("POST", "/api/auth/register", {
    email: `alice-${suffix}@test.fr`,
    password: "motdepasse123",
    name: "Alice",
  });
  check("inscription d'Alice", inscription.status === 200 && inscription.data.user?.name === "Alice");

  await bob.call("POST", "/api/auth/register", {
    email: `bob-${suffix}@test.fr`,
    password: "motdepasse123",
    name: "Bob",
  });
  const moi = await bob.call("GET", "/api/auth/me");
  check("Bob est bien connecté après inscription", moi.data.user?.name === "Bob");

  const mauvais = await alice.call("POST", "/api/auth/login", {
    email: `alice-${suffix}@test.fr`,
    password: "mauvais-mot-de-passe",
  });
  check("un mauvais mot de passe est refusé (401)", mauvais.status === 401);

  const doublon = await alice.call("POST", "/api/auth/register", {
    email: `alice-${suffix}@test.fr`,
    password: "motdepasse123",
  });
  check("impossible de créer deux comptes avec le même email (409)", doublon.status === 409);

  // --- Board ------------------------------------------------------------
  section("2. Création d'un board");
  const creation = await alice.call("POST", "/api/boards", { title: "Board de test" });
  const board = creation.data.board;
  check("board créé avec une URL unique", Boolean(board?.id));

  const listeAlice = await alice.call("GET", "/api/boards");
  check("le board apparaît dans « Mes boards »", listeAlice.data.owned.some((b) => b.id === board.id));

  const accesBob = await bob.call("GET", `/api/boards/${board.id}`);
  check("Bob ne voit pas le board privé d'Alice (404)", accesBob.status === 404);

  // --- Temps réel -------------------------------------------------------
  section("3. Temps réel entre deux personnes");
  await alice.call("POST", `/api/boards/${board.id}/members`, {
    email: `bob-${suffix}@test.fr`,
    role: "edit",
  });

  const socketA = await connect(alice, board.id);
  const socketB = await connect(bob, board.id);
  check("Alice et Bob sont connectés au même board", Boolean(socketA.initPayload && socketB.initPayload));
  check("Bob a bien le droit de dessiner", socketB.initPayload.me.role === "edit");

  const debut = Date.now();
  const recuParB = waitFor(socketB, "shape:op");
  socketA.emit("shape:op", rect("forme-1", 0, 1, socketA.initPayload.me.id));
  const opRecue = await recuParB;
  const latence = Date.now() - debut;
  check("la forme d'Alice arrive chez Bob", opRecue.id === "forme-1");
  check(`latence de synchronisation sous 200 ms (mesurée : ${latence} ms)`, latence < 200);

  const curseurRecu = waitFor(socketB, "presence:cursor");
  socketA.emit("cursor", { x: 120, y: 45 });
  const curseur = await curseurRecu;
  check("le curseur d'Alice est visible par Bob", curseur.x === 120 && curseur.y === 45);
  check("Bob voit Alice dans la liste des présents", socketB.initPayload.peers.length >= 1);

  // --- Conflit ----------------------------------------------------------
  section("4. Modification simultanée de la même forme");
  const idConflit = "forme-conflit";
  // Les deux modifient la MÊME forme avec la MÊME horloge, sans s'être vus.
  socketA.emit("shape:op", rect(idConflit, 10, 5, socketA.initPayload.me.id));
  socketB.emit("shape:op", rect(idConflit, 999, 5, socketB.initPayload.me.id));
  await new Promise((resolve) => setTimeout(resolve, 300));

  const vueAlice = await alice.call("GET", `/api/boards/${board.id}`);
  const vueBob = await bob.call("GET", `/api/boards/${board.id}`);
  const chezAlice = vueAlice.data.shapes.find((s) => s.id === idConflit);
  const chezBob = vueBob.data.shapes.find((s) => s.id === idConflit);
  check("aucune des deux versions n'est perdue en double", Boolean(chezAlice && chezBob));
  check("les deux personnes voient exactement la même forme", chezAlice.x === chezBob.x);
  const gagnant = socketA.initPayload.me.id > socketB.initPayload.me.id ? 10 : 999;
  check("le gagnant est celui prévu par la règle de fusion", chezAlice.x === gagnant);

  // --- Persistance ------------------------------------------------------
  section("5. Persistance et reconnexion");
  socketA.close();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const socketA2 = await connect(alice, board.id);
  check(
    "après reconnexion, Alice retrouve son dessin",
    socketA2.initPayload.shapes.some((s) => s.id === "forme-1")
  );

  // --- Lecture seule ----------------------------------------------------
  section("6. Droits : lecture seule");
  await alice.call("POST", `/api/boards/${board.id}/members`, {
    email: `bob-${suffix}@test.fr`,
    role: "view",
  });
  socketB.close();
  const socketB2 = await connect(bob, board.id);
  check("Bob est repassé en lecture seule", socketB2.initPayload.me.role === "view");

  const refus = await new Promise((resolve) =>
    socketB2.emit("shape:op", rect("interdite", 0, 50, "bob"), resolve)
  );
  check("le serveur refuse le dessin d'un lecteur", refus?.ok === false);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const apresRefus = await alice.call("GET", `/api/boards/${board.id}`);
  check("la forme interdite n'a pas été enregistrée", !apresRefus.data.shapes.some((s) => s.id === "interdite"));

  // --- Partage par lien -------------------------------------------------
  section("7. Partage par lien");
  await alice.call("PATCH", `/api/boards/${board.id}`, { shareRole: "edit" });
  const infos = await alice.call("GET", `/api/boards/${board.id}/members`);
  const jeton = infos.data.shareToken;

  const visiteur = createClient("Visiteur"); // personne non connectée
  const sansJeton = await visiteur.call("GET", `/api/boards/${board.id}`);
  check("sans le lien, un inconnu n'entre pas (404)", sansJeton.status === 404);

  const avecJeton = await visiteur.call("GET", `/api/boards/${board.id}?k=${jeton}`);
  check("avec le lien, l'inconnu entre", avecJeton.status === 200);

  const socketVisiteur = await connect(visiteur, board.id, jeton);
  check("le lien « peut dessiner » donne le droit d'écrire", socketVisiteur.initPayload.me.role === "edit");
  check("le visiteur reçoit un pseudo et une couleur", Boolean(socketVisiteur.initPayload.me.name && socketVisiteur.initPayload.me.color));

  const nouveauJeton = (await alice.call("POST", `/api/boards/${board.id}/share/rotate`)).data.shareToken;
  const ancienLien = await visiteur.call("GET", `/api/boards/${board.id}?k=${jeton}`);
  check("l'ancien lien ne marche plus après régénération", ancienLien.status === 404 && Boolean(nouveauJeton));

  // --- Board public -----------------------------------------------------
  section("8. Board public");
  await alice.call("PATCH", `/api/boards/${board.id}`, { isPublic: true });
  const publique = await visiteur.call("GET", `/api/boards/${board.id}`);
  check("un board public est visible sans compte", publique.status === 200 && publique.data.role === "view");

  // --- Chat vocal : serveurs de mise en relation --------------------------
  //
  // Le navigateur demande au serveur par où passer pour joindre l'autre
  // personne. Ces identifiants (TURN) étant payants à l'usage, la route est
  // protégée exactement comme le board lui-même.
  section("9. Chat vocal : serveurs de mise en relation (ICE)");

  const ice = await alice.call("GET", `/api/boards/${board.id}/ice`);
  check("le serveur donne la liste des serveurs ICE", ice.status === 200);
  const serveurs = ice.data?.iceServers;
  check("la liste n'est pas vide", Array.isArray(serveurs) && serveurs.length > 0);
  check(
    "elle contient au moins un serveur STUN",
    serveurs?.some((s) => [].concat(s.urls).some((u) => String(u).startsWith("stun:")))
  );

  // Sans TURN configuré (cas du développement), aucun identifiant ne doit
  // circuler : c'est la preuve qu'on n'envoie pas de secret par défaut.
  const avecTurn = serveurs?.some((s) => [].concat(s.urls).some((u) => String(u).startsWith("turn")));
  if (avecTurn) {
    check("le serveur TURN est fourni avec ses identifiants",
      serveurs.some((s) => s.username && s.credential));
  } else {
    check("sans TURN configuré, aucun identifiant n'est transmis",
      serveurs.every((s) => !s.username && !s.credential));
  }

  // Le board d'Alice est encore privé à ce stade du test : un inconnu ne doit
  // pas pouvoir récupérer les identifiants du relais.
  const boardPrive = await alice.call("POST", "/api/boards", { title: "Board privé ICE" });
  const iceInterdit = await visiteur.call("GET", `/api/boards/${boardPrive.data.board.id}/ice`);
  check("un inconnu n'obtient pas les serveurs d'un board privé (404)", iceInterdit.status === 404);

  // --- Connexion avec Google ---------------------------------------------
  //
  // Google n'est pas configuré sur la machine de développement (pas de
  // GOOGLE_CLIENT_ID). On vérifie que son absence ne casse rien : le serveur
  // annonce simplement que ce moyen de connexion n'est pas disponible, et
  // l'email/mot de passe continue de fonctionner — ce que prouvent les
  // sections précédentes.
  section("10. Connexion avec Google (non configurée ici)");
  const moyens = await visiteur.call("GET", "/api/auth/me");
  const googleActif = moyens.data?.providers?.google === true;
  check(
    "le serveur annonce si la connexion Google est disponible",
    typeof moyens.data?.providers?.google === "boolean",
    JSON.stringify(moyens.data?.providers)
  );
  if (googleActif) {
    const depart = await visiteur.call("GET", "/auth/google");
    check("le départ vers Google redirige (302)", depart.status === 302 || depart.status === 200);
  } else {
    const depart = await visiteur.call("GET", "/auth/google");
    check("sans configuration, /auth/google répond 404 au lieu de planter", depart.status === 404);
    const retour = await visiteur.call("GET", "/auth/google/callback?code=faux&state=faux");
    check("le retour de Google répond aussi 404, sans erreur serveur", retour.status === 404);
  }

  // --- Limitation de débit ----------------------------------------------
  //
  // Ce test vide volontairement le « seau à jetons » des tentatives de
  // connexion. Comme le seau se remplit lentement (1 jeton toutes les 10 s —
  // c'est justement le but), tout ce qui vient de la même adresse IP dans les
  // deux minutes suivantes serait refusé, y compris les autres scripts de
  // test lancés à la suite.
  //
  // On joue donc l'attaquant depuis une AUTRE adresse : « 127.0.0.1 » et
  // « localhost » (qui vaut « ::1 ») sont deux adresses différentes pour le
  // serveur, donc deux seaux différents. C'est fidèle à la réalité — un
  // attaquant n'est pas au même endroit que les utilisateurs normaux — et
  // cela évite qu'un test en gêne un autre.
  section("11. Limitation de débit");
  const attaquant = createHttpClient(BASE.replace("localhost", "127.0.0.1"));
  let bloque = false;
  for (let i = 0; i < 40; i++) {
    const essai = await attaquant.call(
      "POST",
      "/api/auth/login",
      { email: "personne@test.fr", password: "x" },
      { retry: false } // ici on VEUT voir le refus
    );
    if (essai.status === 429) {
      bloque = true;
      break;
    }
  }
  check("le serveur bloque les tentatives de connexion en rafale (429)", bloque);
  check(
    "le blocage ne touche que l'attaquant, pas les autres utilisateurs",
    (await visiteur.call("GET", "/api/auth/me")).status === 200
  );

  // --- Nettoyage --------------------------------------------------------
  socketA2.close();
  socketB2.close();
  socketVisiteur.close();
  await alice.call("DELETE", `/api/boards/${board.id}`);

  console.log(`\n${passed} vérifications réussies, ${failed} échec(s).`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nErreur pendant le test :", error.message);
  process.exit(1);
});
