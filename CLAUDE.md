# CLAUDE.md — Tableau blanc collaboratif (projet de stage)

> Ce fichier est lu automatiquement au début de chaque session Claude Code.
> Il sert à reprendre le travail **sans que je réexplique le projet**.
> À mettre à jour à la fin de chaque étape.

---

## 1. Qui je suis

- Étudiant en 1re année d'école d'ingénieur en informatique.
- HTML et CSS : acquis. JavaScript : **débutant**.
- Le vocabulaire technique anglais/jargon me ralentit.
- **Objectif** : pas juste « ça marche », mais **comprendre**, parce que je
  devrai refaire ce projet moi-même ensuite.

## 2. Le projet

Un **tableau blanc collaboratif en temps réel** (type Excalidraw / Miro),
réalisé en 8 semaines de stage.

Fonctionnalités visées :

| # | Fonctionnalité | Détail |
|---|---|---|
| 1 | Dessin | Canvas infini, formes, texte, gomme, sélection |
| 2 | Navigation | Pan (déplacer la vue) et zoom |
| 3 | Historique | Undo / Redo |
| 4 | Export | PNG et JSON |
| 5 | Temps réel | Plusieurs personnes en direct (~200 ms de latence max) |
| 6 | Présence | Voir les curseurs des autres |
| 7 | Robustesse | Pas de conflit ; reconnexion sans rien perdre |
| 8 | Persistance | Boards sauvegardés, URL unique par board, public/privé |
| 9 | Comptes | Email/mot de passe ou Google/GitHub, page « mes boards » |
| 10 | Partage | Partage d'un board avec des droits (lecture / écriture) |
| 11 | Déploiement | En ligne, sur une URL publique en HTTPS |

✅ `SUBJECT.pdf` (le sujet officiel) **a été lu le 11 août 2026**. Le tableau
ci-dessus est conforme. Le sujet ajoute ces contraintes, à ne pas oublier :

**Livrables attendus**

- Un **dépôt Git** contenant un `README.md` : architecture + un *diagramme de
  séquence* (un schéma qui montre, dans l'ordre, qui envoie quoi à qui quand
  une personne dessine une forme).
- Une **vidéo de démo (~3 min)** montrant deux navigateurs sur le même board.
- Un **document « choix techniques »** justifiant l'algorithme de synchro.
- L'**URL publique** du site déployé.

**Détails imposés**

- Outils de dessin : rectangle, ellipse, **main levée**, **flèche**, texte,
  gomme, sélection/déplacement.
- Curseurs des autres avec **pseudo + couleur**.
- Partage **par email** *ou* **par lien** avec droits (lecture / écriture).
- Déploiement : HTTPS, **limitation de débit** (« rate limiting » = empêcher
  qu'un utilisateur envoie trop de requêtes) et configuration par
  **variables d'environnement** (les mots de passe ne sont pas écrits dans le
  code, mais lus depuis les réglages du serveur).
- **Test de charge à 5 utilisateurs simultanés** en fin de projet.

**Barème de notation**

| Critère | Poids |
|---|---|
| Justesse de la synchro temps réel | 25 % |
| Qualité du code, architecture, **tests** | 20 % |
| Confort de dessin (latence, ressenti) | 15 % |
| Comptes + persistance + partage | 15 % |
| Déploiement + fiabilité | 15 % |
| Démo + doc de choix techniques | 10 % |

→ Conséquence : il faudra écrire **quelques tests automatiques** (20 % de la
note). Ce n'était pas prévu au départ ; à intégrer à l'étape 6.

---

## 3. Règles de travail (IMPORTANT — à respecter à chaque réponse)

1. **Parler français**, avec des **mots simples**. Chaque mot technique est
   expliqué **la première fois** qu'il apparaît.
2. **Une seule étape à la fois.** Ne jamais coder plusieurs étapes d'un coup.
3. **Avant de coder** : annoncer en 3-4 lignes *ce qu'on va faire* et
   *pourquoi*. Puis **attendre le « ok »** de l'étudiant. Pas de code avant.
4. **Après avoir codé** : expliquer simplement ce qui a été fait, puis donner
   **la procédure de test exacte** pour que l'étudiant voie le résultat de ses
   propres yeux (quelle commande, quelle URL, quoi cliquer, quoi observer).
5. **Choisir les outils les plus simples possible**, et **justifier** chaque
   choix (pourquoi celui-là et pas un autre).
6. Si l'étudiant dit **« explique encore »** → reformuler **plus simplement**,
   avec une image / une analogie, sans réutiliser le même jargon.
7. Tenir à jour `CLAUDE.md` et `JOURNAL.md` **à la fin de chaque étape**.

