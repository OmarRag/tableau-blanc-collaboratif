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
| ⭐ | **Chat vocal (bonus)** | Parler avec les autres personnes du board (WebRTC) |

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
- [x] **Étape 5 — Mise en ligne.** ✅ *17 août 2026*
      Le site est en ligne sur
      **https://tableau-blanc-collaboratif.onrender.com**
      (Render + Neon PostgreSQL). Guide : [`docs/deploiement.md`](docs/deploiement.md).
- [ ] **Étape 6 — Finitions.** ← **prochaine étape**
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
| Connexion Google | **OAuth 2.0 écrit à la main** (~130 lignes), sans Passport ni bibliothèque | Deux requêtes HTTP et un décodage suffisent. Passport imposerait d'apprendre son système de « stratégies » pour le même résultat. Facultatif : sans les clés, le bouton disparaît. **En service** depuis le 21 août 2026 (projet Google Cloud dédié `tableau-blanc`). |
| Tests | `node --test` (intégré) + **jsdom** | Aucune dépendance de test lourde. jsdom permet de tester les pages sans navigateur. |
| Chat vocal (bonus) | **WebRTC en direct**, signalisation sur le Socket.IO existant | Le son ne passe pas par le serveur : aucun coût de bande passante, et rien à héberger en plus. En « mesh » (chacun relié à chacun), suffisant à quelques participants ; un serveur de mélange audio (« SFU ») serait hors sujet ici. |
| Relais audio (facultatif) | **STUN** (Google, gratuit) + **TURN** optionnel par variables d'environnement | STUN suffit dans la plupart des cas. TURN relaie le son quand la connexion directe est impossible (4G ↔ pare-feu d'entreprise) ; payant, donc facultatif et jamais écrit dans le code. La liste est servie par `/api/boards/:id/ice`, route protégée comme le board. |
| Hébergement | **Render** (offre gratuite, région Frankfurt) | Gère les WebSockets et fournit le HTTPS. |
| Base en ligne | **Neon PostgreSQL** (offre gratuite, région Frankfurt) | Base `tableau_blanc`, *connection pooling* activé. Même région que Render pour limiter la latence. La base gratuite de Render étant supprimée après 30 jours, elle a été écartée. |

### Questions techniques ouvertes

*Aucune pour l'instant.* La question « (A) simple ou (B) Yjs » de l'étape 2 a
été tranchée en faveur de **(A)**, avec la justification complète dans
`docs/choix-techniques.md` §2.

---

## 6. Où on en est

**Étapes 0 à 5 terminées. Le site est EN LIGNE.
Prochaine : étape 6 (vidéo de démo + rapport de stage).**

🔗 **https://tableau-blanc-collaboratif.onrender.com**
📦 **https://github.com/OmarRag/tableau-blanc-collaboratif**

- ✅ Étape 0 — squelette Vite + dépôt Git.
- ✅ Étape 1 — moteur de dessin complet (7 outils, pan/zoom, undo/redo,
  export PNG et JSON, import JSON).
- ✅ Étape 2 — temps réel (formes + curseurs avec pseudo et couleur),
  fusion sans conflit, reconnexion sans perte.
- ✅ Étape 3 — persistance, URL unique par board, public/privé.
- ✅ Étape 4 — comptes (email/mot de passe **et Google**), page « mes
  boards », partage par email et par lien avec droits lecture/écriture.
- ✅ Étape 5 — en ligne sur Render (Frankfurt) + Neon PostgreSQL (Frankfurt),
  HTTPS, limitation de débit, configuration par variables d'environnement.
- ✅ Tests : 49 tests unitaires, 35 vérifications de bout en bout,
  39 vérifications d'interface, 22 dans un vrai Chromium, 19 sur un vrai
  PostgreSQL, 24 sur la connexion Google, 23 sur le chat vocal (2 navigateurs
  réels), test de charge à 6 participants.
  **Tous au vert.**
- ✅ Documentation : `README.md` (architecture + diagrammes de séquence),
  `docs/choix-techniques.md`, `docs/deploiement.md`.
- ✅ Connexion Google **en service en local** avec les vraies clés
  (projet Google Cloud dédié `tableau-blanc`, testée dans un vrai navigateur).
- ✅ **Bonus : chat vocal (WebRTC)** entre les personnes du même board —
  pair-à-pair, signalisation sur la connexion Socket.IO existante.
  Support **TURN** optionnel (`TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`)
  pour les réseaux où la liaison directe est impossible ; sans ces variables,
  STUN seul, comme avant.
