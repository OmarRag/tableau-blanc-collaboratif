// La « caméra » : quelle partie du canvas infini on regarde.
//
// Deux systèmes de coordonnées :
//   - MONDE  : les coordonnées des formes. Elles ne changent jamais.
//   - ÉCRAN  : les pixels de la fenêtre. Elles changent quand on déplace la
//              vue (pan) ou qu'on zoome.
//
// Passage de l'un à l'autre :
//   écran = monde * zoom + décalage
//   monde = (écran − décalage) / zoom

export function createCamera() {
  return { x: 0, y: 0, zoom: 1 };
}

export function toWorld(camera, screenX, screenY) {
  return {
    x: (screenX - camera.x) / camera.zoom,
    y: (screenY - camera.y) / camera.zoom,
  };
}

export function toScreen(camera, worldX, worldY) {
  return {
    x: worldX * camera.zoom + camera.x,
    y: worldY * camera.zoom + camera.y,
  };
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

/** Zoome en gardant fixe le point situé sous la souris. */
export function zoomAt(camera, screenX, screenY, factor) {
  const next = clampZoom(camera.zoom * factor);
  const applied = next / camera.zoom;
  camera.x = screenX - (screenX - camera.x) * applied;
  camera.y = screenY - (screenY - camera.y) * applied;
  camera.zoom = next;
}

export function setZoom(camera, zoom, centerX, centerY) {
  zoomAt(camera, centerX, centerY, clampZoom(zoom) / camera.zoom);
}

export function clampZoom(zoom) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}
