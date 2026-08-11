// Tout ce qui concerne UNE forme : la dessiner, calculer sa boîte, savoir si
// un point est dessus, la déplacer.
//
// Modèle commun à toutes les formes :
//   { id, kind, x, y, stroke, strokeWidth, fill }
// puis, selon le type :
//   rect / ellipse : w, h
//   arrow          : w, h  (vecteur : la pointe est en x+w, y+h)
//   pen            : points = [[dx, dy], …] relatifs à (x, y)
//   text           : text, fontSize

export const KINDS = ["select", "pen", "rect", "ellipse", "arrow", "text", "eraser"];

/** Marge de tolérance (en pixels monde) pour cliquer sur un trait fin. */
const HIT_PADDING = 6;

export function drawShape(ctx, shape) {
  ctx.save();
  ctx.strokeStyle = shape.stroke || "#1b1f24";
  ctx.fillStyle = shape.fill || "transparent";
  ctx.lineWidth = shape.strokeWidth || 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  switch (shape.kind) {
    case "rect": {
      const { x, y, w, h } = normalized(shape);
      if (shape.fill) ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      break;
    }
    case "ellipse": {
      const { x, y, w, h } = normalized(shape);
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      if (shape.fill) ctx.fill();
      ctx.stroke();
      break;
    }
    case "arrow":
      drawArrow(ctx, shape);
      break;
    case "pen": {
      const points = shape.points || [];
      if (points.length < 2) {
        // Un simple clic : on dessine un point.
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, (shape.strokeWidth || 2) / 2, 0, Math.PI * 2);
        ctx.fillStyle = shape.stroke;
        ctx.fill();
        break;
      }
      ctx.beginPath();
      ctx.moveTo(shape.x + points[0][0], shape.y + points[0][1]);
      // Courbes lissées : on passe par le milieu de chaque segment, ce qui
      // évite l'aspect « cassé » d'un tracé fait de petits traits droits.
      for (let i = 1; i < points.length - 1; i++) {
        const midX = shape.x + (points[i][0] + points[i + 1][0]) / 2;
        const midY = shape.y + (points[i][1] + points[i + 1][1]) / 2;
        ctx.quadraticCurveTo(shape.x + points[i][0], shape.y + points[i][1], midX, midY);
      }
      const last = points[points.length - 1];
      ctx.lineTo(shape.x + last[0], shape.y + last[1]);
      ctx.stroke();
      break;
    }
    case "text": {
      const size = shape.fontSize || 20;
      ctx.font = `${size}px system-ui, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillStyle = shape.stroke || "#1b1f24";
      const lines = String(shape.text || "").split("\n");
      lines.forEach((line, index) => ctx.fillText(line, shape.x, shape.y + index * size * 1.25));
      break;
    }
  }
  ctx.restore();
}

function drawArrow(ctx, shape) {
  const x2 = shape.x + shape.w;
  const y2 = shape.y + shape.h;
  ctx.beginPath();
  ctx.moveTo(shape.x, shape.y);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const angle = Math.atan2(shape.h, shape.w);
  const head = Math.max(10, (shape.strokeWidth || 2) * 4);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 7), y2 - head * Math.sin(angle - Math.PI / 7));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 7), y2 - head * Math.sin(angle + Math.PI / 7));
  ctx.stroke();
}

/** Rectangle (x, y, w, h) toujours avec largeur/hauteur positives. */
function normalized(shape) {
  return {
    x: Math.min(shape.x, shape.x + shape.w),
    y: Math.min(shape.y, shape.y + shape.h),
    w: Math.abs(shape.w),
    h: Math.abs(shape.h),
  };
}

/** Boîte englobante d'une forme, en coordonnées monde. */
export function boundsOf(shape, ctx) {
  switch (shape.kind) {
    case "rect":
    case "ellipse":
    case "arrow": {
      const box = normalized(shape);
      const pad = (shape.strokeWidth || 2) / 2 + (shape.kind === "arrow" ? 12 : 0);
      return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
    }
    case "pen": {
      const points = shape.points || [];
      if (!points.length) return { x: shape.x, y: shape.y, w: 1, h: 1 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [dx, dy] of points) {
        minX = Math.min(minX, dx); maxX = Math.max(maxX, dx);
        minY = Math.min(minY, dy); maxY = Math.max(maxY, dy);
      }
      const pad = (shape.strokeWidth || 2) / 2 + 1;
      return {
        x: shape.x + minX - pad,
        y: shape.y + minY - pad,
        w: maxX - minX + pad * 2,
        h: maxY - minY + pad * 2,
      };
    }
    case "text": {
      const size = shape.fontSize || 20;
      const lines = String(shape.text || "").split("\n");
      let width = 0;
      if (ctx) {
        ctx.save();
        ctx.font = `${size}px system-ui, sans-serif`;
        for (const line of lines) width = Math.max(width, ctx.measureText(line).width);
        ctx.restore();
      } else {
        // Estimation grossière quand aucun contexte n'est disponible.
        for (const line of lines) width = Math.max(width, line.length * size * 0.55);
      }
      return { x: shape.x, y: shape.y, w: Math.max(width, 8), h: lines.length * size * 1.25 };
    }
    default:
      return { x: shape.x, y: shape.y, w: 0, h: 0 };
  }
}

/** Le point (px, py) touche-t-il la forme ? */
export function hitTest(shape, px, py, ctx) {
  const box = boundsOf(shape, ctx);
  const tolerance = HIT_PADDING + (shape.strokeWidth || 2) / 2;

  // Test rapide : hors de la boîte élargie → sûrement pas.
  if (
    px < box.x - tolerance || px > box.x + box.w + tolerance ||
    py < box.y - tolerance || py > box.y + box.h + tolerance
  ) return false;

  switch (shape.kind) {
    case "text":
      return true;
    case "rect": {
      const r = normalized(shape);
      if (shape.fill) return true;
      // Contour seulement : on est dessus si on est près d'un des 4 côtés.
      const insideOuter =
        px >= r.x - tolerance && px <= r.x + r.w + tolerance &&
        py >= r.y - tolerance && py <= r.y + r.h + tolerance;
      const insideInner =
        px > r.x + tolerance && px < r.x + r.w - tolerance &&
        py > r.y + tolerance && py < r.y + r.h - tolerance;
      return insideOuter && !insideInner;
    }
    case "ellipse": {
      const r = normalized(shape);
      const rx = Math.max(r.w / 2, 0.001);
      const ry = Math.max(r.h / 2, 0.001);
      const nx = (px - (r.x + rx)) / rx;
      const ny = (py - (r.y + ry)) / ry;
      const value = nx * nx + ny * ny;
      if (shape.fill) return value <= 1.05;
      const band = tolerance / Math.min(rx, ry);
      return value >= (1 - band) ** 2 && value <= (1 + band) ** 2;
    }
    case "arrow":
      return distanceToSegment(px, py, shape.x, shape.y, shape.x + shape.w, shape.y + shape.h) <= tolerance;
    case "pen": {
      const points = shape.points || [];
      if (points.length < 2) {
        return Math.hypot(px - shape.x, py - shape.y) <= tolerance;
      }
      for (let i = 0; i < points.length - 1; i++) {
        const distance = distanceToSegment(
          px, py,
          shape.x + points[i][0], shape.y + points[i][1],
          shape.x + points[i + 1][0], shape.y + points[i + 1][1]
        );
        if (distance <= tolerance) return true;
      }
      return false;
    }
    default:
      return false;
  }
}

export function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Une forme déplacée de (dx, dy). Ne modifie pas l'original. */
export function movedShape(shape, dx, dy) {
  return { ...shape, x: shape.x + dx, y: shape.y + dy };
}

/** La boîte englobant plusieurs formes. */
export function boundsOfMany(shapes, ctx) {
  if (!shapes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const shape of shapes) {
    const box = boundsOf(shape, ctx);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** La forme est-elle entièrement dans le rectangle de sélection ? */
export function intersectsBox(shape, box, ctx) {
  const b = boundsOf(shape, ctx);
  return !(b.x > box.x + box.w || b.x + b.w < box.x || b.y > box.y + box.h || b.y + b.h < box.y);
}
