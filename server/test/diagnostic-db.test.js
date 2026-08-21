// Tests du diagnostic affiché quand la base de données est injoignable.
//
// Pourquoi ces tests : un déploiement qui échoue n'affiche qu'« exited with
// status 1 » et une pile d'appels. Ces deux fonctions transforment l'erreur
// brute en une phrase qui dit quoi corriger — et masquent le mot de passe
// pour qu'il ne se retrouve pas dans le journal de l'hébergeur.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";

process.env.DB_FILE = path.join(os.tmpdir(), `whiteboard-diag-${process.pid}.db`);
process.env.SESSION_SECRET = "secret-de-test";
delete process.env.DATABASE_URL; // on force SQLite : aucune connexion réseau

const { expliquerErreurPostgres, urlSansMotDePasse } = await import("../src/db.js");

test("un mot de passe refusé est expliqué en clair", () => {
  const message = expliquerErreurPostgres({ code: "28P01", message: "password auth failed" });
  assert.match(message, /mot de passe/i);
  assert.match(message, /DATABASE_URL/);
});

test("une base inexistante est expliquée en clair", () => {
  assert.match(expliquerErreurPostgres({ code: "3D000" }), /n'existe pas/);
});

test("une adresse introuvable est expliquée en clair", () => {
  assert.match(expliquerErreurPostgres({ code: "ENOTFOUND" }), /introuvable/);
});

test("une erreur inconnue retombe sur son propre message", () => {
  assert.equal(
    expliquerErreurPostgres({ code: "XX999", message: "boum" }),
    "boum"
  );
});

test("une erreur sans code ni message reste lisible", () => {
  assert.equal(expliquerErreurPostgres(undefined), "cause inconnue.");
});

test("le mot de passe est masqué avant d'écrire l'URL dans le journal", () => {
  const url = urlSansMotDePasse(
    "postgresql://utilisateur:motdepasse-secret@hote.neon.tech/tableau_blanc?sslmode=require"
  );
  assert.ok(!url.includes("motdepasse-secret"), "le mot de passe ne doit pas apparaître");
  assert.match(url, /utilisateur/);   // l'utilisateur reste lisible
  assert.match(url, /hote\.neon\.tech/); // l'hôte aussi : c'est ce qu'on veut vérifier
  assert.match(url, /tableau_blanc/);    // et le nom de la base
});

test("une URL illisible ne fait pas planter le diagnostic", () => {
  assert.equal(urlSansMotDePasse("n'importe quoi"), "(DATABASE_URL illisible)");
});
