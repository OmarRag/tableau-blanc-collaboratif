// Tests de la règle de fusion des modifications concurrentes.
// Lancer avec : npm test (dans le dossier server)
import test from "node:test";
import assert from "node:assert/strict";
import { compareOps, shouldApply, tickClock, observeClock } from "../../shared/merge.js";

test("l'opération avec l'horloge la plus grande gagne", () => {
  const ancienne = { clock: 3, actor: "zoe" };
  const nouvelle = { clock: 4, actor: "alex" };
  assert.ok(compareOps(nouvelle, ancienne) > 0);
  assert.ok(shouldApply(nouvelle, ancienne));
  assert.ok(!shouldApply(ancienne, nouvelle));
});

test("à horloge égale, on départage par l'auteur, de façon stable", () => {
  const a = { clock: 5, actor: "alex" };
  const b = { clock: 5, actor: "zoe" };
  assert.ok(compareOps(b, a) > 0, "zoe > alex");
  // La règle doit donner le même résultat quel que soit l'ordre d'arrivée :
  // c'est ce qui garantit que tous les navigateurs convergent.
  assert.equal(shouldApply(b, a), true);
  assert.equal(shouldApply(a, b), false);
});

test("une opération identique à elle-même n'est pas réappliquée", () => {
  const op = { clock: 7, actor: "alex" };
  assert.equal(compareOps(op, { ...op }), 0);
  assert.equal(shouldApply(op, { ...op }), false);
});

test("une forme inconnue est toujours acceptée", () => {
  assert.ok(shouldApply({ clock: 1, actor: "alex" }, undefined));
});

test("l'horloge de Lamport avance au-delà de ce qui a été vu", () => {
  assert.equal(tickClock(2), 3);
  assert.equal(tickClock(2, 9), 10);
  assert.equal(observeClock(2, 9), 9);
  assert.equal(observeClock(9, 2), 9);
});

test("convergence : deux ordres d'arrivée différents donnent le même état", () => {
  const opA = { id: "s1", clock: 4, actor: "alex", value: "A" };
  const opB = { id: "s1", clock: 4, actor: "zoe", value: "B" };

  const appliquer = (ops) => {
    let etat;
    for (const op of ops) if (shouldApply(op, etat)) etat = op;
    return etat;
  };

  assert.equal(appliquer([opA, opB]).value, appliquer([opB, opA]).value);
  assert.equal(appliquer([opA, opB]).value, "B");
});
