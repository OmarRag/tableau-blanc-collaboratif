import { defineConfig } from "vite";
import path from "node:path";

// Petit plugin maison : en développement, l'adresse d'un board est
// « /b/xxxxx ». Ce n'est pas un fichier sur le disque ; on dit donc à Vite de
// répondre avec board.html. Le serveur Express fait la même chose en
// production (voir server/src/index.js).
function boardUrlRewrite() {
  return {
    name: "board-url-rewrite",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && /^\/b\/[^/?]+/.test(req.url)) req.url = "/board.html";
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [boardUrlRewrite()],
  server: {
    port: 5173,
    // Le code du client importe « shared/merge.js », qui vit en dehors du
    // dossier client/. Il faut autoriser Vite à lire le dossier parent.
    fs: { allow: [path.resolve(import.meta.dirname, "..")] },
    // Les appels « /api/... » et la connexion temps réel sont transmis au
    // serveur Node (port 3000). Le navigateur ne voit qu'une seule origine :
    // pas de problème de CORS ni de cookies bloqués.
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/socket.io": { target: "http://localhost:3000", ws: true, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, "index.html"),
        board: path.resolve(import.meta.dirname, "board.html"),
      },
    },
  },
});
