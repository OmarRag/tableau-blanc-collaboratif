// Vérifie que le serveur fonctionne aussi avec PostgreSQL.
//
// Pourquoi ce test existe : en local le projet tourne sur SQLite, mais une
// fois en ligne il tournera sur PostgreSQL. Les deux moteurs ne parlent pas
// exactement le même SQL. Sans ce test, on ne découvrirait les différences
// qu'après le déploiement, sur le site en production.
//
// Ce script démarre un VRAI PostgreSQL, en local, dans un dossier temporaire
// (paquet « embedded-postgres » : il télécharge les binaires officiels).
// Rien n'est installé sur la machine, rien n'est payant, et tout est supprimé
// à la fin.
//
// Lancer avec : npm run test:pg
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = path.join(os.tmpdir(), `whiteboard-pg-${process.pid}`);
const port = 55432;

let passed = 0;
let failed = 0;
const check = (label, ok, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "✔" : "✖"} ${label}${ok || !detail ? "" : ` → ${detail}`}`);
};

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: false,
});

async function main() {
  console.log("Démarrage d'un PostgreSQL temporaire (première fois : téléchargement)…");
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("whiteboard_test");
  console.log("PostgreSQL prêt.\n");

  process.env.DATABASE_URL = `postgres://postgres:postgres@localhost:${port}/whiteboard_test`;
  process.env.SESSION_SECRET = "secret-de-test";

  // Import APRÈS avoir posé DATABASE_URL : c'est elle qui choisit le moteur.
  const db = await import("../server/src/db.js");
  const auth = await import("../server/src/auth.js");
  const boards = await import("../server/src/boards.js");
  const permissions = await import("../server/src/permissions.js");
  const { shouldApply } = await import("../shared/merge.js");

  check("le moteur choisi est bien PostgreSQL", db.dialect === "postgres", db.dialect);

  await db.initDb();
  check("les tables se créent sans erreur", true);

  // --- Comptes -----------------------------------------------------------
  const proprio = await auth.createUser({
    email: "pg-proprio@test.fr",
    password: "motdepasse123",
    name: "Proprio PG",
  });
  check("un compte se crée", proprio?.id?.length > 0);
  const relu = await auth.getUserByEmail("PG-Proprio@Test.fr");
  check("l'email est retrouvé sans tenir compte de la casse", relu?.id === proprio.id);

  const token = await auth.createSession(proprio.id);
  check("une session se crée", typeof token === "string" && token.length > 0);

  // --- Boards ------------------------------------------------------------
  const board = await boards.createBoard({ title: "Board PG", ownerId: proprio.id });
  check("un board se crée", board?.id?.length > 0);
  check(
    "la date est bien un nombre (et non du texte)",
    typeof board.created_at === "number" && board.created_at > 1_600_000_000_000,
    `type ${typeof board.created_at}, valeur ${board.created_at}`
  );

  const ami = await auth.createUser({ email: "pg-ami@test.fr", password: "motdepasse123", name: "Ami PG" });
  await boards.setMember(board.id, ami.id, "edit");
  await boards.setMember(board.id, ami.id, "view"); // deuxième fois = mise à jour
  const membres = await boards.listMembers(board.id);
  check(
    "l'invitation deux fois de suite met à jour le rôle (ON CONFLICT)",
    membres.length === 1 && membres[0].role === "view",
    JSON.stringify(membres)
  );

  check("le propriétaire a le rôle owner", (await permissions.roleFor(await permissions.getBoard(board.id), proprio)) === "owner");
  check("l'invité a le rôle view", (await permissions.roleFor(await permissions.getBoard(board.id), ami)) === "view");

  const liste = await boards.listBoardsFor(proprio.id);
  check("le board apparaît dans « mes boards »", liste.owned.length === 1);

  // --- Formes et règle de fusion ----------------------------------------
  const forme = { kind: "rect", x: 0, y: 0, w: 10, h: 10, stroke: "#000" };
  check(
    "une forme s'enregistre",
    (await boards.applyShapeOp(board.id, { id: "s1", type: "upsert", clock: 5, actor: "zoe", shape: forme })) === true
  );
  check(
    "une opération en retard est refusée",
    (await boards.applyShapeOp(board.id, { id: "s1", type: "upsert", clock: 3, actor: "alex", shape: { ...forme, w: 99 } })) === false
  );
  const formes = await boards.loadShapes(board.id);
  check("la forme conserve la bonne version", formes[0]?.w === 10, JSON.stringify(formes));
  check("l'horloge maximale est un nombre", (await boards.maxClock(board.id)) === 5);

  check(
    "la suppression fonctionne (pierre tombale)",
    (await boards.applyShapeOp(board.id, { id: "s1", type: "delete", clock: 9, actor: "alex" })) === true &&
      (await boards.loadShapes(board.id)).length === 0
  );

  // Même vérification d'équivalence que côté SQLite.
  const cas = [
    { existante: { clock: 5, actor: "bob" }, recue: { clock: 6, actor: "alice" } },
    { existante: { clock: 5, actor: "bob" }, recue: { clock: 4, actor: "zoe" } },
    { existante: { clock: 5, actor: "bob" }, recue: { clock: 5, actor: "zoe" } },
    { existante: { clock: 5, actor: "bob" }, recue: { clock: 5, actor: "alice" } },
    { existante: { clock: 5, actor: "bob" }, recue: { clock: 5, actor: "bob" } },
  ];
  let equivalent = true;
  for (const [index, { existante, recue }] of cas.entries()) {
    const id = `equiv-${index}`;
    await boards.applyShapeOp(board.id, { id, type: "upsert", shape: forme, ...existante });
    const sql = await boards.applyShapeOp(board.id, { id, type: "upsert", shape: forme, ...recue });
    if (sql !== shouldApply(recue, existante)) equivalent = false;
  }
  check("la règle SQL PostgreSQL est identique à la règle JavaScript", equivalent);

  // --- Suppression en cascade -------------------------------------------
  await boards.deleteBoard(board.id);
  check("supprimer un board supprime ses formes (cascade)", (await boards.loadShapes(board.id)).length === 0);
  check("le board a bien disparu", (await permissions.getBoard(board.id)) === undefined);

  await db.closeDb();
  console.log(`\n${passed} vérifications réussies, ${failed} échec(s).`);
}

try {
  await main();
} catch (error) {
  console.error("\nErreur pendant le test PostgreSQL :", error);
  failed++;
} finally {
  try { await pg.stop(); } catch { /* déjà arrêté */ }
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* rien à nettoyer */ }
}

process.exit(failed === 0 ? 0 : 1);
