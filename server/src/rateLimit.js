// Limitation de débit (« rate limiting »), exigée par le sujet.
//
// Principe du « seau à jetons » : chaque adresse IP possède un seau de N
// jetons. Chaque requête consomme un jeton. Le seau se remplit petit à petit.
// Seau vide → la requête est refusée avec le code HTTP 429 (Too Many Requests).
// Cela empêche quelqu'un de marteler le serveur (ex : essayer des milliers de
// mots de passe).
//
// Stockage en mémoire : suffisant pour un serveur unique. Avec plusieurs
// serveurs il faudrait Redis — noté comme limite dans le rapport.

const buckets = new Map();

export function rateLimit({ capacity, refillPerSecond, key = keyByIp }) {
  return function middleware(req, res, next) {
    const id = `${middleware.tag || capacity}:${key(req)}`;
    const nowMs = Date.now();
    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = { tokens: capacity, last: nowMs };
      buckets.set(id, bucket);
    }
    // On recrédite le seau proportionnellement au temps écoulé.
    const elapsedSeconds = (nowMs - bucket.last) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond);
    bucket.last = nowMs;

    if (bucket.tokens < 1) {
      res.setHeader("Retry-After", Math.ceil(1 / refillPerSecond));
      return res.status(429).json({ error: "Trop de requêtes. Réessaie dans un instant." });
    }
    bucket.tokens -= 1;
    next();
  };
}

function keyByIp(req) {
  return req.ip || req.socket?.remoteAddress || "inconnu";
}

// Nettoyage périodique pour ne pas garder en mémoire les IP inactives.
const cleanup = setInterval(() => {
  const limit = Date.now() - 10 * 60 * 1000;
  for (const [id, bucket] of buckets) if (bucket.last < limit) buckets.delete(id);
}, 60_000);
cleanup.unref();

export function _resetForTests() {
  buckets.clear();
}
