// Point d'entrée du serveur.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { config } from "./config.js";
import { api } from "./routes.js";
import { setupRealtime } from "./realtime.js";
import "./db.js";

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

app.get("/healthz", (_req, res) => res.json({ ok: true }));

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

server.listen(config.port, () => {
  console.log(`[serveur] écoute sur http://localhost:${config.port}`);
  console.log(`[serveur] base de données : ${config.dbFile}`);
  if (!fs.existsSync(config.clientDist)) {
    console.log("[serveur] client non compilé : utilise « npm run dev » côté client.");
  }
});
