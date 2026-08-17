// Vérifie la connexion « Continuer avec Google » de bout en bout,
// SANS compte Google et sans réseau.
//
// Comment ? On démarre un vrai serveur, avec de fausses clés Google, et on
// intercepte l'unique appel que notre code fait vers Google (l'échange du
// code contre un jeton) pour répondre à sa place. Tout le reste — la
// redirection, le cookie « state », la création du compte, la pose du cookie
// de session — est le vrai code, exécuté pour de vrai.
//
// Lancer avec : npm run test:google
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;
const tempDb = path.join(os.tmpdir(), `whiteboard-google-${process.pid}.db`);

process.env.PORT = String(PORT);
process.env.DB_FILE = tempDb;
process.env.SESSION_SECRET = "secret-de-test-google";
process.env.NODE_ENV = "development";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.GOOGLE_CLIENT_ID = "faux-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "faux-secret";
delete process.env.DATABASE_URL;
// Ce script enchaîne une quinzaine de connexions en une seconde depuis la
// même adresse IP : avec le plafond de production il se bloquerait lui-même.
// La limitation de débit a son propre test, dans e2e.js.
process.env.RATE_LIMIT_AUTH_CAPACITY = "1000";
process.env.RATE_LIMIT_AUTH_REFILL = "100";

let passed = 0;
let failed = 0;
const check = (label, ok, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "✔" : "✖"} ${label}${ok || !detail ? "" : ` → ${detail}`}`);
};
const section = (titre) => console.log(`\n${titre}`);

// --- Interception de l'appel à Google ------------------------------------

const vraiFetch = globalThis.fetch;
let prochainProfil = null; // ce que « Google » répondra
let dernierEchange = null; // ce que notre serveur a envoyé à Google

function fauxIdToken(charge) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "RS256" })}.${b64(charge)}.signature`;
}

