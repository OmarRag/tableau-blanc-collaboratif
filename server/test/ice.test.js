// Tests de la liste des serveurs de mise en relation du chat vocal (« ICE »).
//
// Deux comportements comptent ici :
//   1. sans variable TURN, on garde exactement le comportement d'avant
//      (STUN seul) — le chat vocal ne doit pas se mettre à échouer ;
//   2. avec les variables TURN, elles se retrouvent bien dans la liste, au
//      format attendu par le navigateur.
//
// La configuration étant lue une seule fois au chargement du module, chaque
// cas est joué dans un processus Node séparé.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

/** Lance iceServers() dans un processus neuf, avec l'environnement demandé. */
function iceServersAvec(env) {
  const code =
    'import("./server/src/config.js").then(m => ' +
    "console.log(JSON.stringify(m.iceServers())))";
  const sortie = execFileSync(process.execPath, ["-e", code], {
    encoding: "utf8",
    env: {
      ...process.env,
      DB_FILE: path.join(os.tmpdir(), `whiteboard-ice-${process.pid}.db`),
      SESSION_SECRET: "secret-de-test",
      DATABASE_URL: "",
      TURN_URLS: "",
      TURN_USERNAME: "",
      TURN_CREDENTIAL: "",
      STUN_URLS: "",
      ...env,
    },
    cwd: path.resolve(import.meta.dirname, "../.."),
  });
  return JSON.parse(sortie.trim().split("\n").pop());
}

test("sans TURN : on garde STUN seul, comme avant", () => {
  const serveurs = iceServersAvec({});
  assert.equal(serveurs.length, 1, "un seul groupe de serveurs");
  assert.ok(serveurs[0].urls.every((u) => u.startsWith("stun:")), "que du STUN");
  assert.equal(serveurs[0].username, undefined, "aucun identifiant à transmettre");
});

test("avec TURN : le relais est ajouté après le STUN", () => {
  const serveurs = iceServersAvec({
    TURN_URLS: "turn:exemple.com:3478",
    TURN_USERNAME: "utilisateur",
    TURN_CREDENTIAL: "motdepasse",
  });
  assert.equal(serveurs.length, 2);
  // L'ordre compte : la connexion directe est tentée en premier.
  assert.ok(serveurs[0].urls[0].startsWith("stun:"));
  assert.deepEqual(serveurs[1], {
    urls: ["turn:exemple.com:3478"],
    username: "utilisateur",
    credential: "motdepasse",
  });
});

test("plusieurs adresses TURN séparées par des virgules", () => {
  const serveurs = iceServersAvec({
    TURN_URLS: "turn:exemple.com:3478, turns:exemple.com:5349 ,turn:exemple.com:80",
    TURN_USERNAME: "u",
    TURN_CREDENTIAL: "p",
  });
  assert.deepEqual(serveurs[1].urls, [
    "turn:exemple.com:3478",
    "turns:exemple.com:5349",
    "turn:exemple.com:80",
  ]);
});

test("une variable TURN vide ou pleine d'espaces est ignorée", () => {
  assert.equal(iceServersAvec({ TURN_URLS: "   " }).length, 1);
  assert.equal(iceServersAvec({ TURN_URLS: " , , " }).length, 1);
});

test("les serveurs STUN peuvent être remplacés par variable d'environnement", () => {
  const serveurs = iceServersAvec({ STUN_URLS: "stun:chez-moi.fr:3478" });
  assert.deepEqual(serveurs[0].urls, ["stun:chez-moi.fr:3478"]);
});
