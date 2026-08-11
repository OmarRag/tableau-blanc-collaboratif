// Export du dessin : image PNG et fichier JSON.
import { drawShape, boundsOfMany } from "./shapes.js";

/**
 * Exporte le dessin en PNG.
 * On crée un canvas temporaire, en mémoire, exactement à la taille du dessin
 * (et non à la taille de l'écran) : l'image ne contient donc ni les marges
 * vides, ni la barre d'outils.
 */
export async function exportPng(shapes, { scale = 2, padding = 24, title = "board" } = {}) {
  if (!shapes.length) throw new Error("Le board est vide : rien à exporter.");

  const measure = document.createElement("canvas").getContext("2d");
  const box = boundsOfMany(shapes, measure);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil((box.w + padding * 2) * scale));
  canvas.height = Math.max(1, Math.ceil((box.h + padding * 2) * scale));

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, (-box.x + padding) * scale, (-box.y + padding) * scale);
  for (const shape of shapes) drawShape(ctx, shape);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  download(blob, `${safeName(title)}.png`);
}

/** Exporte le dessin en JSON (rechargeable ensuite avec « Importer »). */
export function exportJson(shapes, { title = "board", boardId = "" } = {}) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    board: { id: boardId, title },
    shapes: shapes.map(({ clock, actor, ...shape }) => shape),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  download(blob, `${safeName(title)}.json`);
}

/** Lit un fichier JSON et renvoie une liste de formes valides. */
export async function readJsonFile(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  const shapes = Array.isArray(data) ? data : data.shapes;
  if (!Array.isArray(shapes)) throw new Error("Fichier JSON non reconnu.");

  const allowed = new Set(["rect", "ellipse", "arrow", "pen", "text"]);
  return shapes
    .filter((shape) => shape && allowed.has(shape.kind))
    .map((shape) => ({
      ...shape,
      // On donne un nouvel identifiant : importer deux fois le même fichier
      // ajoute deux copies au lieu d'écraser la première.
      id: crypto.randomUUID(),
      z: undefined,
    }));
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeName(value) {
  return String(value).replace(/[^\w\-À-ÿ ]+/g, "").trim().replace(/\s+/g, "-") || "board";
}
