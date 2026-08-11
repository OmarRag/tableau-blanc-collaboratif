// Page d'accueil : connexion / inscription, puis liste « Mes boards ».
import { api } from "../api.js";

const app = document.getElementById("app");

start();

async function start() {
  const { user } = await api.me().catch(() => ({ user: null }));
  if (user) renderDashboard(user);
  else renderAuth();
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
        <p class="error" id="auth-error"></p>
      </form>
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
