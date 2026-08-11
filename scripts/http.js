// Petit client HTTP partagé par les scripts de test.
//
// Il fait deux choses qu'un navigateur fait tout seul :
//   - garder le cookie de session d'une requête à l'autre ;
//   - réessayer quand le serveur répond 429 (« trop de requêtes »).
//
// La deuxième est nécessaire parce que les scripts de test créent beaucoup de
// comptes d'affilée depuis la même adresse IP, ce que la limitation de débit
// du serveur est justement censée freiner.

const RETRY_DELAY_MS = 1500;
const MAX_RETRIES = 6;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createHttpClient(base) {
  let cookie = "";

  /**
   * @param {object} [options]
   * @param {boolean} [options.retry] false pour observer le 429 au lieu de le
   *   contourner (utile pour tester la limitation de débit elle-même).
   */
  async function call(method, path, body, options = {}) {
    const retry = options.retry !== false;
    for (let essai = 0; ; essai++) {
      const response = await fetch(base + path, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (retry && response.status === 429 && essai < MAX_RETRIES) {
        // Le serveur indique combien de temps attendre : on le respecte.
        const retryAfter = Number(response.headers.get("retry-after"));
        await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RETRY_DELAY_MS);
        continue;
      }

      for (const value of response.headers.getSetCookie?.() || []) {
        cookie = value.split(";")[0];
      }
      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      return { status: response.status, data };
    }
  }

  return {
    call,
    get cookie() {
      return cookie;
    },
    reset() {
      cookie = "";
    },
  };
}