globalThis.fetch = async (url, options) => {
  if (String(url).startsWith("https://oauth2.googleapis.com/token")) {
    dernierEchange = Object.fromEntries(new URLSearchParams(options.body));
    if (!prochainProfil) {
      return new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ id_token: fauxIdToken(prochainProfil) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return vraiFetch(url, options);
};

// --- Petit client HTTP qui garde les cookies et ne suit pas les redirections

function navigateur() {
  const cookies = new Map();
  return {
    /** Va à une adresse et renvoie le statut, la redirection et les cookies. */
    async aller(chemin) {
      const entete = [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
      const response = await vraiFetch(BASE + chemin, {
        redirect: "manual",
        headers: entete ? { cookie: entete } : {},
      });
      for (const brut of response.headers.getSetCookie?.() || []) {
        const [paire] = brut.split(";");
        const index = paire.indexOf("=");
        const nom = paire.slice(0, index).trim();
        const valeur = paire.slice(index + 1).trim();
        if (valeur === "" || /expires=Thu, 01 Jan 1970/i.test(brut)) cookies.delete(nom);
        else cookies.set(nom, valeur);
      }
      return { status: response.status, location: response.headers.get("location"), cookies };
    },
    async json(chemin) {
      const entete = [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
      const response = await vraiFetch(BASE + chemin, { headers: entete ? { cookie: entete } : {} });
      return response.json();
    },
    cookies,
  };
}

/** Démarre une connexion Google et renvoie le « state » tiré au hasard. */
async function commencerConnexion(client) {
  const depart = await client.aller("/auth/google");
  if (depart.status !== 302 || !depart.location) {
    throw new Error(`départ vers Google inattendu : ${depart.status} ${depart.location}`);
  }
  return new URL(depart.location).searchParams.get("state");
}

async function main() {
  await import("../server/src/index.js");
  await new Promise((r) => setTimeout(r, 400)); // le temps que le serveur écoute

  // --- 1. Le serveur annonce Google -------------------------------------
  section("1. Annonce du moyen de connexion");
  const visiteur = navigateur();
  const moyens = await visiteur.json("/api/auth/me");
  check("avec les clés configurées, le serveur annonce Google", moyens.providers?.google === true);
  check("personne n'est connecté au départ", moyens.user === null);

  // --- 2. Départ vers Google --------------------------------------------
  section("2. Départ vers Google");
  const depart = await visiteur.aller("/auth/google");
  check("le clic redirige (302)", depart.status === 302, `reçu ${depart.status}`);

  const url = new URL(depart.location);
  check("la redirection pointe vers Google", url.origin === "https://accounts.google.com");
  check(
    "l'adresse de retour est construite depuis la requête",
    url.searchParams.get("redirect_uri") === `${BASE}/auth/google/callback`,
    url.searchParams.get("redirect_uri")
  );
  check("on demande bien l'email et le profil", url.searchParams.get("scope") === "openid email profile");
  check("le client_id est transmis", url.searchParams.get("client_id") === process.env.GOOGLE_CLIENT_ID);

  const state = url.searchParams.get("state");
  check("un « state » anti-fraude est généré", Boolean(state) && state.length >= 16);
  check("ce « state » est aussi rangé dans un cookie", visiteur.cookies.get("g_state") === state);

  // --- 3. Retour de Google : nouveau compte ------------------------------
  section("3. Retour de Google — compte inconnu");
  prochainProfil = { sub: "goo-1", email: "alice@gmail.com", email_verified: true, name: "Alice" };
  const retour = await visiteur.aller(`/auth/google/callback?code=code-unique&state=${state}`);
  check("le retour redirige vers le site", retour.status === 302, `reçu ${retour.status}`);
  check(
    "en développement, on revient sur le serveur Vite",
    retour.location === "http://localhost:5173/",
    retour.location
  );
  check("le secret a bien servi à l'échange", dernierEchange?.client_secret === "faux-secret");
  check("le code reçu a bien été renvoyé à Google", dernierEchange?.code === "code-unique");
  check("le cookie « state » est effacé après usage", !visiteur.cookies.get("g_state"));

  const connecte = await visiteur.json("/api/auth/me");
  check("la personne est maintenant connectée", connecte.user?.email === "alice@gmail.com", JSON.stringify(connecte.user));
  check("son nom Google est repris", connecte.user?.name === "Alice");

  // --- 4. Le compte est retrouvé, pas dupliqué ---------------------------
  section("4. Deuxième connexion avec le même compte Google");
  const visiteur2 = navigateur();
  const state2 = await commencerConnexion(visiteur2);
  prochainProfil = { sub: "goo-1", email: "alice@gmail.com", email_verified: true, name: "Alice" };
  await visiteur2.aller(`/auth/google/callback?code=c2&state=${state2}`);
  const connecte2 = await visiteur2.json("/api/auth/me");
  check("c'est le même compte, pas un doublon", connecte2.user?.id === connecte.user?.id);

  // --- 5. Un compte email existant est relié -----------------------------
  section("5. Compte email existant, même adresse");
  const inscription = await vraiFetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "bob@gmail.com", password: "motdepasse123", name: "Bob" }),
  });
  const bob = (await inscription.json()).user;

  const visiteur3 = navigateur();
  const state3 = await commencerConnexion(visiteur3);
  prochainProfil = { sub: "goo-2", email: "bob@gmail.com", email_verified: true, name: "Bob" };
  await visiteur3.aller(`/auth/google/callback?code=c3&state=${state3}`);
  const connecte3 = await visiteur3.json("/api/auth/me");
  check("Google relie le compte email déjà existant", connecte3.user?.id === bob.id, `${connecte3.user?.id} vs ${bob.id}`);

  // --- 6. Les cas qui doivent échouer ------------------------------------
  section("6. Tentatives invalides");
  const visiteur4 = navigateur();
  await visiteur4.aller("/auth/google");
  const mauvaisState = await visiteur4.aller("/auth/google/callback?code=c4&state=state-invente");
  check(
    "un « state » qui ne correspond pas est rejeté",
    mauvaisState.location?.includes("erreur=google-state"),
    mauvaisState.location
  );
  check("aucune session n'est ouverte dans ce cas", (await visiteur4.json("/api/auth/me")).user === null);

  const visiteur5 = navigateur();
  const state5 = await commencerConnexion(visiteur5);
  prochainProfil = { sub: "goo-3", email: "pirate@gmail.com", email_verified: false, name: "Pirate" };
  const nonVerifie = await visiteur5.aller(`/auth/google/callback?code=c5&state=${state5}`);
  check(
    "une adresse Google non vérifiée est refusée",
    nonVerifie.location?.includes("erreur=google-echec"),
    nonVerifie.location
  );

  const visiteur6 = navigateur();
  const state6 = await commencerConnexion(visiteur6);
  prochainProfil = null; // Google refuse l'échange
  const refus = await visiteur6.aller(`/auth/google/callback?code=perime&state=${state6}`);
  check(
    "un code périmé est traité proprement, sans erreur 500",
    refus.status === 302 && refus.location?.includes("erreur=google-echec"),
    `${refus.status} ${refus.location}`
  );

  const annule = await visiteur6.aller("/auth/google/callback?error=access_denied");
  check(
    "un clic sur « Annuler » chez Google est traité",
    annule.location?.includes("erreur=google-annule"),
    annule.location
  );

  // --- 7. L'email/mot de passe n'est pas cassé ---------------------------
  section("7. L'ancien moyen de connexion fonctionne toujours");
  const parMotDePasse = await vraiFetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "bob@gmail.com", password: "motdepasse123" }),
  });
  check("Bob peut toujours se connecter avec son mot de passe", parMotDePasse.status === 200);

  console.log(`\n${passed} vérifications réussies, ${failed} échec(s).`);
}

try {
  await main();
} catch (error) {
  console.error("\nErreur pendant le test Google :", error);
  failed++;
} finally {
  for (const suffixe of ["", "-wal", "-shm"]) {
    try { fs.unlinkSync(tempDb + suffixe); } catch { /* déjà supprimé */ }
  }
}

process.exit(failed === 0 ? 0 : 1);