---

## 4. Le plan (ordre à suivre)

- [x] **Étape 0 — Préparer le projet vide et le lancer.** ✅ *11 août 2026*
      Créer le squelette, lancer un serveur de développement, voir une page
      blanche s'afficher dans le navigateur. Rien d'autre.
- [x] **Étape 1 — Dessiner (tout seul).** ✅ *11 août 2026*
      Canvas, outils (formes, texte, gomme, sélection), pan/zoom, undo/redo,
      export PNG + JSON.
- [x] **Étape 2 — Le temps réel.** ✅ *11 août 2026*
      Synchroniser les dessins et les curseurs entre 2 navigateurs ouverts.
- [x] **Étape 3 — Sauvegarde & rooms.** ✅ *11 août 2026*
      Boards enregistrés en base, URL unique par board, public/privé.
- [x] **Étape 4 — Comptes & partage.** ✅ *11 août 2026*
      Inscription/connexion, page « mes boards », partage avec droits.
- [~] **Étape 5 — Mise en ligne.** ← **en cours**
      Le **code est prêt** (PostgreSQL, port et cookies de production,
      documentation). Il reste les **clics** chez GitHub, Supabase/Neon et
      Render, qui demandent les comptes de l'étudiant.
      Guide complet : [`docs/deploiement.md`](docs/deploiement.md).
- [ ] **Étape 6 — Finitions.**
      Vidéo de démo (~3 min), rapport de stage.
      *(Les tests automatiques et la documentation technique sont déjà faits.)*

---

## 5. La stack technique

