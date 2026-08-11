// Dessin de la scène complète, 60 fois par seconde au maximum.
import { drawShape, boundsOfMany } from "./shapes.js";
import { toScreen } from "./camera.js";

export function createRenderer(canvas, camera) {
  const ctx = canvas.getContext("2d");
  let needsRedraw = true;
  let scene = { shapes: [], selection: new Set(), preview: null, marquee: null, peers: [] };

  function resize() {
    // devicePixelRatio : sur un écran « Retina » / haute densité, un pixel CSS
    // vaut plusieurs pixels réels. Sans cela le dessin est flou.
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * ratio);
    canvas.height = Math.floor(canvas.clientHeight * ratio);
    needsRedraw = true;
  }

  function invalidate() {
    needsRedraw = true;
  }

  function setScene(next) {
    scene = { ...scene, ...next };
    needsRedraw = true;
  }

  function frame() {
    if (needsRedraw) {
      needsRedraw = false;
      draw();
    }
    requestAnimationFrame(frame);
  }

  function draw() {
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    drawGrid(ctx, camera, canvas.clientWidth, canvas.clientHeight);

    // On passe en coordonnées MONDE : tout le reste se dessine avec les
    // coordonnées réelles des formes, la caméra fait la conversion.
    ctx.setTransform(
      ratio * camera.zoom, 0, 0, ratio * camera.zoom,
      ratio * camera.x, ratio * camera.y
    );

    for (const shape of scene.shapes) drawShape(ctx, shape);
    if (scene.preview) drawShape(ctx, scene.preview);

    drawSelection(ctx, scene, camera);

    // Retour en coordonnées ÉCRAN pour les éléments d'interface.
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (scene.marquee) drawMarquee(ctx, scene.marquee, camera);
    drawPeers(ctx, scene.peers, camera);
  }

  resize();
  requestAnimationFrame(frame);
  window.addEventListener("resize", resize);

  return { ctx, resize, invalidate, setScene };
}

function drawGrid(ctx, camera, width, height) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Espacement des points : on double/divise pour garder un quadrillage
  // lisible quel que soit le zoom.
  let step = 40 * camera.zoom;
  while (step < 16) step *= 2;
  while (step > 96) step /= 2;
  if (step < 8) return;

  const startX = ((camera.x % step) + step) % step;
  const startY = ((camera.y % step) + step) % step;

  ctx.fillStyle = "#dfe3e8";
  for (let x = startX; x < width; x += step) {
    for (let y = startY; y < height; y += step) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawSelection(ctx, scene, camera) {
  if (!scene.selection.size) return;
  const selected = scene.shapes.filter((shape) => scene.selection.has(shape.id));
  const box = boundsOfMany(selected, ctx);
  if (!box) return;

  ctx.save();
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 1 / camera.zoom;
  ctx.setLineDash([6 / camera.zoom, 4 / camera.zoom]);
  const pad = 4 / camera.zoom;
  ctx.strokeRect(box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2);
  ctx.restore();
}

function drawMarquee(ctx, marquee, camera) {
  const a = toScreen(camera, marquee.x1, marquee.y1);
  const b = toScreen(camera, marquee.x2, marquee.y2);
  ctx.save();
  ctx.fillStyle = "rgba(37, 99, 235, 0.08)";
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawPeers(ctx, peers, camera) {
  ctx.save();
  ctx.font = "12px system-ui, sans-serif";
  ctx.textBaseline = "top";
  for (const peer of peers) {
    if (typeof peer.x !== "number") continue;
    const point = toScreen(camera, peer.x, peer.y);

    // Petite flèche de curseur
    ctx.fillStyle = peer.color;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x, point.y + 16);
    ctx.lineTo(point.x + 4.5, point.y + 12);
    ctx.lineTo(point.x + 11, point.y + 11.5);
    ctx.closePath();
    ctx.fill();

    // Étiquette avec le pseudo
    const label = peer.name || "invité";
    const width = ctx.measureText(label).width + 10;
    ctx.fillStyle = peer.color;
    roundRect(ctx, point.x + 12, point.y + 14, width, 18, 5);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(label, point.x + 17, point.y + 17);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
