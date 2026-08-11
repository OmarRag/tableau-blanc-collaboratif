// Tests de la géométrie du dessin (pas besoin de navigateur : ces fonctions
// sont du calcul pur). Lancer avec : npm test (dans le dossier client)
import test from "node:test";
import assert from "node:assert/strict";
import { hitTest, boundsOf, boundsOfMany, intersectsBox, distanceToSegment } from "../src/board/shapes.js";
import { createCamera, toWorld, toScreen, zoomAt, clampZoom } from "../src/board/camera.js";

test("distance d'un point à un segment", () => {
  assert.equal(distanceToSegment(0, 5, 0, 0, 10, 0), 5);
  assert.equal(distanceToSegment(5, 0, 0, 0, 10, 0), 0);
  // Au-delà de l'extrémité, on mesure jusqu'à l'extrémité, pas à la droite.
  assert.equal(distanceToSegment(20, 0, 0, 0, 10, 0), 10);
});

test("boîte englobante d'un rectangle dessiné « à l'envers »", () => {
  const box = boundsOf({ kind: "rect", x: 100, y: 100, w: -40, h: -20, strokeWidth: 2 });
  assert.equal(box.x, 59);
  assert.equal(box.y, 79);
  assert.equal(box.w, 42);
  assert.equal(box.h, 22);
});

test("clic sur un rectangle vide : le contour touche, l'intérieur non", () => {
  const rect = { kind: "rect", x: 0, y: 0, w: 100, h: 100, strokeWidth: 2 };
  assert.ok(hitTest(rect, 0, 50), "sur le bord gauche");
  assert.ok(!hitTest(rect, 50, 50), "au milieu, rectangle non rempli");
  assert.ok(!hitTest(rect, 200, 200), "loin de la forme");
});

test("clic sur un rectangle rempli : l'intérieur touche", () => {
  const rect = { kind: "rect", x: 0, y: 0, w: 100, h: 100, strokeWidth: 2, fill: "#f00" };
  assert.ok(hitTest(rect, 50, 50));
});

test("clic sur une ellipse", () => {
  const ellipse = { kind: "ellipse", x: 0, y: 0, w: 100, h: 100, strokeWidth: 2 };
  assert.ok(hitTest(ellipse, 50, 0), "sur le contour, en haut");
  assert.ok(!hitTest(ellipse, 50, 50), "au centre, ellipse non remplie");
});

test("clic sur un tracé à main levée", () => {
  const pen = { kind: "pen", x: 10, y: 10, strokeWidth: 3, points: [[0, 0], [50, 0], [50, 50]] };
  assert.ok(hitTest(pen, 35, 10), "sur le premier segment");
  assert.ok(hitTest(pen, 60, 40), "sur le second segment");
  assert.ok(!hitTest(pen, 20, 45), "dans le coin vide");
});

test("clic sur une flèche", () => {
  const arrow = { kind: "arrow", x: 0, y: 0, w: 100, h: 100, strokeWidth: 2 };
  assert.ok(hitTest(arrow, 50, 50), "sur la diagonale");
  assert.ok(!hitTest(arrow, 90, 10), "à côté de la diagonale");
});

test("sélection au lasso : intersection avec un rectangle", () => {
  const shape = { kind: "rect", x: 0, y: 0, w: 50, h: 50, strokeWidth: 2 };
  assert.ok(intersectsBox(shape, { x: -10, y: -10, w: 100, h: 100 }));
  assert.ok(intersectsBox(shape, { x: 40, y: 40, w: 100, h: 100 }), "chevauchement partiel");
  assert.ok(!intersectsBox(shape, { x: 200, y: 200, w: 10, h: 10 }));
});

test("boîte englobant plusieurs formes", () => {
  // La boîte inclut la demi-épaisseur du trait (1 px de chaque côté ici),
  // sinon l'export PNG couperait le contour des formes.
  const box = boundsOfMany([
    { kind: "rect", x: 0, y: 0, w: 10, h: 10, strokeWidth: 2 },
    { kind: "rect", x: 90, y: 40, w: 10, h: 10, strokeWidth: 2 },
  ]);
  assert.deepEqual(box, { x: -1, y: -1, w: 102, h: 52 });
});

test("caméra : monde ↔ écran font l'aller-retour", () => {
  const camera = createCamera();
  camera.x = 120;
  camera.y = -40;
  camera.zoom = 2.5;
  const screen = toScreen(camera, 17, 33);
  const world = toWorld(camera, screen.x, screen.y);
  assert.ok(Math.abs(world.x - 17) < 1e-9);
  assert.ok(Math.abs(world.y - 33) < 1e-9);
});

test("zoom à la souris : le point sous le curseur ne bouge pas", () => {
  const camera = createCamera();
  const avant = toWorld(camera, 300, 200);
  zoomAt(camera, 300, 200, 1.7);
  const apres = toWorld(camera, 300, 200);
  assert.ok(Math.abs(avant.x - apres.x) < 1e-9);
  assert.ok(Math.abs(avant.y - apres.y) < 1e-9);
});

test("le zoom reste dans des limites raisonnables", () => {
  assert.equal(clampZoom(1000), 8);
  assert.equal(clampZoom(0.0001), 0.05);
});
