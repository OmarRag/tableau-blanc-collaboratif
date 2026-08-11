// Test dans un VRAI navigateur (Chromium, piloté par Playwright).
//
// Contrairement au DOM simulé, un vrai navigateur applique la vraie cascade
// CSS, la superposition des éléments (z-index) et le vrai routage des clics.
// C'est le seul moyen de détecter qu'une fenêtre invisible recouvre le canvas
// et avale tous les clics.
//
// Prérequis : le serveur ET le client doivent tourner (npm run dev).
// Lancer avec : npm run browser
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

async function main() {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 800 } });

  // On écoute tout ce que la console du navigateur raconte.
  const erreursConsole = [];
  page.on("console", (message) => {
    if (message.type() === "error") erreursConsole.push(message.text());
  });
  page.on("pageerror", (error) => erreursConsole.push(`ERREUR JS : ${error.message}`));

  // --- Inscription -------------------------------------------------------
  section("1. Inscription");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-mode="register"]');
  await page.fill('input[name="name"]', "Testeur Chromium");
  await page.fill('input[name="email"]', `chromium-${suffix}@test.fr`);
  await page.fill('input[name="password"]', "motdepasse123");
  await page.click('#auth-form button[type="submit"]');
  await page.waitForSelector("#new-board");
  check("le compte est créé et « Mes boards » s'affiche", true);

  // --- Création d'un board ----------------------------------------------
  section("2. Création d'un board");
  page.on("dialog", (dialog) => dialog.accept("Board Chromium"));
  await Promise.all([page.waitForURL(/\/b\//), page.click("#new-board")]);
  const boardId = page.url().split("/b/")[1].split("?")[0];
  await page.waitForSelector("#board");
  await page.waitForFunction(() => document.getElementById("connection")?.textContent.includes("en ligne"));
  check("le board s'ouvre et la connexion temps réel est établie", true);

  // --- Diagnostic : qu'y a-t-il sous la souris ? -------------------------
  section("3. Diagnostic : le canvas reçoit-il vraiment les clics ?");
  const sousLaSouris = await page.evaluate(() => {
    const cible = document.elementFromPoint(640, 400);
    const gene = [];
    for (const node of document.querySelectorAll("body > *")) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const boite = node.getBoundingClientRect();
      const couvre =
        boite.left <= 640 && boite.right >= 640 && boite.top <= 400 && boite.bottom >= 400;
      if (couvre && node.id !== "board") {
        gene.push(`${node.id || node.tagName} (display:${style.display}, z-index:${style.zIndex})`);
      }
    }
    return { cible: cible?.id || cible?.tagName, gene };
  });
  check(
    "au milieu de l'écran, c'est bien le canvas qui est au-dessus",
    sousLaSouris.cible === "board",
    `c'est « ${sousLaSouris.cible} » qui reçoit le clic ; éléments qui recouvrent : ${
      sousLaSouris.gene.join(", ") || "aucun"
    }`
  );

  // --- Dessin ------------------------------------------------------------
  section("4. Dessin avec chaque outil");

  const formesDuServeur = async () => {
    const donnees = await page.evaluate(
      async (id) => (await fetch(`/api/boards/${id}/export`, { credentials: "include" })).json(),
      boardId
    );
    return donnees.shapes;
  };

  const glisser = async (x1, y1, x2, y2) => {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    // Plusieurs étapes : un vrai tracé à main levée a besoin de mouvements
    // intermédiaires.
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(x1 + ((x2 - x1) * i) / 8, y1 + ((y2 - y1) * i) / 8);
      await page.waitForTimeout(12);
    }
    await page.mouse.up();
    await page.waitForTimeout(350);
  };

  const outils = [
    { tool: "rect", kind: "rect", nom: "rectangle", zone: [400, 250, 560, 350] },
    { tool: "ellipse", kind: "ellipse", nom: "ellipse", zone: [600, 250, 740, 350] },
    { tool: "arrow", kind: "arrow", nom: "flèche", zone: [780, 250, 900, 350] },
    { tool: "pen", kind: "pen", nom: "main levée", zone: [400, 420, 560, 520] },
  ];

  for (const outil of outils) {
    await page.click(`#toolbar [data-tool="${outil.tool}"]`);
    const actif = await page.getAttribute(`#toolbar [data-tool="${outil.tool}"]`, "class");
    await glisser(...outil.zone);
    const formes = await formesDuServeur();
    check(
      `outil « ${outil.nom} » : la forme est créée`,
      formes.some((f) => f.kind === outil.kind),
      `outil actif = ${actif}, formes en base = ${formes.map((f) => f.kind).join(",") || "aucune"}`
    );
  }

  // Texte : clic puis saisie.
  await page.click('#toolbar [data-tool="text"]');
  await page.mouse.click(640, 600);
  await page.waitForTimeout(200);
  await page.keyboard.type("Bonjour");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  let formes = await formesDuServeur();
  check(
    "outil « texte » : le texte est créé",
    formes.some((f) => f.kind === "text" && f.text === "Bonjour"),
    `formes = ${formes.map((f) => f.kind).join(",")}`
  );

  // Gomme.
  await page.click('#toolbar [data-tool="eraser"]');
  await page.mouse.click(400, 250);
  await page.waitForTimeout(400);
  const apresGomme = await formesDuServeur();
  check(
    "outil « gomme » : la forme cliquée disparaît",
    apresGomme.length === formes.length - 1,
    `avant ${formes.length}, après ${apresGomme.length}`
  );

  // Sélection + déplacement. On attrape l'ellipse par son bord GAUCHE
  // (600, 300) et non par le coin de sa boîte : le coin d'une boîte n'est pas
  // sur le tracé d'une ellipse, donc le clic n'y toucherait rien.
  await page.click('#toolbar [data-tool="select"]');
  const avantDeplacement = (await formesDuServeur()).find((f) => f.kind === "ellipse");
  await glisser(600, 300, 640, 340);
  const apresDeplacement = (await formesDuServeur()).find((f) => f.id === avantDeplacement?.id);
  check(
    "outil « sélection » : la forme se déplace",
    apresDeplacement && Math.round(apresDeplacement.x - avantDeplacement.x) !== 0,
    `x avant ${avantDeplacement?.x}, x après ${apresDeplacement?.x}`
  );

  // Undo.
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(400);
  const apresUndo = (await formesDuServeur()).find((f) => f.id === avantDeplacement?.id);
  check("Ctrl+Z annule le déplacement", apresUndo && apresUndo.x === avantDeplacement.x);

  // --- Fenêtre de partage -------------------------------------------------
  section("5. Fenêtre « Partager »");
  const modaleVisible = () =>
    page.evaluate(() => {
      const node = document.getElementById("share-modal");
      return getComputedStyle(node).display !== "none";
    });
  const menuVisible = () =>
    page.evaluate(() => {
      const node = document.getElementById("export-menu");
      return getComputedStyle(node).display !== "none";
    });

  check("au chargement, la fenêtre de partage est invisible", !(await modaleVisible()));
  check("au chargement, le menu Exporter est invisible", !(await menuVisible()));

  await page.click("#btn-share");
  await page.waitForTimeout(300);
  check("le bouton « Partager » ouvre la fenêtre", await modaleVisible());

  await page.click("#share-close");
  await page.waitForTimeout(200);
  check("le bouton « Fermer » referme la fenêtre", !(await modaleVisible()));

  await page.click("#btn-share");
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check("la touche Échap referme la fenêtre", !(await modaleVisible()));

  await page.click("#btn-share");
  await page.waitForTimeout(300);
  await page.click("#share-modal .modal-box h2");
  await page.waitForTimeout(150);
  check("cliquer À L'INTÉRIEUR ne referme pas la fenêtre", await modaleVisible());
  await page.mouse.click(40, 760); // coin bas-gauche : le fond grisé
  await page.waitForTimeout(200);
  check("cliquer en dehors referme la fenêtre", !(await modaleVisible()));

  // --- Menu Exporter ------------------------------------------------------
  section("6. Menu « Exporter »");
  await page.click("#btn-export");
  await page.waitForTimeout(200);
  check("le bouton « Exporter » ouvre le menu", await menuVisible());
  await page.mouse.click(200, 700);
  await page.waitForTimeout(200);
  check("un clic ailleurs referme le menu", !(await menuVisible()));

  await page.click("#btn-export");
  await page.waitForTimeout(200);
  await page.click("#btn-share");
  await page.waitForTimeout(300);
  check("ouvrir « Partager » referme le menu Exporter", !(await menuVisible()));
  await page.keyboard.press("Escape");

  // --- Console du navigateur ---------------------------------------------
  section("7. Console du navigateur");
  check(
    "aucune erreur JavaScript dans la console",
    erreursConsole.length === 0,
    erreursConsole.slice(0, 5).join(" | ")
  );

  await page.screenshot({ path: "scripts/derniere-capture.png" });
  await navigateur.close();

  console.log(`\n${passed} vérifications réussies, ${failed} échec(s).`);
  console.log("Capture d'écran : scripts/derniere-capture.png");
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nErreur pendant le test :", error);
  process.exit(1);
});
