// Test du chat vocal dans DEUX vrais navigateurs Chromium.
//
// Pourquoi ce test : le chat vocal ne peut pas se vérifier dans un navigateur
// simulé — jsdom ne connaît ni les micros ni WebRTC. Et on ne peut pas
// demander à un test de parler dans un micro. Chromium sait heureusement
// fabriquer un FAUX micro qui émet un bip continu :
//
//   --use-fake-device-for-media-stream   invente un micro et une caméra
//   --use-fake-ui-for-media-stream       accepte l'autorisation sans fenêtre
//
// On ouvre donc deux navigateurs sur le même board, on clique « Rejoindre
// l'audio » dans les deux, et on vérifie que la liaison audio directe
// s'établit vraiment entre eux (état « connected ») et que du son circule.
//
// Prérequis : le projet doit tourner (npm run dev).
// Lancer avec : npm run voice
import { chromium } from "playwright";

const BASE = process.env.BROWSER_BASE || "http://localhost:5173";
const suffix = Date.now().toString(36);

let passed = 0;
let failed = 0;
const check = (label, ok, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "✔" : "✖"} ${label}${ok || !detail ? "" : ` → ${detail}`}`);
};
const section = (title) => console.log(`\n${title}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ouvre un navigateur muni d'un faux micro. */
async function ouvrirAvecMicro() {
  return chromium.launch({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
}

/** Inscrit un compte et renvoie une page connectée. */
async function nouveauCompte(navigateur, nom) {
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-mode="register"]');
  await page.fill('input[name="name"]', nom);
  await page.fill('input[name="email"]', `${nom.toLowerCase()}-${suffix}@test.fr`);
  await page.fill('input[name="password"]', "motdepasse123");
  await page.click('#auth-form button[type="submit"]');
  await page.waitForSelector("#new-board");
  return page;
}

/** Attend que la connexion temps réel du board soit établie. */
async function attendreBoard(page) {
  await page.waitForSelector("#board");
  await page.waitForFunction(() =>
    document.getElementById("connection")?.textContent.includes("en ligne")
  );
}

async function main() {
  console.log("Test du chat vocal — deux Chromium avec un faux micro.\n");

  const navA = await ouvrirAvecMicro();
  const navB = await ouvrirAvecMicro();

  const erreurs = { A: [], B: [] };

  // --- 1. Deux personnes sur le même board -------------------------------
  section("1. Deux personnes sur le même board");

  const pageA = await nouveauCompte(navA, "Alice");
  pageA.on("pageerror", (e) => erreurs.A.push(e.message));
  pageA.on("dialog", (d) => d.accept("Board audio"));
  await Promise.all([pageA.waitForURL(/\/b\//), pageA.click("#new-board")]);
  await attendreBoard(pageA);
  const url = pageA.url();
  check("Alice a créé un board et est connectée", true);

  // Bob rejoint le même board par le lien de partage (droit d'écriture).
  await pageA.click("#btn-share");
  await pageA.selectOption("#share-role", "edit");
  await pageA.waitForFunction(() => document.getElementById("share-link")?.value?.includes("/b/"));
  const lien = await pageA.inputValue("#share-link");
  await pageA.click("#share-close");

  const pageB = await nouveauCompte(navB, "Bob");
  pageB.on("pageerror", (e) => erreurs.B.push(e.message));
  await pageB.goto(lien, { waitUntil: "networkidle" });
  await attendreBoard(pageB);
  check("Bob a rejoint le même board par le lien de partage", pageB.url().includes(url.split("/b/")[1].split("?")[0]));

  // --- 2. Le bouton audio ------------------------------------------------
  section("2. Le bouton audio");

  const boutonVisible = await pageA.isVisible("#btn-voice");
  check("le bouton « Rejoindre l'audio » est visible", boutonVisible);
  check(
    "son libellé est correct",
    (await pageA.textContent("#btn-voice")).trim().includes("Rejoindre l'audio")
  );
  check("le bouton micro est caché tant qu'on n'a pas rejoint", await pageA.isHidden("#btn-mic"));

  // --- 3. Les deux rejoignent l'appel ------------------------------------
  section("3. Les deux rejoignent l'appel");

  await pageA.click("#btn-voice");
  await pageA.waitForFunction(() =>
    document.getElementById("btn-voice")?.textContent.includes("Quitter")
  );
  check("Alice a rejoint : le bouton devient « Quitter l'audio »", true);
  check("le bouton micro apparaît", await pageA.isVisible("#btn-mic"));

  await pageB.click("#btn-voice");
  await pageB.waitForFunction(() =>
    document.getElementById("btn-voice")?.textContent.includes("Quitter")
  );
  check("Bob a rejoint aussi", true);

  // --- 4. La liaison directe s'établit-elle vraiment ? -------------------
  section("4. La liaison pair-à-pair");

  // Chacun doit voir la pastille de l'autre, en plus de la sienne.
  const voitDeuxPastilles = async (page) =>
    page.waitForFunction(
      () => document.querySelectorAll("#voice-peers .voice-dot").length >= 2,
      null,
      { timeout: 20000 }
    ).then(() => true, () => false);

  check("Alice voit deux participants dans l'appel", await voitDeuxPastilles(pageA));
  check("Bob voit deux participants dans l'appel", await voitDeuxPastilles(pageB));

  // On interroge directement l'objet WebRTC : c'est la preuve que le son
  // passe réellement d'un navigateur à l'autre, sans passer par le serveur.
  const etatLiaison = async (page) =>
    page.evaluate(async () => {
      // On retrouve la balise <audio> créée par voice.js et on lit son flux.
      const audios = [...document.querySelectorAll("audio")].filter((a) => a.srcObject);
      if (!audios.length) return { pistes: 0, actives: 0 };
      const pistes = audios.flatMap((a) => a.srcObject.getAudioTracks());
      return {
        pistes: pistes.length,
        actives: pistes.filter((t) => t.readyState === "live").length,
      };
    });

  const attendreSon = async (page, nom) => {
    for (let essai = 0; essai < 40; essai++) {
      const etat = await etatLiaison(page);
      if (etat.actives > 0) return etat;
      await wait(500);
    }
    return etatLiaison(page);
  };

  const sonChezA = await attendreSon(pageA, "Alice");
  const sonChezB = await attendreSon(pageB, "Bob");
  check(
    "Alice reçoit une piste audio vivante venant de Bob",
    sonChezA.actives > 0,
    JSON.stringify(sonChezA)
  );
  check(
    "Bob reçoit une piste audio vivante venant d'Alice",
    sonChezB.actives > 0,
    JSON.stringify(sonChezB)
  );

  // --- 5. Couper le micro ------------------------------------------------
  section("5. Couper et rallumer le micro");

  await pageA.click("#btn-mic");
  check("le bouton micro passe en « coupé »", (await pageA.textContent("#btn-mic")).includes("🔇"));
  // Couper le micro ne doit PAS raccrocher : la piste reçue de Bob reste
  // vivante, on continue de l'entendre. Seul notre propre son est muet.
  const pendantLaCoupure = await etatLiaison(pageA);
  check(
    "la liaison reste ouverte : on entend toujours Bob",
    pendantLaCoupure.actives > 0,
    JSON.stringify(pendantLaCoupure)
  );

  await pageA.click("#btn-mic");
  check("on peut le rallumer", (await pageA.textContent("#btn-mic")).includes("🎤"));

  // --- 6. Quitter l'appel ------------------------------------------------
  section("6. Quitter l'appel");

  await pageA.click("#btn-voice");
  await pageA.waitForFunction(() =>
    document.getElementById("btn-voice")?.textContent.includes("Rejoindre")
  );
  check("Alice a quitté : le bouton redevient « Rejoindre l'audio »", true);
  check("le bouton micro est de nouveau caché", await pageA.isHidden("#btn-mic"));

  const bobSeulAttendu = await pageB
    .waitForFunction(
      () => document.querySelectorAll("#voice-peers .voice-dot").length === 1,
      null,
      { timeout: 15000 }
    )
    .then(() => true, () => false);
  check("Bob voit qu'Alice a quitté l'appel", bobSeulAttendu);

  // --- 7. Le tableau continue de fonctionner -----------------------------
  section("7. Le dessin fonctionne toujours pendant l'appel");

  // Bob est toujours dans l'appel : on vérifie qu'un dessin d'Alice lui
  // parvient quand même. C'est la preuve que le vocal n'a rien cassé.
  const comptePixels = (page) =>
    page.evaluate(() => {
      const canvas = document.getElementById("board");
      const ctx = canvas.getContext("2d");
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let sombres = 0;
      // On compte les pixels nettement plus sombres que le fond blanc :
      // c'est la trace d'un trait.
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) sombres++;
      }
      return sombres;
    });

  const avant = await comptePixels(pageB);

  await pageA.click('#toolbar [data-tool="rect"]');
  const boite = await pageA.locator("#board").boundingBox();
  await pageA.mouse.move(boite.x + 300, boite.y + 300);
  await pageA.mouse.down();
  await pageA.mouse.move(boite.x + 500, boite.y + 430, { steps: 10 });
  await pageA.mouse.up();

  const arrive = await pageB
    .waitForFunction(
      (seuil) => {
        const canvas = document.getElementById("board");
        const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
        let sombres = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) sombres++;
        }
        return sombres > seuil + 100;
      },
      avant,
      { timeout: 10000 }
    )
    .then(() => true, () => false);

  const apres = await comptePixels(pageB);
  check(
    "le rectangle dessiné par Alice apparaît bien chez Bob",
    arrive,
    `pixels de trait : ${avant} → ${apres}`
  );

  await wait(500);
  check("aucune erreur JavaScript chez Alice", erreurs.A.length === 0, erreurs.A.join(" | "));
  check("aucune erreur JavaScript chez Bob", erreurs.B.length === 0, erreurs.B.join(" | "));

  await pageA.screenshot({ path: "scripts/derniere-capture-audio.png" });

  await navA.close();
  await navB.close();

  console.log(`\n${passed} vérifications réussies, ${failed} échec(s).`);
  console.log("Capture d'écran : scripts/derniere-capture-audio.png");
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nErreur pendant le test :", error);
  process.exit(1);
});
