// Comptes utilisateurs : mots de passe, sessions, cookies.
import crypto from "node:crypto";
import { db, now } from "./db.js";
import { config } from "./config.js";
import { shortId, longToken, colorFor } from "./ids.js";

const COOKIE_NAME = "sid";
const SCRYPT_KEYLEN = 64;

// --- Mots de passe -------------------------------------------------------
// On ne stocke JAMAIS le mot de passe. On stocke le résultat de scrypt, une
// fonction volontairement lente : même en volant la base, un attaquant met
// très longtemps à retrouver les mots de passe par essais successifs.
// Le « sel » (salt) est une valeur aléatoire différente pour chaque compte :
// deux personnes avec le même mot de passe ont deux empreintes différentes.

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password + config.sessionSecret, salt, SCRYPT_KEYLEN)
    .toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(
    password + config.sessionSecret,
    salt,
    SCRYPT_KEYLEN
  );
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== candidate.length) return false;
  // Comparaison à temps constant : évite de laisser deviner le mot de passe
  // en mesurant le temps de réponse du serveur.
  return crypto.timingSafeEqual(candidate, expected);
}

// --- Cookies -------------------------------------------------------------

export function parseCookies(header = "") {
  const out = {};
  for (const part of String(header).split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(
      part.slice(index + 1).trim()
    );
  }
  return out;
}

function sign(value) {
  const mac = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(value)
    .digest("base64url");
  return `${value}.${mac}`;
}

function unsign(signed) {
  const index = String(signed).lastIndexOf(".");
  if (index === -1) return null;
  const value = signed.slice(0, index);
  return sign(value) === signed ? value : null;
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, sign(token), {
    httpOnly: true, // le JavaScript de la page ne peut pas lire ce cookie
    sameSite: "lax", // le cookie n'est pas envoyé depuis un autre site
    secure: config.isProduction, // en HTTPS uniquement une fois déployé
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 jours
    path: "/",
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

// --- Utilisateurs et sessions -------------------------------------------

export function createUser({ email, password, name }) {
  const id = shortId(12);
  const cleanEmail = String(email).trim().toLowerCase();
  const displayName = String(name || cleanEmail.split("@")[0]).trim();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, color, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    cleanEmail,
    hashPassword(password),
    displayName,
    colorFor(id),
    now()
  );
  return getUserById(id);
}

export function getUserByEmail(email) {
  return db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(String(email).trim().toLowerCase());
}

export function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function createSession(userId) {
  const token = longToken();
  db.prepare(
    "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)"
  ).run(token, userId, now());
  return token;
}

export function destroySession(token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function userFromCookieHeader(cookieHeader) {
  const raw = parseCookies(cookieHeader)[COOKIE_NAME];
  if (!raw) return null;
  const token = unsign(raw);
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT users.* FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?`
    )
    .get(token);
  return row || null;
}

export function sessionTokenFromCookieHeader(cookieHeader) {
  const raw = parseCookies(cookieHeader)[COOKIE_NAME];
  return raw ? unsign(raw) : null;
}

/** Middleware Express : place l'utilisateur connecté dans req.user. */
export function attachUser(req, _res, next) {
  req.user = userFromCookieHeader(req.headers.cookie);
  next();
}

/** Middleware Express : refuse la requête si personne n'est connecté. */
export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Connexion requise." });
  next();
}

/** Vue publique d'un utilisateur (jamais le mot de passe). */
export function publicUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, color: user.color };
}
