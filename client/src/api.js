// Petit utilitaire pour parler à l'API du serveur.
// « credentials: include » = envoyer le cookie de session avec la requête.

async function request(method, url, body) {
  const response = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Erreur ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  me: () => request("GET", "/api/auth/me"),
  register: (payload) => request("POST", "/api/auth/register", payload),
  login: (payload) => request("POST", "/api/auth/login", payload),
  logout: () => request("POST", "/api/auth/logout"),

  listBoards: () => request("GET", "/api/boards"),
  createBoard: (title) => request("POST", "/api/boards", { title }),
  getBoard: (id, shareToken) =>
    request("GET", `/api/boards/${id}${shareToken ? `?k=${encodeURIComponent(shareToken)}` : ""}`),
  updateBoard: (id, payload) => request("PATCH", `/api/boards/${id}`, payload),
  deleteBoard: (id) => request("DELETE", `/api/boards/${id}`),

  members: (id) => request("GET", `/api/boards/${id}/members`),
  invite: (id, email, role) => request("POST", `/api/boards/${id}/members`, { email, role }),
  removeMember: (id, userId) => request("DELETE", `/api/boards/${id}/members/${userId}`),
  rotateShare: (id) => request("POST", `/api/boards/${id}/share/rotate`),
};
