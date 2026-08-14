// Tests des droits d'accès, des mots de passe et de l'application des
// opérations en base. On travaille sur une base SQLite temporaire, jamais sur
// la vraie : les tests ne doivent rien casser.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { shouldApply } from "../../shared/merge.js";

const tempDb = path.join(os.tmpdir(), `whiteboard-test-${process.pid}.db`);
process.env.DB_FILE = tempDb;
process.env.SESSION_SECRET = "secret-de-test";
delete process.env.DATABASE_URL; // on force SQLite, même si la variable traîne

// Import dynamique : la configuration doit être lue APRÈS avoir fixé DB_FILE.
let auth, boards, permissions, realtime, db;

before(async () => {
  db = await import("../src/db.js");
  await db.initDb();
  auth = await import("../src/auth.js");
  boards = await import("../src/boards.js");
  permissions = await import("../src/permissions.js");
  realtime = await import("../src/realtime.js");
});

after(async () => {
  await db.closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.unlinkSync(tempDb + suffix); } catch { /* déjà supprimé */ }
  }
});

test("un mot de passe est vérifiable mais jamais stocké en clair", () => {
  const stored = auth.hashPassword("motdepasse123");
  assert.ok(!stored.includes("motdepasse123"));
  assert.ok(auth.verifyPassword("motdepasse123", stored));
  assert.ok(!auth.verifyPassword("motdepasse124", stored));
});

test("deux comptes avec le même mot de passe ont deux empreintes différentes", () => {
  assert.notEqual(auth.hashPassword("identique"), auth.hashPassword("identique"));
});

test("droits sur un board privé, public, partagé et invité", async () => {
  const proprio = await auth.createUser({ email: "proprio@test.fr", password: "motdepasse", name: "Proprio" });
  const ami = await auth.createUser({ email: "ami@test.fr", password: "motdepasse", name: "Ami" });
  const inconnu = await auth.createUser({ email: "inconnu@test.fr", password: "motdepasse", name: "Inconnu" });

  const board = await boards.createBoard({ title: "Essai", ownerId: proprio.id });
  const stored = await permissions.getBoard(board.id);

  // Privé : seul le propriétaire entre.
  assert.equal(await permissions.roleFor(stored, proprio), "owner");
  assert.equal(await permissions.roleFor(stored, inconnu), null);
  assert.equal(await permissions.roleFor(stored, null), null);

  // Invitation par email en écriture.
  await boards.setMember(board.id, ami.id, "edit");
  assert.equal(await permissions.roleFor(await permissions.getBoard(board.id), ami), "edit");

  // Lien de partage en lecture : le bon jeton donne accès, un faux non.
  assert.equal(await permissions.roleFor(stored, inconnu, stored.share_token), "view");
  assert.equal(await permissions.roleFor(stored, inconnu, "mauvais-jeton"), null);

  // Board public : tout le monde peut regarder, même sans compte.
  await boards.updateBoard(board.id, { isPublic: true });
  assert.equal(await permissions.roleFor(await permissions.getBoard(board.id), null), "view");

  // …mais regarder n'est pas dessiner.
  assert.ok(!permissions.canEdit("view"));
  assert.ok(permissions.canEdit("edit"));
  assert.ok(permissions.canEdit("owner"));
  assert.ok(!permissions.canAdmin("edit"));
});

test("le rôle le plus fort l'emporte quand plusieurs accès se cumulent", async () => {
  const proprio = await auth.createUser({ email: "p2@test.fr", password: "motdepasse", name: "P2" });
  const ami = await auth.createUser({ email: "a2@test.fr", password: "motdepasse", name: "A2" });
  const board = await boards.createBoard({ title: "Cumul", ownerId: proprio.id });
  await boards.updateBoard(board.id, { isPublic: true }); // donne "view" à tous
  await boards.setMember(board.id, ami.id, "edit"); // mais lui est invité en écriture
  assert.equal(await permissions.roleFor(await permissions.getBoard(board.id), ami), "edit");
});

