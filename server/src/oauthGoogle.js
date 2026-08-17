// Connexion avec Google (« OAuth 2.0 »).
//
// OAuth, en une phrase : au lieu de nous confier son mot de passe, la
// personne se connecte chez Google, et Google nous renvoie une preuve
// d'identité. Nous ne voyons jamais son mot de passe.
//
// Le trajet complet, dans l'ordre :
//
//   1. La personne clique sur « Continuer avec Google ».
//      → on l'envoie chez Google avec notre identifiant d'application.
//   2. Elle choisit son compte et accepte.
//      → Google la renvoie chez nous sur /auth/google/callback avec un
//        « code » à usage unique.
//   3. Notre serveur échange ce code contre un jeton, en coulisses.
//      → cet échange utilise le SECRET, qui ne quitte jamais le serveur.
//   4. Le jeton contient l'identité (identifiant Google, email, nom).
//      → on crée ou on retrouve le compte, puis on pose notre cookie de
//        session habituel. La suite du site ne voit aucune différence.
//
// Aucune bibliothèque : deux requêtes HTTP et un décodage suffisent.
import express from "express";
import crypto from "node:crypto";
import { config } from "./config.js";
import { findOrCreateGoogleUser, createSession, setSessionCookie, parseCookies } from "./auth.js";
import { rateLimit } from "./rateLimit.js";

export const googleAuth = express.Router();

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const STATE_COOKIE = "g_state";

// Même plafond que le formulaire de connexion : c'est une porte d'entrée.
const oauthLimit = rateLimit({
  capacity: config.rateLimit.authCapacity,
  refillPerSecond: config.rateLimit.authRefillPerSecond,
});

/**
 * L'adresse de retour doit être IDENTIQUE, au caractère près, à celle
 * déclarée dans la console Google. On la reconstruit à partir de la requête,
 * ce qui donne automatiquement la bonne valeur en local
 * (http://localhost:3000/...) comme en ligne (https://<domaine>/...).
 *
 * `req.protocol` vaut « https » derrière Render grâce à « trust proxy »
 * (voir index.js) : sans cela on annoncerait « http » et Google refuserait.
 */
function redirectUri(req) {
  return `${req.protocol}://${req.get("host")}/auth/google/callback`;
}

/**
 * Début de l'adresse où renvoyer la personne une fois connectée.
 * En production, la page est servie par ce même serveur : une adresse
 * relative suffit (chaîne vide). En développement, la page vient de Vite,
 * sur un autre port : il faut l'adresse complète.
 */
function retourVersSite() {
  return config.isProduction ? "" : config.clientOrigin;
}

googleAuth.get("/google", oauthLimit, (req, res) => {
  if (!config.google.enabled) {
    return res.status(404).send("La connexion Google n'est pas configurée sur ce serveur.");
  }

  // Le « state » protège contre une attaque où quelqu'un vous ferait
  // terminer SA connexion à votre place : on tire une valeur au hasard, on la
  // range dans un cookie, et on vérifiera au retour qu'elle correspond.
  const state = crypto.randomBytes(16).toString("base64url");
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax", // doit survivre au retour depuis google.com
    secure: config.isProduction,
    maxAge: 10 * 60 * 1000, // 10 minutes : le temps de se connecter
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.redirect(`${AUTH_URL}?${params}`);
});

googleAuth.get("/google/callback", oauthLimit, async (req, res) => {
  if (!config.google.enabled) return res.status(404).send("Connexion Google non configurée.");

  const echec = (raison) =>
    res.redirect(`${retourVersSite()}/?erreur=${encodeURIComponent(raison)}`);

  // La personne a cliqué « Annuler » chez Google.
  if (req.query.error) return echec("google-annule");

  const attendu = parseCookies(req.headers.cookie)[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { path: "/" });
  if (!attendu || attendu !== req.query.state) return echec("google-state");
  if (!req.query.code) return echec("google-sans-code");

  try {
    const profil = await echangerLeCode(String(req.query.code), redirectUri(req));
    const user = await findOrCreateGoogleUser(profil);
    setSessionCookie(res, await createSession(user.id));
    res.redirect(`${retourVersSite()}/`);
  } catch (error) {
    console.error("[google] connexion impossible :", error.message);
    echec("google-echec");
  }
});

/**
 * Étape 3 : échange le code contre un jeton, puis en extrait l'identité.
 * @returns {Promise<{sub:string,email:string,emailVerified:boolean,name:string}>}
 */
async function echangerLeCode(code, redirect) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: redirect,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.id_token) {
    throw new Error(data.error_description || data.error || "échange du code refusé");
  }
  return lireIdToken(data.id_token);
}

/**
 * Le « id_token » est un JWT : trois parties séparées par des points, dont
 * celle du milieu contient les informations, encodées en base64url.
 *
 * On ne vérifie pas sa signature, et c'est volontaire : Google précise que
 * cette vérification est inutile quand le jeton vient d'être reçu
 * directement de son serveur, en HTTPS, dans la réponse ci-dessus. Personne
 * n'a pu le modifier au passage.
 */
export function lireIdToken(idToken) {
  const parties = String(idToken).split(".");
  if (parties.length !== 3) throw new Error("jeton Google mal formé");
  const charge = JSON.parse(Buffer.from(parties[1], "base64url").toString("utf8"));
  return {
    sub: charge.sub,
    email: charge.email,
    // Google renvoie parfois la chaîne "true" au lieu du booléen true.
    emailVerified: charge.email_verified === true || charge.email_verified === "true",
    name: charge.name || charge.given_name || "",
  };
}
