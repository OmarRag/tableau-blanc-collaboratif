// Page d'accueil : connexion / inscription, puis liste « Mes boards ».
import { api } from "../api.js";

const app = document.getElementById("app");

// Le serveur indique quels moyens de connexion il propose. Si Google n'est
// pas configuré, le bouton n'apparaît pas du tout.
let googleDisponible = false;

start();

async function start() {
  const { user, providers } = await api.me().catch(() => ({ user: null }));
  googleDisponible = Boolean(providers?.google);
  if (user) renderDashboard(user);
  else renderAuth();
}

// Messages d'erreur possibles après un retour depuis Google. Le serveur
// ajoute « ?erreur=... » à l'adresse quand quelque chose s'est mal passé.
const ERREURS_GOOGLE = {
  "google-annule": "Connexion Google annulée.",
  "google-state": "La connexion Google a expiré. Réessaie.",
  "google-sans-code": "Google n'a rien renvoyé. Réessaie.",
  "google-echec": "Impossible de se connecter avec Google.",
};

function messageDeRetour() {
  const raison = new URLSearchParams(location.search).get("erreur");
  if (!raison) return "";
  // On nettoie l'adresse pour que le message ne réapparaisse pas au
  // rechargement de la page.
  history.replaceState(null, "", location.pathname);
  return ERREURS_GOOGLE[raison] || "La connexion a échoué.";
}

// --- Connexion / inscription --------------------------------------------

function renderAuth(mode = "login") {
  app.innerHTML = `
    <h1>Tableau blanc collaboratif</h1>
    <p class="subtitle">Dessinez à plusieurs, en temps réel.</p>
    <div class="card auth-card">
      <div class="auth-tabs">
        <button data-mode="login" class="${mode === "login" ? "active" : ""}">Se connecter</button>
        <button data-mode="register" class="${mode === "register" ? "active" : ""}">Créer un compte</button>
      </div>
      <form id="auth-form">
        ${
          mode === "register"
            ? `<label><span>Nom affiché</span><input name="name" autocomplete="nickname" /></label>`
            : ""
        }
        <label><span>Email</span><input name="email" type="email" required autocomplete="email" /></label>
        <label><span>Mot de passe</span><input name="password" type="password" required minlength="8"
          autocomplete="${mode === "register" ? "new-password" : "current-password"}" /></label>
        <button class="primary" type="submit">
          ${mode === "register" ? "Créer mon compte" : "Se connecter"}
        </button>
        <p class="error" id="auth-error">${escapeHtml(messageDeRetour())}</p>
      </form>
      ${googleDisponible ? boutonGoogle() : ""}
    </div>
  `;

  for (const tab of app.querySelectorAll(".auth-tabs button")) {
    tab.onclick = () => renderAuth(tab.dataset.mode);
  }

  app.querySelector("#auth-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const payload = Object.fromEntries(form.entries());
    try {
      const { user } = mode === "register" ? await api.register(payload) : await api.login(payload);
      renderDashboard(user);
    } catch (error) {
      app.querySelector("#auth-error").textContent = error.message;
    }
  };
}

/**
 * Bouton « Continuer avec Google ».
 *
 * C'est un simple lien, et non un appel de données : le navigateur doit
 * VRAIMENT quitter la page pour aller chez Google, puis en revenir. Un
 * « fetch » ne le permettrait pas.
 *
 * Le logo est écrit directement dans la page (SVG) plutôt que chargé depuis
 * un serveur de Google : la page reste affichable même hors ligne, et aucune
 * requête vers un autre site n'est déclenchée à l'ouverture.
 */
function boutonGoogle() {
  return `
    <div class="separateur"><span>ou</span></div>
    <a class="google-button" id="google-login" href="/auth/google">
      <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"/>
        <path fill="#FBBC05" d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33z"/>
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.65 3.58 9 3.58z"/>
      </svg>
      <span>Continuer avec Google</span>
    </a>
  `;
}

// --- Mes boards -----------------------------------------------------------

async function renderDashboard(user) {
  const { owned, shared } = await api.listBoards();

  app.innerHTML = `
    <div class="board-head">
      <h1>Mes boards</h1>
      <div class="spacer"></div>
      <span class="tag">${escapeHtml(user.name)}</span>
      <button id="new-board" class="primary">Nouveau board</button>
      <button id="logout">Déconnexion</button>
    </div>

    <h2>Créés par moi</h2>
    ${tiles(owned, true)}

    <h2>Partagés avec moi</h2>
    ${tiles(shared, false)}
  `;

  app.querySelector("#logout").onclick = async () => {
    await api.logout();
    renderAuth();
  };

  app.querySelector("#new-board").onclick = async () => {
    const title = prompt("Nom du board ?", "Nouveau board");
    if (title === null) return;
    const { board } = await api.createBoard(title || "Nouveau board");
    location.href = `/b/${board.id}`;
  };

  for (const button of app.querySelectorAll("[data-delete]")) {
    button.onclick = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!confirm("Supprimer définitivement ce board ?")) return;
      await api.deleteBoard(button.dataset.delete);
      renderDashboard(user);
    };
  }
}

function tiles(boards, canDelete) {
  if (!boards.length) return `<p class="empty">Aucun board pour l'instant.</p>`;
  return `<div class="board-grid">${boards
    .map(
      (board) => `
      <a class="board-tile" href="/b/${board.id}">
        <span class="name">${escapeHtml(board.title)}</span>
        <span class="meta">modifié le ${new Date(board.updatedAt).toLocaleString("fr-FR")}</span>
        <span class="meta">
          <span class="tag">${board.isPublic ? "public" : "privé"}</span>
          <span class="tag">${roleLabel(board.role)}</span>
        </span>
        ${canDelete ? `<span class="actions"><button data-delete="${board.id}">Supprimer</button></span>` : ""}
      </a>`
    )
    .join("")}</div>`;
}

function roleLabel(role) {
  if (role === "owner") return "propriétaire";
  if (role === "edit") return "peut dessiner";
  return "lecture seule";
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );
}
