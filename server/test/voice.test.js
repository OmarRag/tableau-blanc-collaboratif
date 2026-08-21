// Tests du contrôle des messages de « signalisation » du chat vocal.
//
// Rappel : le son ne passe jamais par le serveur. Celui-ci recopie seulement
// quelques petits messages d'un navigateur vers un autre. Comme il ne les
// comprend pas, il doit au minimum vérifier leur FORME — sinon on pourrait
// s'en servir pour faire transiter n'importe quoi entre deux visiteurs.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";

process.env.DB_FILE = path.join(os.tmpdir(), `whiteboard-voice-${process.pid}.db`);
process.env.SESSION_SECRET = "secret-de-test";
delete process.env.DATABASE_URL;

const { isValidSignal } = await import("../src/realtime.js");

const valide = { to: "socket-abc", kind: "offer", data: { type: "offer", sdp: "v=0..." } };

test("un message de signalisation correct est accepté", () => {
  assert.equal(isValidSignal(valide), true);
  assert.equal(isValidSignal({ ...valide, kind: "answer" }), true);
  assert.equal(isValidSignal({ ...valide, kind: "ice", data: { candidate: "..." } }), true);
});

test("un type de message inconnu est refusé", () => {
  assert.equal(isValidSignal({ ...valide, kind: "autre-chose" }), false);
  assert.equal(isValidSignal({ ...valide, kind: "" }), false);
});

test("un message sans destinataire est refusé", () => {
  assert.equal(isValidSignal({ ...valide, to: undefined }), false);
  assert.equal(isValidSignal({ ...valide, to: "" }), false);
  assert.equal(isValidSignal({ ...valide, to: 42 }), false);
});

test("un destinataire trop long est refusé", () => {
  assert.equal(isValidSignal({ ...valide, to: "x".repeat(65) }), false);
});

test("un contenu qui n'est pas un objet est refusé", () => {
  assert.equal(isValidSignal({ ...valide, data: "du texte" }), false);
  assert.equal(isValidSignal({ ...valide, data: null }), false);
  assert.equal(isValidSignal({ ...valide, data: undefined }), false);
});

test("un contenu énorme est refusé (le canal n'est pas un tuyau à données)", () => {
  assert.equal(isValidSignal({ ...valide, data: { sdp: "x".repeat(20_001) } }), false);
});

test("n'importe quoi à la place du message est refusé", () => {
  for (const valeur of [null, undefined, "texte", 42, []]) {
    assert.equal(isValidSignal(valeur), false, `refusé : ${JSON.stringify(valeur)}`);
  }
});
