// Point d'entrée du serveur.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { config } from "./config.js";
import { api } from "./routes.js";
import { googleAuth } from "./oauthGoogle.js";
import { setupRealtime } from "./realtime.js";
import { initDb, dialect, closeDb } from "./db.js";

// La base doit être prête AVANT d'accepter la première requête : avec
// PostgreSQL, la connexion et la création des tables prennent un instant.
await initDb();

const app = express();

// Express est derrière un reverse proxy une fois déployé (Fly.io, Render…).
// Sans cette ligne, toutes les requêtes sembleraient venir de la même IP et
// la limitation de débit bloquerait tout le monde d'un coup.
app.set("trust proxy", 1);

// En développement, le navigateur charge la page depuis Vite (port 5173) et
// appelle l'API sur le port 3000 : il faut autoriser explicitement cette
// origine (CORS). En production, tout est servi par ce serveur, donc inutile.
if (!config.isProduction) {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", config.clientOrigin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
}

app.use("/api", api);

// Connexion avec Google. Ce chemin n'est PAS sous /api : c'est le navigateur
// lui-même qui y navigue (aller chez Google, puis en revenir), ce ne sont pas
// des appels de données.
app.use("/auth", googleAuth);

// Render interroge cette adresse pour savoir si le service est vivant.
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Une adresse « /api/... » inconnue doit répondre en JSON, et non renvoyer la
// page d'accueil : sinon le client recevrait du HTML là où il attend des
// données, et afficherait un message d'erreur incompréhensible.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Route inconnue." });
});

// --- Fichiers du client (production uniquement) --------------------------
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist));

  // Une URL de board (« /b/xxxx ») n'est pas un fichier : on renvoie la page
  // du tableau, qui lira l'identifiant dans l'adresse.
  app.get("/b/:id", (_req, res) => {
    res.sendFile(path.join(config.clientDist, "board.html"));
  });

  app.use((_req, res) => {
    res.sendFile(path.join(config.clientDist, "index.html"));
  });
}

const server = http.createServer(app);
setupRealtime(server);

// Render fournit le port à écouter et attend l'adresse 0.0.0.0 (et non
// « localhost », qui n'accepterait que les connexions venant de la machine
// elle-même : l'hébergeur ne verrait jamais le serveur démarrer).
server.listen(config.port, "0.0.0.0", () => {
  console.log(`[serveur] écoute sur le port ${config.port}`);
  console.log(
    `[serveur] base de données : ${
      dialect === "postgres" ? "PostgreSQL (DATABASE_URL)" : config.dbFile
    }`
  );
  if (!fs.existsSync(config.clientDist)) {
    console.log("[serveur] client non compilé : utilise « npm run dev » côté client.");
  }
});

// Render envoie SIGTERM avant d'arrêter un service : on ferme proprement la
// base pour ne pas laisser de connexion PostgreSQL ouverte dans le vide.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, async () => {
    console.log(`[serveur] arrêt demandé (${signal})`);
    server.close();
    await closeDb();
    process.exit(0);
  });
}