test("une opération plus ancienne n'écrase pas une plus récente en base", async () => {
  const proprio = await auth.createUser({ email: "p3@test.fr", password: "motdepasse", name: "P3" });
  const board = await boards.createBoard({ title: "Fusion", ownerId: proprio.id });
  const forme = { kind: "rect", x: 0, y: 0, w: 10, h: 10, stroke: "#000" };

  assert.equal(await boards.applyShapeOp(board.id, { id: "s1", type: "upsert", clock: 5, actor: "zoe", shape: forme }), true);
  // Opération en retard : refusée.
  assert.equal(await boards.applyShapeOp(board.id, { id: "s1", type: "upsert", clock: 3, actor: "alex", shape: { ...forme, w: 99 } }), false);
  assert.equal((await boards.loadShapes(board.id))[0].w, 10);

  // Opération plus récente : acceptée.
  assert.equal(await boards.applyShapeOp(board.id, { id: "s1", type: "upsert", clock: 6, actor: "alex", shape: { ...forme, w: 42 } }), true);
  assert.equal((await boards.loadShapes(board.id))[0].w, 42);

  // Suppression : la forme disparaît de la liste mais reste connue en base
  // (« pierre tombale »), sinon une opération en retard la ferait réapparaître.
  assert.equal(await boards.applyShapeOp(board.id, { id: "s1", type: "delete", clock: 7, actor: "alex" }), true);
  assert.equal((await boards.loadShapes(board.id)).length, 0);
  assert.equal(await boards.applyShapeOp(board.id, { id: "s1", type: "upsert", clock: 6, actor: "zoe", shape: forme }), false);
  assert.equal((await boards.loadShapes(board.id)).length, 0);
});

// La règle de fusion existe à deux endroits : en JavaScript dans
// shared/merge.js (utilisée par le navigateur) et en SQL dans applyShapeOp
// (pour être atomique côté serveur). Ce test garantit qu'elles ne divergent
// jamais : si quelqu'un modifie l'une sans l'autre, il devient rouge.
test("la règle SQL et la règle JavaScript donnent le même résultat", async () => {
  const proprio = await auth.createUser({ email: "p5@test.fr", password: "motdepasse", name: "P5" });
  const board = await boards.createBoard({ title: "Équivalence", ownerId: proprio.id });
  const forme = { kind: "rect", x: 0, y: 0, w: 1, h: 1 };

  const cas = [
    { existante: { clock: 5, actor: "bob" }, recue: { clock: 6, actor: "alice" } }, // horloge plus grande
    { existante: { clock: 5, actor: "bob" }, recue: { clock: 4, actor: "zoe" } },   // horloge plus petite
    { existante: { clock: 5, actor: "bob" }, recue: { clock: 5, actor: "zoe" } },   // égalité, auteur plus grand
    { existante: { clock: 5, actor: "bob" }, recue: { clock: 5, actor: "alice" } }, // égalité, auteur plus petit
    { existante: { clock: 5, actor: "bob" }, recue: { clock: 5, actor: "bob" } },   // strictement identique
  ];

  for (const [index, { existante, recue }] of cas.entries()) {
    const id = `equiv-${index}`;
    await boards.applyShapeOp(board.id, { id, type: "upsert", shape: forme, ...existante });
    const resultatSql = await boards.applyShapeOp(board.id, { id, type: "upsert", shape: forme, ...recue });
    const resultatJs = shouldApply(recue, existante);
    assert.equal(
      resultatSql,
      resultatJs,
      `cas ${index} : SQL dit ${resultatSql}, JavaScript dit ${resultatJs}`
    );
  }
});

test("le serveur refuse les opérations mal formées", () => {
  const valide = { id: "abc", type: "upsert", clock: 1, shape: { kind: "rect", x: 0, y: 0, w: 5, h: 5 } };
  assert.ok(realtime.isValidOp(valide));
  assert.ok(realtime.isValidOp({ id: "abc", type: "delete", clock: 2 }));

  assert.ok(!realtime.isValidOp(null));
  assert.ok(!realtime.isValidOp({ ...valide, id: "" }));
  assert.ok(!realtime.isValidOp({ ...valide, clock: -1 }));
  assert.ok(!realtime.isValidOp({ ...valide, clock: "beaucoup" }));
  assert.ok(!realtime.isValidOp({ ...valide, shape: { kind: "virus", x: 0, y: 0 } }));
  assert.ok(!realtime.isValidOp({ ...valide, shape: { kind: "pen", points: new Array(30000).fill([0, 0]) } }));
});

test("le lien de partage régénéré invalide l'ancien", async () => {
  const proprio = await auth.createUser({ email: "p4@test.fr", password: "motdepasse", name: "P4" });
  const board = await boards.createBoard({ title: "Rotation", ownerId: proprio.id });
  const ancien = board.share_token;
  const nouveau = await boards.rotateShareToken(board.id);
  const relu = await permissions.getBoard(board.id);

  assert.notEqual(ancien, nouveau);
  assert.equal(await permissions.roleFor(relu, null, ancien), null);
  assert.equal(await permissions.roleFor(relu, null, nouveau), "view");
});