- ⏳ Reste : **les 2 variables Google à poser dans Render**, vidéo de démo
  (~3 min), rapport de stage.

**État exact de la connexion Google** *(détail : `JOURNAL.md`, entrée 7)*

| | État |
|---|---|
| Projet Google Cloud **séparé et dédié** : `tableau-blanc` | ✅ Fait |
| Client OAuth dédié, type **« Application Web »** | ✅ Fait |
| Écran de consentement : **External**, en **mode test** | ✅ Fait |
| Les **2 adresses de retour** déclarées dans la Console | ✅ Fait — **rien à ajouter** |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` dans `server/.env` | ✅ Fait (local) |
| Connexion testée en local dans un vrai navigateur | ✅ Fait |
| Les 2 mêmes variables dans **Render → Environment** | ⏳ **À faire** |
| Redéploiement de Render | ⏳ **À faire** |

Les 2 adresses de retour déclarées, pour mémoire :

```
http://localhost:3000/auth/google/callback
https://tableau-blanc-collaboratif.onrender.com/auth/google/callback
```

⚠️ Le projet Google est **volontairement séparé** de celui d'un autre travail
(`RDV_reunion`) : un projet Google = une application, sinon retirer une clé
pour l'un casserait l'autre.

⚠️ L'écran de consentement étant **en mode test**, seuls les comptes Google
inscrits dans la liste **« Test users »** de la Console peuvent se connecter
(100 maximum). À préparer **avant** la vidéo de démo, sinon Google affichera
« Accès bloqué ».

⚠️ Les **valeurs** des deux clés ne sont écrites que dans `server/.env`, qui
est ignoré par Git. Aucun fichier suivi par Git ne doit jamais contenir autre
chose que les **noms** des variables.

⚠️ **Si un déploiement Render échoue au démarrage sur une erreur PostgreSQL**
(`exited with status 1`) : ce n'est **pas** la migration du schéma Google —
vérifié sur la vraie base Neon, sur une base à l'ancien schéma remplie de
comptes, et en rejouant toute la chaîne Render. La cause est la **connexion** :
`DATABASE_URL` dans Render pointe sur un projet Neon supprimé ou recréé.
Depuis le 21 août 2026, le serveur affiche la cause en clair dans le journal
(mot de passe masqué) au lieu d'une pile d'appels — détail : `JOURNAL.md`,
entrée 8.

⚠️ **Chat vocal : le micro n'est autorisé qu'en « contexte sécurisé ».** Les
navigateurs ne donnent accès au micro que sur **HTTPS** ou sur
**`localhost`**. En local, `http://localhost:5173` fonctionne ; mais ouvrir le
site depuis un autre poste du réseau (`http://192.168.x.x:5173`) fera échouer
le micro, avec le message d'erreur prévu. En ligne, Render est en HTTPS :
aucun problème.

**Deux limites de l'hébergement gratuit à ne pas oublier**

1. Le serveur **s'endort après 15 min** sans visite ; le réveil prend
   30 à 50 s. Ouvrir le site une minute avant toute démonstration.
2. Render a été branché en mode **« Public Git Repository »** (GitHub était en
   panne le jour du déploiement), donc il n'est **pas** connecté au dépôt :
   après chaque `git push`, il faut cliquer *Manual Deploy → Deploy latest
   commit* dans Render. À rebrancher sur GitHub pour retrouver le
   déploiement automatique.

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
│   ├── test-voice.js  ← test du chat vocal (2 Chromium, faux micro)
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
│       └── board/     ← camera, shapes, store, render, tools, net, exporters, voice
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
| `npm run test:google` | Vérifie la connexion Google sans compte Google |
| `npm run voice` | **Chat vocal** : 2 Chromium avec un faux micro, appel complet |
| `npm run build` | Compile le client pour la mise en ligne |
| `npm start` | Serveur seul, servant le client compilé (mode production) |

⚠️ `e2e`, `smoke`, `browser` et `load` ont besoin que le projet tourne :
lancer `npm run dev` dans un autre terminal.
Pour `browser`, télécharger Chromium une fois : `npx playwright install chromium`.

⚠️ **Leçon retenue (entrée 3 du journal)** : jsdom ne calcule aucune mise en
page. Tout ce qui touche à la **taille**, à la **superposition** ou à la
**priorité des règles CSS** doit être vérifié avec `npm run browser`.