> **Stack = l'ensemble des technologies utilisées** pour construire le projet
> (le langage, les bibliothèques, la base de données, l'hébergeur…).

### Décidé

> Justification détaillée de **chaque** choix (et des options écartées) dans
> [`docs/choix-techniques.md`](docs/choix-techniques.md).

| Besoin | Choix | Pourquoi ce choix |
|---|---|---|
| Langage | **JavaScript** (pas TypeScript) | Une seule chose à apprendre à la fois. |
| Interface | **HTML/CSS/JS « vanilla »** (sans React) | Le dessin se fait sur un `<canvas>` : React ne simplifie rien là-dessus. Le sujet recommande React mais autorise « plain Canvas API ». |
| Outil de dev | **Vite** 8 | Serveur local + rechargement automatique. Une seule commande. |
| Moteur | **Node.js** v24.17.0, **npm** 11.13.0 | Déjà installés. |
| Versionnage | **Git** 2.54 | Exigé par le sujet. |
| Organisation | `client/` + `server/` + `shared/` | `shared/` contient la règle de fusion, importée **des deux côtés** : une seule vérité. |
| Serveur | **Node.js + Express 5** | Le plus simple et le plus courant. Même langage des deux côtés. |
| Temps réel | **Socket.IO** | Fournit la reconnexion automatique, les « rooms » et les accusés de réception — les trois nous servent. |
| Synchro | **LWW + horloge de Lamport**, par forme | Option (A). 30 lignes, entièrement compréhensible. Autorisé explicitement par le sujet. Yjs a été écarté : boîte noire pour un débutant. |
| Base de données (local) | **SQLite** via `node:sqlite` | Intégré à Node 24 : zéro dépendance, zéro compilation (contrairement à `better-sqlite3`). Un seul fichier. |
| Base de données (en ligne) | **PostgreSQL** via `pg` | Render efface le disque à chaque redéploiement : un fichier SQLite y serait perdu. Bascule automatique dès que `DATABASE_URL` existe. |
| Comptes | **session en base + cookie signé**, mot de passe **scrypt** | Un JWT ne peut pas être révoqué ; une session en base se supprime à la déconnexion. |
| Tests | `node --test` (intégré) + **jsdom** | Aucune dépendance de test lourde. jsdom permet de tester les pages sans navigateur. |
| Hébergement | **Render** (offre gratuite) + **Supabase/Neon** pour la base | Render gère les WebSockets et le HTTPS. Sa base PostgreSQL gratuite étant supprimée après 30 jours, la base vient d'ailleurs. Détails : [`docs/deploiement.md`](docs/deploiement.md). |

### Questions techniques ouvertes

*Aucune pour l'instant.* La question « (A) simple ou (B) Yjs » de l'étape 2 a
été tranchée en faveur de **(A)**, avec la justification complète dans
`docs/choix-techniques.md` §2.

---

## 6. Où on en est

**Étapes 0 à 4 terminées. Prochaine : étape 5 (mise en ligne), à faire
avec l'étudiant car elle demande ses comptes d'hébergement.**

Tout le produit fonctionne en local : dessin complet, temps réel, curseurs,
sauvegarde, comptes, partage.

- ✅ Étape 0 — squelette Vite + dépôt Git.
- ✅ Étape 1 — moteur de dessin complet (7 outils, pan/zoom, undo/redo,
  export PNG et JSON, import JSON).
- ✅ Étape 2 — temps réel (formes + curseurs avec pseudo et couleur),
  fusion sans conflit, reconnexion sans perte.
- ✅ Étape 3 — persistance SQLite, URL unique par board, public/privé.
- ✅ Étape 4 — comptes, page « mes boards », partage par email et par lien
  avec droits lecture/écriture.
- ✅ Tests : 25 tests unitaires, 27 vérifications de bout en bout,
  32 vérifications d'interface, test de charge à 6 participants. **Tous au
  vert.**
- ✅ Documentation : `README.md` (architecture + diagrammes de séquence) et
  `docs/choix-techniques.md`.
- ⏳ Reste : déploiement (étape 5), vidéo de démo, rapport de stage.

**Mesures relevées en local** — latence de synchronisation : 6 ms en moyenne,
9 ms au 95e centile avec 6 participants (le sujet demande moins de 200 ms).

**Arborescence**

```
C:\Stage_1337
├── .git/  .gitignore
├── CLAUDE.md          ← ce fichier
├── JOURNAL.md         ← carnet de bord
├── README.md          ← architecture + diagrammes (livrable du sujet)
├── SUBJECT.pdf
├── package.json       ← commandes globales (dev, test, e2e, load…)
├── docs/
│   └── choix-techniques.md   ← livrable « design choices »
├── shared/
│   └── merge.js       ← LA règle de fusion, utilisée client ET serveur
├── scripts/
│   ├── e2e.js         ← test de bout en bout (2 utilisateurs)
│   ├── smoke-home.js  ← test de la page d'accueil (DOM simulé)
│   ├── smoke-dom.js   ← test de la page tableau (DOM simulé)
│   └── load-test.js   ← test de charge (6 participants)
├── client/            ← navigateur
│   ├── index.html     ← page d'accueil (connexion + mes boards)
│   ├── board.html     ← page du tableau
│   ├── vite.config.js
│   ├── test/
│   └── src/
│       ├── api.js     ← appels HTTP au serveur
│       ├── style.css
│       ├── pages/     ← home.js, board.js
│       └── board/     ← camera, shapes, store, render, tools, net, exporters
└── server/            ← Node.js
    ├── .env.example   ← configuration à copier en .env
    ├── test/
    └── src/
        ├── index.js       ← démarrage
        ├── config.js      ← variables d'environnement
        ├── db.js          ← SQLite
        ├── auth.js        ← mots de passe, sessions
        ├── permissions.js ← qui a le droit de quoi
        ├── boards.js      ← boards et formes
        ├── routes.js      ← API HTTP
        ├── realtime.js    ← Socket.IO
        ├── rateLimit.js   ← limitation de débit
        └── ids.js
```

**Dossier du projet :** `C:\Stage_1337`
**Système :** Windows 11, terminal PowerShell.

---

## 7. Comment lancer le projet

**La première fois seulement :**

```powershell
cd C:\Stage_1337
npm run install:all
copy server\.env.example server\.env
```

**Ensuite, à chaque fois :**

```powershell
cd C:\Stage_1337
npm run dev
```

Puis ouvrir **http://localhost:5173/**.
Pour arrêter : `Ctrl + C` dans le terminal.

**Les autres commandes :**

| Commande | Effet |
|---|---|
| `npm test` | Tests unitaires (serveur + client) |
| `npm run e2e` | Test complet à 2 utilisateurs |
| `npm run smoke` | Test rapide des pages dans un navigateur simulé |
| `npm run browser` | **Test dans un vrai Chromium** — celui qui fait foi |
| `npm run load` | Test de charge à 6 participants |
| `npm run test:pg` | Vérifie le serveur sur un **vrai PostgreSQL** temporaire |
| `npm run build` | Compile le client pour la mise en ligne |
| `npm start` | Serveur seul, servant le client compilé (mode production) |

⚠️ `e2e`, `smoke`, `browser` et `load` ont besoin que le projet tourne :
lancer `npm run dev` dans un autre terminal.
Pour `browser`, télécharger Chromium une fois : `npx playwright install chromium`.

⚠️ **Leçon retenue (entrée 3 du journal)** : jsdom ne calcule aucune mise en
page. Tout ce qui touche à la **taille**, à la **superposition** ou à la
**priorité des règles CSS** doit être vérifié avec `npm run browser`.
