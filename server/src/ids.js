import crypto from "node:crypto";

// Alphabet sans caractères ambigus (pas de 0/O ni 1/l) : les identifiants de
// board se retrouvent dans l'URL et peuvent être recopiés à la main.
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";

export function shortId(length = 10) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

export function longToken() {
  return crypto.randomBytes(24).toString("base64url");
}

// Couleur attribuée à un utilisateur : sert au curseur affiché aux autres.
// On prend une teinte fixe tirée de l'identifiant pour qu'elle ne change pas
// d'une connexion à l'autre.
const COLORS = [
  "#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4",
  "#008080", "#f032e6", "#9a6324", "#800000", "#000075",
];

export function colorFor(seed) {
  const hash = crypto.createHash("sha1").update(seed).digest()[0];
  return COLORS[hash % COLORS.length];
}
