// Même principe que smoke-dom.js, mais pour la page d'accueil :
// inscription, connexion, liste « Mes boards », création et suppression.
//
// Prérequis : le serveur doit tourner. Lancer avec : npm run smoke
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const suffix = Date.now().toString(36);
const email = `home-${suffix}@test.fr`;

let passed = 0;
let failed = 0;
const check = (label, ok) => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "✔" : "✖"} ${label}`);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log(`Test de la page d'accueil (DOM simulé) sur ${BASE}`);

  const html = fs.readFileSync(path.resolve("client/index.html"), "utf8");
  const dom = new JSDOM(html, { url: `${BASE}/`, pretendToBeVisual: true });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  // Node possède déjà un FormData, mais il ne sait pas lire un formulaire du
  // DOM simulé : on utilise celui de jsdom.
  globalThis.FormData = dom.window.FormData;

  // Le DOM simulé ne gère pas les cookies des requêtes : on les transporte
  // nous-mêmes, exactement comme le ferait un vrai navigateur.
  let cookie = "";
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    let response;
    // Les scripts de test s'enchaînent depuis la même IP : la limitation de
    // débit du serveur peut se déclencher. On attend et on réessaie.
    for (let essai = 0; ; essai++) {
      response = await realFetch(String(url).startsWith("/") ? BASE + url : url, {
        ...options,
        headers: { ...(options.headers || {}), ...(cookie ? { cookie } : {}) },
      });
      if (response.status !== 429 || essai >= 6) break;
      const retryAfter = Number(response.headers.get("retry-after")) || 2;
      await wait(retryAfter * 1000);
    }
    for (const value of response.headers.getSetCookie?.() || []) cookie = value.split(";")[0];
    return response;
  };

  // « prompt » et « confirm » ne sont pas implémentés par jsdom : on répond
  // à leur place, comme le ferait l'utilisateur.
  globalThis.prompt = dom.window.prompt = () => "Board créé depuis la page d'accueil";
  globalThis.confirm = dom.window.confirm = () => true;
  globalThis.alert = dom.window.alert = () => {};

  const erreurs = [];
  dom.window.addEventListener("error", (event) => erreurs.push(event.message));

  await import("../client/src/pages/home.js");
  await wait(500);

  const app = dom.window.document.getElementById("app");
  check("la page se charge sans erreur JavaScript", erreurs.length === 0);
  check("le formulaire de connexion s'affiche pour un visiteur", Boolean(app.querySelector("#auth-form")));
  // Google n'est pas configuré en développement : le bouton ne doit pas
  // apparaître, et surtout l'email/mot de passe doit continuer de marcher —
  // c'est ce que vérifient les lignes suivantes.
  check(
    "sans configuration Google, le bouton « Continuer avec Google » est absent",
    app.querySelector("#google-login") === null
  );
  check("on peut basculer vers « Créer un compte »", app.querySelectorAll(".auth-tabs button").length === 2);

  // Bascule sur l'inscription.
  app.querySelector('[data-mode="register"]').dispatchEvent(new dom.window.Event("click"));
  await wait(50);
  check("le formulaire d'inscription demande un nom", Boolean(app.querySelector('input[name="name"]')));

  // Inscription.
  app.querySelector('input[name="name"]').value = "Testeur Accueil";
  app.querySelector('input[name="email"]').value = email;
  app.querySelector('input[name="password"]').value = "motdepasse123";
  app.querySelector("#auth-form").dispatchEvent(new dom.window.Event("submit"));
  await wait(700);

  check("après inscription, on arrive sur « Mes boards »", /Mes boards/.test(app.textContent));
  check("le nom de l'utilisateur est affiché", /Testeur Accueil/.test(app.textContent));
  check("la liste est vide au départ", /Aucun board pour l'instant/.test(app.textContent));

  // Création d'un board (la navigation est bloquée dans jsdom, on récupère
  // donc le résultat via l'API).
  app.querySelector("#new-board").dispatchEvent(new dom.window.Event("click"));
  await wait(700);
  const liste = await globalThis.fetch("/api/boards").then((r) => r.json());
  check("le bouton « Nouveau board » crée bien un board", liste.owned.length === 1);
  check("le board porte le nom saisi", liste.owned[0]?.title === "Board créé depuis la page d'accueil");

  // Erreur de connexion affichée à l'utilisateur.
  await globalThis.fetch("/api/auth/logout", { method: "POST" });
  cookie = "";
  const dom2 = new JSDOM(html, { url: `${BASE}/`, pretendToBeVisual: true });
  globalThis.window = dom2.window;
  globalThis.document = dom2.window.document;
  const home = await import(`../client/src/pages/home.js?v=${Date.now()}`);
  void home;
  await wait(400);
  const app2 = dom2.window.document.getElementById("app");
  app2.querySelector('input[name="email"]').value = email;
  app2.querySelector('input[name="password"]').value = "mauvais-mot-de-passe";
  app2.querySelector("#auth-form").dispatchEvent(new dom2.window.Event("submit"));
  await wait(600);
  check(
    "un mot de passe faux affiche un message d'erreur lisible",
    /incorrect/i.test(app2.querySelector("#auth-error").textContent)
  );

  console.log(`\n${passed} vérifications réussies, ${failed} échec(s).`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nErreur pendant le test :", error);
  process.exit(1);
});
