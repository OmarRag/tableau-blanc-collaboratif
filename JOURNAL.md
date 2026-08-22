# JOURNAL.md — Carnet de bord

> Un carnet de bord = le récit de ce qu'on a fait, jour après jour.
> Il sert à deux choses : reprendre le travail après une pause, et
> **écrire le rapport de stage** à la fin.
>
> À chaque fin d'étape, on ajoute une entrée avec toujours les mêmes 4 parties :
> **ce qui a été fait**, **les choix techniques et pourquoi**,
> **les problèmes et comment on les a résolus**, **comment lancer le projet**.

---

## Sommaire

| Étape | Titre | État |
|---|---|---|
| — | Mise en place du suivi | ✅ Fait |
| 0 | Préparer le projet vide et le lancer | ✅ Fait |
| 1 | Dessiner (tout seul) | ✅ Fait |
| 2 | Le temps réel | ✅ Fait |
| 3 | Sauvegarde & rooms | ✅ Fait |
| 4 | Comptes & partage | ✅ Fait |
| — | Correction de 3 bugs bloquants + test navigateur réel | ✅ Fait |
| 5 | Mise en ligne | ✅ Fait — site en ligne |
| — | Connexion avec Google (OAuth 2.0) | ✅ Fait |
| — | Mise en service des vraies clés Google | ✅ Fait en local — reste Render |
| — | Déploiement Render en échec : diagnostic de la base | ✅ Corrigé |
| ⭐ | Bonus : chat vocal entre participants (WebRTC) | ✅ Fait |
| ⭐ | Chat vocal : relais TURN pour les réseaux difficiles | ✅ Fait |
| — | Chat vocal : l'indicateur « qui parle » restait muet | ✅ Corrigé |
| ⭐ | **Chat vocal validé EN LIGNE en 4G** (réseaux différents) | ✅ Confirmé |
| 6 | Finitions : vidéo démo, rapport | ⏳ À venir (tests et doc déjà faits) |

---

## Entrée 0 — Mise en place du suivi

**Date :** 11 août 2026
**Étape :** préparation (avant l'étape 0)

### Ce qui a été fait

- Création du dossier de travail `C:\Stage_1337`.
- Création de `CLAUDE.md` : contexte du projet, règles de travail, plan en
  7 étapes, stack proposée, section « où on en est ».
- Création de `JOURNAL.md` (ce fichier).
- Aucun code écrit, aucun outil installé.

### Les choix techniques et pourquoi

Aucune technologie n'est encore **décidée**. Une stack est seulement
**proposée** dans `CLAUDE.md`, avec la justification de chaque choix. Elle sera
validée choix par choix, au moment où on en a réellement besoin.

Principe directeur retenu pour tout le projet : **choisir l'outil le plus
simple qui fait le travail**, quitte à écrire un peu plus de code soi-même.
Raison : l'objectif du stage est de **comprendre** le projet pour pouvoir le
refaire seul. Un outil qui fait tout automatiquement fait gagner du temps,
mais empêche d'apprendre ce qui se passe en dessous.

Deuxième principe : **une seule étape à la fois**, chaque étape se terminant
par quelque chose de visible et testable à l'écran. Raison : on voit le projet
avancer, et quand un bug apparaît on sait qu'il vient de la dernière étape.

### Les problèmes rencontrés et comment on les a résolus

- **Problème :** le dossier `C:\Stage_1337` contient un fichier `SUBJECT.pdf`
  (le sujet officiel du stage) qui n'a pas pu être lu — l'outil de rendu PDF
  (`poppler`) n'est pas installé sur la machine.
- **Conséquence :** le projet est décrit uniquement à partir de l'énoncé oral
  de l'étudiant. Un détail du sujet officiel pourrait manquer.
- **Résolution :** en attente. Solution envisagée : copier-coller le texte du
  PDF, ou installer l'outil manquant.

### Comment lancer le projet

Rien à lancer pour l'instant : il n'y a pas encore de code.

---

## Entrée 1 — Étape 0 : préparer le projet vide et le lancer

**Date :** 11 août 2026
**Étape :** 0 — terminée

### Ce qui a été fait

- **Lecture de `SUBJECT.pdf`** (le blocage de l'entrée 0 est levé). Le sujet
  confirme le projet décrit oralement et ajoute : dépôt Git + `README.md` avec
  diagramme de séquence, vidéo de démo de 3 min, document de choix techniques,
  outils « main levée » et « flèche », curseurs avec pseudo et couleur,
  limitation de débit et variables d'environnement au déploiement, test de
  charge à 5 utilisateurs. Le barème met **20 % sur la qualité du code et les
  tests** : il faudra écrire quelques tests automatiques.
- Vérification des outils déjà présents sur la machine : Node.js v24.17.0,
  npm 11.13.0, Git 2.54.
- Création du dossier `client/` contenant le squelette d'un projet Vite :
  `index.html`, `src/main.js`, `src/style.css`, `package.json`.
- Installation de Vite 8.2.1 (`npm install -D vite`).
- Initialisation du dépôt Git à la racine et création du `.gitignore`.
- Lancement et test du serveur de développement : la page répond en HTTP 200
  sur `http://localhost:5173/` et s'affiche blanche.

### Les choix techniques et pourquoi

- **Squelette écrit à la main plutôt que `npm create vite`.** La commande
  officielle génère une page de démonstration (logo, compteur) qu'il aurait
  fallu supprimer, et refuse de s'installer dans un dossier déjà occupé par
  `CLAUDE.md` et `SUBJECT.pdf`. Écrire les 4 fichiers soi-même donne exactement
  le même résultat, en plus court, et on comprend à quoi sert chaque fichier.
- **Un dossier `client/` séparé dès maintenant.** Le serveur temps réel
  (étape 2) aura ses propres dépendances et son propre `package.json`. Le
  placer plus tard dans `server/` sans avoir prévu `client/` aurait obligé à
  déplacer tous les fichiers et à réécrire l'historique Git.
- **CSS de remise à zéro (`margin: 0`, `height: 100%`, `overflow: hidden`)
  dès l'étape 0.** Sans cela, le navigateur laisse une marge blanche autour de
  la page et affiche des barres de défilement — deux problèmes qui cassent un
  canvas censé occuper tout l'écran à l'étape 1.
- **Pas de commit pour l'instant.** Le dépôt est prêt mais vide ; le premier
  commit sera fait quand l'étudiant aura validé l'affichage de la page.

### Les problèmes rencontrés et comment on les a résolus

- **Problème :** `SUBJECT.pdf` illisible à l'entrée 0.
  **Résolu :** le PDF a pu être lu directement, sans installer d'outil.
  Le contenu est résumé dans la section 2 de `CLAUDE.md`.
- **Problème :** le plan initial ne prévoyait aucun test automatique, alors
  qu'ils comptent dans les 20 % « qualité du code » du barème.
  **Résolu :** noté dans `CLAUDE.md`, à intégrer à l'étape 6.

### Comment lancer le projet

```powershell
cd C:\Stage_1337\client
npm run dev
```

Ouvrir **http://localhost:5173/**. Arrêter avec `Ctrl + C`.

---

## Entrée 2 — Étapes 1 à 4 : le produit complet en local

**Date :** 11 août 2026
**Étapes :** 1 (dessin), 2 (temps réel), 3 (sauvegarde & rooms),
4 (comptes & partage) — terminées.

> Changement de méthode demandé par l'étudiant : construire tout le projet
> d'un seul tenant, sans validation intermédiaire, en notant les choix
> techniques ici pour les passer en revue ensemble plus tard.

### Ce qui a été fait

**Étape 1 — le moteur de dessin** (`client/src/board/`)

- `camera.js` : canvas infini, déplacement de la vue et zoom (deux systèmes de
  coordonnées, « monde » et « écran »).
- `shapes.js` : les 5 types de formes (rectangle, ellipse, flèche, main levée,
  texte) — dessin, boîte englobante, et *hit-testing* (« ce clic touche-t-il
  cette forme ? »).
- `store.js` : la liste des formes, l'horloge de synchronisation et
  l'historique undo/redo.
- `render.js` : boucle d'affichage à 60 images/seconde, quadrillage de fond,
  cadre de sélection, curseurs des autres.
- `tools.js` : souris et clavier — 7 outils, sélection au lasso, déplacement,
  raccourcis clavier, saisie de texte.
- `exporters.js` : export PNG (recadré sur le dessin, pas sur l'écran),
  export et import JSON.

**Étape 2 — le temps réel** (`server/src/realtime.js`, `client/src/board/net.js`)

- Socket.IO, une « room » par board.
- Curseurs des autres avec pseudo et couleur.
- Fusion des modifications concurrentes (voir ci-dessous).
- File d'attente d'envoi côté navigateur : on continue de dessiner hors ligne,
  tout est renvoyé et fusionné à la reconnexion.

**Étape 3 — sauvegarde & rooms** (`server/src/db.js`, `boards.js`)

- Base SQLite, une ligne par forme, URL unique par board (`/b/<id>`),
  boards publics ou privés.

**Étape 4 — comptes & partage** (`server/src/auth.js`, `permissions.js`)

- Inscription/connexion email + mot de passe, page « mes boards ».
- Partage par email ou par lien, avec droits « peut regarder » / « peut
  dessiner », et régénération du lien.

**En plus (demandé par le sujet, pas par le plan initial)**

- 25 tests unitaires, un test de bout en bout (27 vérifications), un test
  d'interface dans un navigateur simulé (32 vérifications), un test de charge
  à 6 participants.
- `README.md` avec l'architecture et deux diagrammes de séquence.
- `docs/choix-techniques.md`, le document de justification exigé.
- Limitation de débit et configuration par variables d'environnement.

### Les choix techniques et pourquoi

> Version détaillée, avec les options écartées : `docs/choix-techniques.md`.

1. **Synchronisation : « la dernière écriture gagne » avec horloge de
   Lamport**, plutôt que Yjs (CRDT) ou OT.
   *Pourquoi :* 30 lignes de code entièrement compréhensibles, contre une
   bibliothèque de 50 000 lignes impossible à expliquer ou déboguer. Sur un
   tableau blanc l'unité de travail est la forme entière, pas le caractère :
   deux personnes travaillent presque toujours sur des formes différentes, et
   le conflit réel est rare. Le sujet autorise explicitement cette approche.

2. **Une horloge de Lamport plutôt que l'heure de la machine.**
   *Pourquoi :* si on comparait `Date.now()`, un ordinateur dont l'horloge
   avance de 30 s gagnerait tous les conflits, même contre des modifications
   faites après les siennes. L'horloge de Lamport est un compteur qui mesure
   la causalité, pas le temps.

3. **La règle de fusion est dans `shared/`, importée par le client ET le
   serveur.**
   *Pourquoi :* deux implémentations séparées finiraient par diverger sur un
   détail, et la divergence serait invisible jusqu'à ce que deux navigateurs
   affichent des dessins différents.

4. **SQLite via `node:sqlite`** plutôt que PostgreSQL ou `better-sqlite3`.
   *Pourquoi :* intégré à Node 24 → zéro dépendance et zéro compilation C++
   (`better-sqlite3` échoue souvent à s'installer sous Windows). Un seul
   fichier de base. Limite connue : ne fonctionne que sur un seul serveur ;
   c'est suffisant ici, et l'accès aux données est isolé dans un seul fichier
   pour rendre une migration facile.

5. **Session en base + cookie signé** plutôt que JWT.
   *Pourquoi :* un JWT ne peut pas être révoqué avant son expiration — se
   déconnecter ne déconnecterait pas vraiment. Une session est une ligne
   qu'on supprime.

6. **Regroupement des envois toutes les 40 ms**, en ne gardant que la
   dernière version de chaque forme.
   *Pourquoi :* dessiner génère ~200 événements souris par seconde ; on tombe
   à 25 messages. Ne garder que la dernière version ne perd rien, puisque la
   règle est justement « la dernière gagne ». Les deux décisions se
   renforcent.

7. **Ordre d'empilement fixé par un champ `z`** (valeur de l'horloge à la
   création) plutôt que par l'ordre d'arrivée des messages.
   *Pourquoi :* sinon deux navigateurs pourraient afficher le rectangle rouge
   devant le bleu chez l'un et l'inverse chez l'autre.

8. **Undo/redo local et non partagé.**
   *Pourquoi :* le sujet le demande, et c'est ce qu'attend l'utilisateur —
   `Ctrl+Z` doit annuler *mon* dernier trait, pas celui du voisin.

9. **`node --test` (intégré à Node) + jsdom** plutôt que Jest ou Vitest.
   *Pourquoi :* zéro dépendance de test à installer et à configurer.

### Les problèmes rencontrés et comment on les a résolus

- **Problème :** `node --watch` redémarrait le serveur en boucle.
  **Cause :** le mode surveillance regardait aussi le fichier de base de
  données, modifié à chaque écriture.
  **Résolu :** `node --watch-path=./src` — on ne surveille que le code.

- **Problème :** le serveur renvoyait le jeton du lien de partage à **tous**
  les visiteurs, y compris ceux en lecture seule. Un simple lecteur pouvait
  donc récupérer le lien d'écriture.
  **Résolu :** le jeton n'est renvoyé qu'au propriétaire (`viewBoard()` dans
  `routes.js`).

- **Problème :** à la resynchronisation, une suppression envoyée par le
  serveur portait une horloge volontairement énorme, qui contaminait
  l'horloge locale du navigateur et cassait toute la synchronisation ensuite.
  **Résolu :** une méthode dédiée `forceRemove()` qui supprime la forme sans
  passer par la règle de fusion.

- **Problème :** les opérations déjà envoyées mais non encore confirmées
  étaient perdues si la connexion tombait pile à ce moment-là.
  **Résolu :** à la déconnexion, elles retournent dans la file d'attente.

- **Problème :** une forme supprimée pouvait réapparaître si une modification
  en retard arrivait après la suppression.
  **Résolu :** les suppressions laissent une « pierre tombale » en base (ligne
  conservée avec `deleted = 1`) au lieu d'effacer la ligne. Vérifié par un
  test.

- **Problème :** impossible de tester l'interface — aucun navigateur
  automatisable sur la machine.
  **Résolu :** un navigateur simulé (jsdom) auquel on fournit un faux contexte
  de dessin qui **compte les appels**. On peut ainsi affirmer « le rectangle a
  bien été tracé » et simuler des clics de souris, sans écran.

### Résultats mesurés

| Mesure | Résultat | Exigence du sujet |
|---|---|---|
| Latence de synchronisation (6 participants) | 6 ms en moyenne, 9 ms au 95e centile | < 200 ms ✅ |
| Formes perdues sur 240 envoyées simultanément | 0 | aucune perte ✅ |
| Formes en double | 0 | aucun doublon ✅ |
| Tests | 25 unitaires + 27 e2e + 32 interface + charge, tous au vert | — |

### Comment lancer le projet

```powershell
cd C:\Stage_1337
npm run install:all                      # la première fois seulement
copy server\.env.example server\.env     # la première fois seulement
npm run dev
```

Ouvrir **http://localhost:5173/**. Arrêter avec `Ctrl + C`.

---

## Entrée 3 — Trois bugs bloquants, et pourquoi les tests ne les voyaient pas

**Date :** 11 août 2026
**Étape :** correction, avant l'étape 5

### Ce qui a été fait

Trois bugs signalés par l'étudiant en utilisant vraiment l'application :

1. **Aucun outil de dessin ne fonctionnait.** Cliquer-glisser sur le tableau
   ne produisait rien, quel que soit l'outil.
2. Le bouton **« Fermer »** de la fenêtre de partage ne la fermait pas.
3. Le menu **« Exporter »** restait affiché en permanence.

Les trois sont corrigés. Un quatrième niveau de test a été ajouté :
`npm run browser`, qui pilote un **vrai Chromium** avec Playwright.

### Les causes, et pourquoi elles étaient invisibles

**Bug 1 — le canvas mesurait 300 × 150 pixels.**

Le CSS disait :

```css
#board { position: fixed; inset: 0; }
```

Sur une `<div>`, `inset: 0` suffit à occuper tout l'écran. Mais un `<canvas>`
est un **élément remplacé** (comme `<img>` ou `<video>`) : sa taille
automatique est sa taille *intrinsèque*, soit 300 × 150 pixels. Le canvas
restait donc un petit rectangle en haut à gauche, invisible car blanc sur
blanc, et **tous les clics passaient à côté**.

*Correction :* ajouter `width: 100%; height: 100%`.

**Bugs 2 et 3 — l'attribut `hidden` était neutralisé par notre propre CSS.**

Le navigateur applique l'attribut HTML `hidden` avec une règle ordinaire :
`[hidden] { display: none }`. Or les règles écrites dans **notre** feuille de
style l'emportent toujours sur celles du navigateur. Comme on avait
`.modal { display: grid }` et `.popover { display: flex }`, l'attribut `hidden`
n'avait plus aucun effet : le JavaScript faisait bien son travail, mais rien ne
changeait à l'écran.

*Correction :* `[hidden] { display: none !important }`, plus la fermeture par
la touche Échap et par un clic en dehors de la fenêtre.

**Bug 4 (trouvé au passage) — l'outil texte perdait le focus.**

Après un clic, le navigateur déplace le focus vers la page une fois nos
gestionnaires terminés. La zone de saisie créée était donc immédiatement
« défocalisée », donc fermée, donc vide.

*Correction :* `event.preventDefault()` sur le clic, et focus donné à l'image
suivante (`requestAnimationFrame`), le détecteur de perte de focus n'étant
branché qu'après.

### La vraie leçon : jsdom ne calcule aucune mise en page

Les 28 vérifications jsdom passaient au vert **alors que l'application était
inutilisable**. Trois angles morts, tous de la même famille :

| Ce que jsdom ne fait pas | Bug non détecté |
|---|---|
| Calculer la taille des éléments | canvas à 300 × 150 |
| Gérer la superposition et le routage des clics | clics perdus |
| Appliquer la priorité « notre CSS > CSS du navigateur » | fenêtres impossibles à fermer |

Pire : le test jsdom **simulait** une taille de canvas de 1280 × 720 pour
pouvoir fonctionner, ce qui masquait précisément le bug n°1.

**Règle retenue pour la suite :** tout ce qui touche à la taille, à la
superposition ou à la priorité des règles CSS se vérifie avec
`npm run browser`. jsdom reste utile — il est instantané et sans dépendance —
mais **c'est Chromium qui fait foi**.

### Le nouveau test navigateur

`scripts/browser-test.js` (22 vérifications) reproduit le parcours complet d'un
utilisateur : inscription, création d'un board, dessin avec les 7 outils,
gomme, déplacement, `Ctrl+Z`, ouverture et fermeture des fenêtres. Il ajoute
deux choses qu'aucun autre test ne faisait :

- il **lit la console du navigateur** et échoue s'il y a la moindre erreur ;
- il vérifie **quel élément se trouve réellement sous la souris** au milieu de
  l'écran — c'est ce contrôle qui a identifié le bug du canvas en une seconde.

Il enregistre aussi une capture d'écran (`scripts/derniere-capture.png`), utile
pour la vidéo de démo et le rapport.

### Comment tester

```powershell
cd C:\Stage_1337
npm run dev            # dans un premier terminal
npm run browser        # dans un second
```

---

## Entrée 4 — Étape 5 : préparation de la mise en ligne

**Date :** 14 août 2026
**Étape :** 5 — code prêt ; il reste les clics chez les hébergeurs.

### Ce qui a été fait

- **Double moteur de base de données.** Le serveur utilise PostgreSQL si la
  variable `DATABASE_URL` est fournie, et SQLite sinon. Aucun autre réglage à
  changer pour passer du local à la production.
- **Serveur prêt pour l'hébergeur** : écoute de `process.env.PORT` sur
  `0.0.0.0`, confiance au proxy HTTPS, cookies sécurisés, refus de démarrer
  sans vrai `SESSION_SECRET`, arrêt propre sur `SIGTERM`, adresse `/healthz`.
- **Deux nouveaux tests** : `npm run test:pg` (vrai PostgreSQL, 19
  vérifications) et le test navigateur rejoué contre le **client compilé** en
  mode production (22 vérifications).
- Documentation : `docs/deploiement.md`, `server/.env.example` réécrit,
  `README.md` mis à jour.

### Les choix techniques et pourquoi

**Pourquoi PostgreSQL en ligne alors que SQLite marche très bien ?**
Render efface le disque du service à chaque redéploiement. Un fichier SQLite y
serait perdu à chaque mise à jour du code : tous les comptes et tous les
dessins disparaîtraient. PostgreSQL vit sur une autre machine.

**Pourquoi Supabase ou Neon plutôt que la base PostgreSQL de Render ?**
Render en propose une gratuitement, mais **elle est supprimée au bout de
30 jours**. Supabase et Neon n'ont pas cette limite. Le stage dure 8 semaines :
la base de Render expirerait avant la soutenance.

**Pourquoi garder SQLite en local ?** Zéro installation, zéro service à
démarrer, et les tests tournent en une seconde. Obliger à installer PostgreSQL
sur la machine de développement compliquerait le projet sans rien apporter.

**Pourquoi une couche `all` / `get` / `run` plutôt qu'un ORM ?** Un ORM (outil
qui écrit le SQL à notre place) est une grosse boîte noire, à rebours de
l'objectif du stage. Ici, la couche de compatibilité fait 40 lignes : les
requêtes s'écrivent avec des `?`, traduits en `$1, $2…` pour PostgreSQL à un
seul endroit.

**Pourquoi la règle de fusion est-elle passée dans le SQL ?** C'est le point le
plus important de cette étape. Avant, le serveur faisait « je lis la forme, je
compare les horloges, j'écris ». Avec SQLite c'était sûr, car tout était
instantané. Avec PostgreSQL chaque accès est **asynchrone** : deux opérations
sur la même forme peuvent s'entrelacer, et la mauvaise version peut gagner —
exactement le genre de perte de mise à jour que le sujet note à 25 %.
La comparaison est donc faite maintenant dans la requête d'écriture, en une
seule instruction atomique (`ON CONFLICT … DO UPDATE … WHERE … RETURNING`).
Un test compare cette règle SQL à celle de `shared/merge.js` sur cinq cas,
pour qu'elles ne divergent jamais.

### Les problèmes rencontrés et comment on les a résolus

- **Problème :** les dates (`Date.now()`, ~1 750 000 000 000) dépassent la
  capacité d'un `INTEGER` PostgreSQL, limité à ~2,1 milliards.
  **Résolu :** le schéma utilise `BIGINT` quand le moteur est PostgreSQL.
- **Problème :** le pilote PostgreSQL renvoie les `BIGINT` sous forme de
  **texte** (pour ne pas perdre de précision sur de très grands nombres). Les
  dates devenaient des chaînes de caractères et les tris étaient faux.
  **Résolu :** reconversion en nombre au démarrage
  (`pg.types.setTypeParser`), plus un test qui vérifie le type reçu.
- **Problème :** Render met `NODE_ENV=production`, ce qui fait sauter les
  dépendances de développement à l'installation — donc Vite, donc la
  compilation du client échouerait.
  **Résolu :** `install:all` force `--include=dev` côté client.
- **Problème :** une adresse `/api/...` inconnue renvoyait la page d'accueil en
  HTML au lieu d'une erreur JSON, ce qui aurait donné des messages
  incompréhensibles côté navigateur.
  **Résolu :** une route 404 JSON avant le renvoi vers le client compilé.
- **Problème :** impossible de tester PostgreSQL sans compte chez un hébergeur
  ni Docker sur la machine.
  **Résolu :** le paquet `embedded-postgres` télécharge les binaires officiels
  de PostgreSQL et démarre une base réelle dans un dossier temporaire, effacée
  à la fin. Le test tourne sur **PostgreSQL 18.4**, pas sur une imitation.

### Comment lancer le projet

Inchangé en local (`npm run dev`). Deux vérifications supplémentaires :

```powershell
npm run test:pg        # le serveur sur un vrai PostgreSQL
npm run build          # puis npm start, et npm run browser
```

---

### Ajout à l'entrée 4 — un dernier problème trouvé en enchaînant les tests

**Symptôme :** chaque script de test passait au vert isolément, mais
`npm run smoke` échouait systématiquement quand il était lancé **juste après**
`npm run e2e`.

**Cause :** la limitation de débit faisait exactement son travail. Le seau à
jetons des connexions contient 10 jetons et se remplit d'un jeton toutes les
10 secondes. Le test de rafale de `e2e` le vide volontairement, et les scripts
suivants — venant de la même adresse IP — étaient refusés pendant deux minutes.
Le vrai défaut n'était donc pas la limitation, mais le fait qu'elle était
**écrite en dur dans le code** : impossible à ajuster sans modifier `routes.js`.

**Résolu en deux temps :**

1. Les seuils passent en variables d'environnement
   (`RATE_LIMIT_API_CAPACITY`, `RATE_LIMIT_API_REFILL`,
   `RATE_LIMIT_AUTH_CAPACITY`, `RATE_LIMIT_AUTH_REFILL`). Les valeurs par
   défaut restent celles de la production. En local, `.env` assouplit
   uniquement la vitesse de recharge des connexions. C'est aussi ce que le
   sujet demande : « configuration par variables d'environnement ».
2. Le test de rafale de `e2e` joue désormais l'attaquant depuis `127.0.0.1`
   au lieu de `localhost` (`::1`) — deux adresses différentes, donc deux seaux
   différents. Une vérification supplémentaire confirme au passage que le
   blocage **ne touche que l'attaquant** et laisse passer les autres
   utilisateurs, ce qui n'était pas testé jusque-là.

**Leçon :** un test qui passe seul mais échoue en série révèle souvent un
couplage caché. Ici, la suite complète est maintenant vérifiée enchaînée, et
plus seulement script par script.

---

## Entrée 5 — Étape 5 terminée : le site est en ligne

**Date :** 17 août 2026
**Étape :** 5 — terminée

### Ce qui a été fait

Le tableau blanc est accessible publiquement, en HTTPS :

🔗 **https://tableau-blanc-collaboratif.onrender.com**

| Élément | Choix retenu |
|---|---|
| Serveur | **Render**, offre gratuite, région **Frankfurt** |
| Base de données | **Neon PostgreSQL**, offre gratuite, base `tableau_blanc`, *connection pooling* activé, région **Frankfurt** |
| Base en développement | **SQLite** — inchangé |
| Surveillance | `/healthz` |
| Dépôt | https://github.com/OmarRag/tableau-blanc-collaboratif |

Trois variables d'environnement sont configurées dans Render :
`DATABASE_URL`, `SESSION_SECRET` et `NODE_ENV=production`. **Leurs valeurs ne
sont écrites nulle part dans le dépôt** — le code ne connaît que leurs noms,
et `server/.env.example` ne contient que des exemples. C'est exactement ce que
le sujet demande par « configuration par variables d'environnement ».

### Les choix techniques et pourquoi

**Pourquoi Neon plutôt que Supabase ?** Les deux offrent une base PostgreSQL
gratuite sans date d'expiration. Neon a été préféré parce que son adresse de
connexion fonctionne telle quelle depuis Render. Supabase impose de passer par
son « Session pooler » : sa connexion directe n'est joignable qu'en IPv6, que
Render ne gère pas — un piège invisible tant qu'on n'a pas essayé.

**Pourquoi le *connection pooling* ?** Un « pool » est une réserve de
connexions déjà ouvertes, prêtées puis rendues. Ouvrir une connexion à une
base coûte cher ; les offres gratuites en limitent d'ailleurs sévèrement le
nombre. Le pilote côté serveur est déjà réglé sur 5 connexions maximum, et
Neon ajoute son propre pool en façade.

**Pourquoi les deux services dans la même région (Frankfurt) ?** Le serveur
interroge la base à chaque dessin enregistré. Si la base était en Virginie et
le serveur en Allemagne, chaque requête paierait un aller-retour
transatlantique (~90 ms). Côte à côte, cela coûte quelques millisecondes. Le
sujet exige moins de 200 ms de latence perçue : c'est un choix qui compte.

### Les problèmes rencontrés et comment on les a résolus

- **Problème :** **GitHub était en panne** le jour du déploiement. Render ne
  pouvait donc pas se connecter au compte GitHub pour lire le dépôt.
  **Résolu :** utilisation de l'option **« Public Git Repository »** de
  Render, qui lit un dépôt public par son adresse, sans passer par le compte.
  **Conséquence à retenir :** Render n'est pas relié au dépôt, donc il ne se
  redéploie **pas** tout seul après un `git push`. Il faut cliquer
  *Manual Deploy → Deploy latest commit*. À rebrancher sur GitHub dès que
  possible pour retrouver le déploiement automatique.

- **Limite de l'offre gratuite :** l'instance **s'endort après 15 minutes**
  sans visite, et le réveil prend **30 à 50 secondes**. Ce n'est pas un bug,
  c'est la contrepartie de la gratuité. À prévoir pour la vidéo de démo et
  pour la soutenance : ouvrir le site une minute à l'avance. Ce point est
  écrit en haut du `README.md` pour que personne ne croie à une panne.

### Comment lancer le projet

En local, rien ne change (`npm run dev` → http://localhost:5173/). Pour
vérifier que le site en ligne répond :

```powershell
curl https://tableau-blanc-collaboratif.onrender.com/healthz
```

Réponse attendue : `{"ok":true}`.

---

## Entrée 6 — Connexion avec Google (OAuth 2.0)

**Date :** 17 août 2026
**Étape :** ajout demandé après l'étape 5

### Ce qui a été fait

Un bouton **« Continuer avec Google »** s'ajoute sous le formulaire de
connexion. L'email/mot de passe existant n'a pas bougé.

- `server/src/oauthGoogle.js` — le trajet complet, en ~130 lignes.
- `server/src/auth.js` — `findOrCreateGoogleUser` : crée le compte, ou le
  relie à un compte email déjà existant.
- `server/src/db.js` — nouvelle colonne `google_id` ajoutée **sans toucher aux
  données existantes** (la base en ligne contient de vrais comptes).
- `client/src/pages/home.js` — le bouton, affiché seulement si le serveur
  annonce que Google est configuré.
- `scripts/test-google.js` — 24 vérifications, **sans compte Google**.

### Comment ça marche, en quatre temps

1. On clique sur le bouton → le navigateur part chez Google avec notre
   identifiant d'application.
2. La personne choisit son compte chez Google et accepte.
3. Google la renvoie sur `/auth/google/callback` avec un **code** à usage
   unique. Notre serveur échange ce code contre un jeton, en coulisses : c'est
   là que le SECRET est utilisé, et il ne quitte jamais le serveur.
4. Le jeton contient l'identité (identifiant Google, email, nom). On crée ou
   on retrouve le compte, puis on pose **notre cookie de session habituel**.
   Tout le reste du site ne voit aucune différence.

Point important : **nous ne voyons jamais le mot de passe Google** de la
personne. C'est tout l'intérêt d'OAuth.

### Les choix techniques et pourquoi

**Pas de bibliothèque (ni Passport, ni google-auth-library).** Le trajet
ci-dessus se résume à une redirection, une requête HTTP et un décodage. Passport
demanderait d'apprendre son système de « stratégies », de « sérialisation » et
de sessions, pour exactement le même résultat — et masquerait justement ce
qu'il faut comprendre.

**La signature du jeton n'est pas vérifiée, volontairement.** Un `id_token`
est signé par Google et cette signature sert à prouver qu'il n'a pas été
falsifié en chemin. Ici, le jeton arrive **directement du serveur de Google,
en HTTPS, dans la réponse à notre propre requête** : personne n'a pu le
modifier au passage. La documentation de Google indique explicitement que la
vérification est inutile dans ce cas précis. Elle serait indispensable si le
jeton nous était transmis par le navigateur.

**Un « state » anti-fraude.** Avant de partir chez Google, on tire une valeur
au hasard, rangée dans un cookie, et Google nous la retourne. Si les deux ne
correspondent pas, on refuse. Cela empêche une attaque où quelqu'un vous ferait
terminer **sa** connexion à votre place, vous faisant travailler sur son compte
sans le savoir.

**L'email doit être vérifié par Google.** Sans ce contrôle, n'importe qui
pourrait créer un compte Google portant l'adresse de quelqu'un d'autre et,
grâce à la liaison par email, récupérer ses boards. Un test couvre ce cas.

**L'adresse de retour est reconstruite à partir de la requête** plutôt
qu'écrite dans une variable. Elle vaut ainsi automatiquement
`http://localhost:3000/auth/google/callback` en local et
`https://tableau-blanc-collaboratif.onrender.com/auth/google/callback` en
ligne, sans réglage supplémentaire. Cela ne marche que parce que
`trust proxy` est activé : sans lui, le serveur derrière Render croirait
parler en « http » et Google refuserait l'adresse.

**Les comptes Google n'ont pas de mot de passe.** La colonne `password_hash`
ne peut pas être vide, on y range donc une valeur qui n'est pas une empreinte
scrypt valide. Résultat : le formulaire email/mot de passe ne peut jamais
ouvrir un compte créé via Google, même en devinant cette valeur. Deux tests
le vérifient.

### Les problèmes rencontrés et comment on les a résolus

- **Problème :** comment tester sans compte Google, sans clés, et sans réseau ?
  **Résolu :** `scripts/test-google.js` démarre un vrai serveur avec de fausses
  clés et **intercepte l'unique appel vers Google** pour répondre à sa place.
  Tout le reste est le vrai code : redirection, cookie `state`, création du
  compte, liaison par email, pose du cookie de session. 24 vérifications,
  dont les cas qui doivent échouer (state inventé, code périmé, email non
  vérifié, clic sur « Annuler »).
- **Problème :** ce test enchaîne une quinzaine de connexions en une seconde et
  se bloquait lui-même sur la limitation de débit.
  **Résolu :** il desserre le plafond par variable d'environnement — possible
  seulement depuis que ces seuils sont configurables (entrée 4).
- **Vérification finale dans un vrai navigateur :** le bouton s'affiche, porte
  le bon lien, et le clic mène bien à `accounts.google.com`. Contrôlé avec
  Chromium, clés factices, aucune erreur en console.

### Comment lancer le projet

Inchangé. Pour activer Google en local, ajouter dans `server/.env` :

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Sans ces lignes, le bouton ne s'affiche pas et rien d'autre ne change.

```powershell
npm run test:google    # 24 vérifications, sans compte Google
```

---

## Entrée 7 — Mise en service des vraies clés Google

**Date :** 21 août 2026
**Étape :** suite de l'entrée 6

### Ce qui a été fait

L'entrée 6 avait écrit **le code** de la connexion Google, mais il tournait
avec des clés factices. Ici on branche les **vraies** clés.

- Création d'un **projet Google Cloud séparé et dédié**, nommé
  **`tableau-blanc`**. On n'a volontairement pas réutilisé le projet Google
  d'un autre travail (`RDV_reunion`) : mélanger deux applications dans le même
  projet Google rend impossible de savoir laquelle utilise quoi, et retirer
  une clé pour l'une casserait l'autre. Un projet = une application.
- Dans ce projet : un **client OAuth dédié**, de type **« Application Web »**.
- **Écran de consentement** : type **External**, en **mode test**.
- Les **deux adresses de retour sont déjà déclarées** dans la Console Google :

  ```
  http://localhost:3000/auth/google/callback
  https://tableau-blanc-collaboratif.onrender.com/auth/google/callback
  ```

  Rien à ajouter de ce côté-là, ni pour le local, ni pour la mise en ligne.
- Les deux valeurs `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` ont été
  écrites dans **`server/.env`**, et **nulle part ailleurs**. Ce fichier est
  ignoré par Git (`.gitignore`, ligne `.env`) : les valeurs ne peuvent pas
  partir sur GitHub. Aucun fichier suivi par Git ne contient de secret — seuls
  les **noms** des variables apparaissent, jamais les valeurs.

### La vérification dans un vrai navigateur

Contrôlé dans un vrai Chromium, avec les vraies clés :

- le serveur annonce bien `{"providers":{"google":true}}` ;
- le bouton **« Continuer avec Google »** s'affiche, mesure 338 × 41 px et
  rien ne le recouvre ;
- le clic mène à la vraie page Google, qui affiche
  **« Sign in — to continue to Tableau blanc »**.

Ce dernier point est la **preuve que l'adresse de retour est acceptée** : si
`http://localhost:3000/auth/google/callback` n'avait pas été déclarée, Google
aurait répondu `Erreur 400 : redirect_uri_mismatch` au lieu d'afficher l'écran
de connexion.

### Le problème rencontré et comment on l'a résolu

- **Problème :** `npm run smoke` est passé au rouge dès que les vraies clés
  ont été posées. Le test vérifiait **en dur** que le bouton Google était
  *absent* — ce qui n'était vrai que tant qu'il n'y avait pas de clés. Le
  bouton apparaissait donc **à raison**, et c'est le test qui avait tort.
  **Résolu :** le test demande maintenant au serveur ce qu'il propose
  (`/api/auth/me` → `providers.google`), puis vérifie que la page dit la même
  chose. Il reste juste **dans les deux cas**, avec ou sans clés. Une
  vérification a été ajoutée au passage : le bouton pointe bien vers
  `/auth/google`.
- **Leçon retenue :** un test ne doit pas figer une **configuration**, mais
  vérifier la **cohérence** entre le serveur et la page. Sinon il se casse dès
  qu'on change un réglage, sans qu'aucun bug n'existe.

### Où en est cette fonctionnalité

| | État |
|---|---|
| Console Google (projet, client, écran de consentement) | ✅ Fait |
| Les 2 adresses de retour déclarées | ✅ Fait |
| Clés dans `server/.env` (local) | ✅ Fait |
| Connexion testée en local dans un vrai navigateur | ✅ Fait |
| Clés dans Render → onglet *Environment* | ⏳ **Reste à faire** |
| Redéploiement de Render | ⏳ **Reste à faire** |

⚠️ **L'écran de consentement est en mode test.** Conséquence : seuls les
comptes Google ajoutés dans la liste **« Test users »** de la Console peuvent
se connecter (100 maximum). Pour la vidéo de démo, penser à y ajouter les
adresses qui seront montrées, sinon Google affichera « Accès bloqué ».

### Comment lancer le projet

Inchangé (`npm run dev`). Le bouton Google apparaît maintenant tout seul en
local, puisque `server/.env` contient les deux variables.

```powershell
npm run smoke          # vérifie la cohérence bouton ↔ configuration serveur
npm run test:google    # 24 vérifications, sans compte Google
```

---

## Entrée 8 — Le déploiement Render échouait : rendre l'erreur lisible

**Date :** 21 août 2026
**Étape :** dépannage, après l'entrée 7

### Le symptôme

Le déploiement Render s'arrêtait au démarrage sur une erreur PostgreSQL, avec
pour seule indication `exited with status 1` et une pile d'appels. Impossible
de savoir quoi corriger.

Hypothèse de départ : la migration du schéma Google (`google_id`) serait
incompatible avec les tables déjà créées en ligne.

### Ce qu'on a cherché — et ce qu'on a trouvé

**La migration n'est pas en cause.** Vérifié de trois façons :

1. `initDb()` lancé sur la **vraie base Neon** → réussit.
2. Une base recréée dans l'**état d'avant Google** (ancien schéma, 3 comptes
   dedans), sur un vrai PostgreSQL → la migration ajoute `google_id`, crée
   l'index, et **les 3 comptes sont conservés**.
3. La **chaîne Render complète rejouée à l'identique** (clone neuf du dépôt,
   `npm run install:all && npm run build`, puis `npm start` avec
   `NODE_ENV=production` et la vraie `DATABASE_URL`) → le serveur démarre et
   reste vivant.

**La vraie cause est ailleurs : la connexion à la base.** En rejouant les
différents cas de panne, tous donnent exactement le symptôme observé —
« erreur PostgreSQL, status 1 » :

| Cas | Erreur PostgreSQL |
|---|---|
| URL d'un projet Neon supprimé ou recréé | `28P01` mot de passe refusé |
| Mot de passe faux dans `DATABASE_URL` | `28P01` mot de passe refusé |
| Nom de base inexistant | `3D000` base inexistante |

Autre indice qui va dans ce sens : la base `tableau_blanc` est **vide**
(0 compte), alors que le journal notait qu'elle contenait de vrais comptes.
Elle a donc été **recréée** entre-temps — et la `DATABASE_URL` enregistrée
dans Render pointe très probablement encore sur **l'ancienne**.

### La correction

On ne pouvait pas corriger la variable de Render depuis le code. En revanche,
le vrai défaut — **une panne de base illisible dans le journal** — lui, se
corrige. Trois changements :

1. **Un diagnostic en français au démarrage** (`server/src/index.js`). Au lieu
   d'une pile d'appels, le journal affiche la cause, l'URL utilisée **mot de
   passe masqué**, et où aller la corriger :

   ```
   [base] IMPOSSIBLE DE DÉMARRER : la base de données est inaccessible.
   [base] Cause : le mot de passe (ou l'utilisateur) de DATABASE_URL est refusé.
   [base] DATABASE_URL utilisée : postgresql://neondb_owner:***@ep-….neon.tech/tableau_blanc
   [base] À vérifier sur Render → Environment : …
   ```

2. **Des réessais au démarrage** (`server/src/db.js`). Neon met la base en
   veille après quelques minutes ; la première connexion d'un déploiement
   tombe donc souvent pendant ce réveil. On réessaie 5 fois, avec une attente
   qui s'allonge. Mais **seulement pour les pannes passagères** : un mot de
   passe faux échoue tout de suite, car il ne se réparera pas tout seul.

3. **Un délai de connexion de 10 s** (`connectionTimeoutMillis`). Sans lui,
   une base injoignable faisait attendre le serveur indéfiniment : Render
   concluait « démarrage trop long » sans jamais dire pourquoi.

### La leçon retenue

Le premier réflexe était de suspecter la **migration**, parce que c'était le
dernier changement en date. C'était faux. Reproduire l'environnement réel — la
vraie base, l'ancien schéma avec ses données, la chaîne de déploiement
complète — a montré que le code marchait, et déplacé la recherche vers la
**configuration**. *Le dernier changement n'est pas toujours le coupable.*

Second point : une erreur qu'on ne peut pas lire coûte plus cher que le bug
lui-même. Le message clair vaut le quart d'heure passé à l'écrire.

### Les tests

7 tests unitaires ajoutés (`server/test/diagnostic-db.test.js`) : chaque cause
d'erreur donne bien la bonne phrase, et **le mot de passe n'apparaît jamais**
dans l'URL affichée.

Suite complète au vert : 25 + 12 unitaires, 30 e2e, 24 Google, 19 PostgreSQL
réel, 12 + 28 smoke, 22 navigateur réel, test de charge à 6 participants.

---

## Entrée 9 — Bonus : le chat vocal (WebRTC)

**Date :** 21 août 2026
**Étape :** bonus, après l'étape 5

### Ce qui a été fait

Les personnes présentes sur un même board peuvent maintenant **se parler**.
Un bouton « 🎙 Rejoindre l'audio » dans la barre du haut, un bouton micro pour
se couper, et une pastille par participant — celle de la personne qui parle
s'entoure d'un halo.

- `client/src/board/voice.js` — tout le chat vocal (~330 lignes commentées).
- `server/src/realtime.js` — la « signalisation », 5 nouveaux messages.
- `client/board.html` + `style.css` — les deux boutons et les pastilles.
- `scripts/test-voice.js` — 21 vérifications dans **deux vrais Chromium**.

### Comment ça marche, en une image

Le son **ne passe pas par notre serveur**. Les deux navigateurs se parlent
**directement**, d'ordinateur à ordinateur. Notre serveur ne fait que les
présenter l'un à l'autre, comme quelqu'un qui donnerait un numéro de
téléphone : une fois l'appel lancé, il n'est plus dans la conversation.

Ces quelques messages de présentation s'appellent la **signalisation**. Ils
passent par la connexion Socket.IO **déjà ouverte pour le dessin** : aucun
serveur, aucun port, aucune bibliothèque en plus.

Le trajet, dans l'ordre :

1. Je clique sur « Rejoindre l'audio ». Le navigateur me demande l'accès au
   micro.
2. J'annonce au serveur que je rejoins ; il me répond avec **la liste de ceux
   qui sont déjà dans l'appel**.
3. J'appelle chacun d'eux : je lui envoie une « offre » (`offer`), il me
   répond par une « réponse » (`answer`), puis on s'échange les chemins réseau
   possibles (`ice`).
4. Une fois d'accord, le son circule **en direct**, sans passer par nous.

### Les choix techniques et pourquoi

**Qui appelle qui ?** Règle : *celui qui arrive appelle ceux qui sont déjà
là*. Sans une telle règle, deux personnes peuvent s'appeler en même temps —
c'est le problème classique du « glare » (les deux décrochent et personne ne
s'entend). Ici, pour chaque paire, un seul des deux compose le numéro : le
problème ne peut pas se produire.

**« Mesh » plutôt qu'un serveur de mélange audio.** Chacun est relié à chacun.
À 4 participants cela fait 6 liaisons — largement tenable. La solution
professionnelle (un « SFU », serveur qui reçoit tous les sons et les
redistribue) diviserait le nombre de liaisons, mais demanderait d'héberger et
de comprendre un logiciel entier. Hors sujet pour un bonus.

**Aucune bibliothèque.** WebRTC est intégré aux navigateurs. Les
bibliothèques du genre `simple-peer` masquent exactement ce qu'il faut
comprendre ici : l'offre, la réponse, les candidats réseau.

**Un serveur STUN public de Google.** Un STUN répond juste « voici l'adresse
sous laquelle je te vois depuis Internet » — nécessaire car un ordinateur
derrière une box ignore sa propre adresse publique. C'est gratuit et ça
n'envoie aucune donnée. *Limite connue* : sur certains réseaux très fermés
(entreprises, universités), il faudrait en plus un serveur **TURN**, qui
relaie le son. C'est payant, et hors du cadre du stage.

**Couper le micro ne raccroche pas.** On met la piste en sourdine
(`track.enabled = false`) au lieu de l'arrêter : la liaison reste ouverte,
donc rallumer est instantané. Un test le vérifie.

**Qui parle ?** Mesuré avec l'analyseur audio du navigateur. Mon propre niveau
est envoyé aux autres (ils ne peuvent pas le deviner quand je me coupe) ; le
niveau des autres est mesuré **directement sur le son reçu**, donc sans aucun
message réseau supplémentaire.

**Le serveur vérifie la forme des messages** (`isValidSignal`) et ne les
recopie que vers quelqu'un du **même board** et **déjà dans l'appel**. Sans
ce contrôle, un participant pourrait envoyer n'importe quoi à n'importe quel
visiteur du site, et se servir du canal comme d'un tuyau à données. La taille
est plafonnée à 20 ko par message, et le débit à 30 messages par seconde.

### Les problèmes rencontrés et comment on les a résolus

- **Problème :** comment tester ? jsdom ne connaît ni les micros ni WebRTC, et
  on ne peut pas demander à un test de parler.
  **Résolu :** Chromium sait fabriquer un **faux micro** qui émet un bip
  continu (`--use-fake-device-for-media-stream`) et accepter l'autorisation
  tout seul (`--use-fake-ui-for-media-stream`). `npm run voice` ouvre donc
  deux navigateurs, les fait rejoindre le même board, et vérifie que la
  liaison audio s'établit vraiment.
- **Problème :** le module ne devait pas casser les tests d'interface
  existants, qui tournent dans jsdom.
  **Résolu :** `voiceSupported()` vérifie la présence de `RTCPeerConnection`
  et du micro **avant tout**. Dans jsdom, elle renvoie `false` : le bouton
  reste caché et rien d'autre ne change. Les 28 vérifications de `smoke-dom`
  sont restées vertes sans être modifiées.
- **Problème :** le halo « en train de parler » faisait sauter toute la barre
  du haut à chaque syllabe.
  **Résolu :** il est dessiné avec `box-shadow` et non avec une bordure — une
  bordure change la taille de la pastille, une ombre non. Le halo respecte
  aussi le réglage système « réduire les animations ».

### Le piège à retenir

**Le micro n'est accessible qu'en « contexte sécurisé »** : uniquement en
**HTTPS**, ou sur **`localhost`**. Donc :

| Adresse | Micro |
|---|---|
| `http://localhost:5173` | ✅ autorisé (exception prévue par les navigateurs) |
| `https://tableau-blanc-collaboratif.onrender.com` | ✅ autorisé |
| `http://192.168.1.20:5173` (depuis un autre poste) | ❌ refusé par le navigateur |

Si le micro est refusé — par ce piège ou parce que la personne a cliqué
« Bloquer » — un message explique quoi faire, et **le tableau continue de
fonctionner normalement**.

### Les tests

`npm run voice` — 21 vérifications dans deux vrais Chromium : le bouton, la
liaison pair-à-pair réellement établie (piste audio vivante des deux côtés),
la coupure du micro qui ne raccroche pas, le départ vu par l'autre, et un
rectangle dessiné qui arrive toujours chez l'autre **pendant** l'appel.

7 tests unitaires ajoutés côté serveur sur le contrôle des messages de
signalisation.

Suite complète au vert : 32 + 12 unitaires, 30 e2e, 24 Google, 19 PostgreSQL
réel, 12 + 28 smoke, 22 navigateur réel, **21 chat vocal**, test de charge à
6 participants.

---

## Entrée 10 — Chat vocal : le relais TURN

**Date :** 21 août 2026
**Étape :** suite de l'entrée 9

### Le problème à résoudre

L'entrée 9 notait une limite : avec STUN seul, l'appel échoue entre certains
réseaux. Le cas typique : une personne en **4G**, l'autre derrière le
**pare-feu d'une entreprise ou d'une université**.

Pourquoi : STUN se contente de dire « voici ton adresse publique ». Cela
suffit pour que deux box domestiques se trouvent. Mais certains réseaux
n'acceptent **aucune** connexion entrante, quelle que soit l'adresse. Dans ce
cas, il faut quelqu'un au milieu qui **relaie** le son : c'est **TURN**.

Image : STUN, c'est un ami qui vous donne le numéro de l'autre. TURN, c'est un
standard téléphonique qui prend l'appel et le transfère — plus coûteux, mais
ça passe toujours.

### Ce qui a été fait

- `server/src/config.js` — lecture de `TURN_URLS`, `TURN_USERNAME`,
  `TURN_CREDENTIAL` (et `STUN_URLS`), plus une fonction `iceServers()` qui
  construit la liste au format attendu par le navigateur.
- `server/src/routes.js` — nouvelle route `GET /api/boards/:id/ice`.
- `client/src/api.js` + `client/src/board/voice.js` — la liste n'est plus
  écrite en dur : elle est demandée au serveur au moment de rejoindre l'appel.
- `server/.env.example` et `docs/deploiement.md` — les variables documentées.

### Les choix techniques et pourquoi

**Pourquoi la route est rattachée à un board, et pas une simple `/api/ice`.**
C'était la demande de départ, et c'est le point qui mérite d'être expliqué :
les identifiants TURN se paient **à l'usage**. Une adresse `/api/ice` ouverte
à tous permettrait à n'importe qui sur Internet de récupérer ces identifiants
et de s'en servir comme d'un relais gratuit — la facture serait pour nous.
La route exige donc le même droit que pour **ouvrir le board** : exactement le
contrôle qui existait déjà, réutilisé tel quel. Un test vérifie qu'un inconnu
reçoit bien un 404 sur un board privé.

**Pourquoi ne rien écrire dans le code du navigateur.** Tout ce qui part au
navigateur est lisible par n'importe qui (clic droit → code source). Un secret
n'y a jamais sa place. C'est la même règle que pour `GOOGLE_CLIENT_SECRET`.

**L'ordre de la liste compte, et il est gratuit.** Le navigateur essaie
**toujours** la connexion directe en premier et ne bascule sur le relais que
si elle échoue. Ajouter un TURN ne dégrade donc jamais la qualité ni la
latence : c'est un filet de sécurité, pas un détour.

**Une liste de secours côté client.** Si l'API ne répond pas, on retombe sur
les STUN de Google plutôt que d'empêcher tout appel. Mieux vaut un appel qui
marche entre voisins que pas d'appel du tout.

**Rien ne change sans les variables.** `TURN_URLS` absente → la liste ne
contient que du STUN, et **aucun identifiant n'est transmis**. Un test le
vérifie explicitement : c'est la preuve qu'on n'envoie pas de secret par
défaut.

### Les problèmes rencontrés et comment on les a résolus

- **Problème :** comment tester les deux cas — avec et sans TURN — alors que
  la configuration est lue une seule fois, au démarrage du serveur ?
  **Résolu :** `server/test/ice.test.js` relance un petit processus Node neuf
  pour chaque cas, avec l'environnement voulu. 5 tests : sans TURN, avec TURN,
  plusieurs adresses séparées par des virgules, variables vides ignorées, et
  remplacement des STUN.
- **Vérification réelle :** le chat vocal a été relancé dans deux Chromium
  **avec un TURN configuré** (adresse volontairement bidon). L'appel s'établit
  quand même par la connexion directe — ce qui prouve que la présence d'un
  TURN inutilisable ne casse rien. Puis la configuration a été retirée.
- **Problème (sans rapport avec le code) :** `npm run test:pg` échouait avec
  « Erreur pendant le test PostgreSQL : undefined ». Cause : un PostgreSQL
  temporaire, laissé par un test interrompu plus tôt, occupait encore le port
  55432.
  **Résolu :** le port est devenu configurable — `PG_TEST_PORT=55437
  npm run test:pg` — ce qui permet de relancer sans attendre. 19/19 au vert
  sur un port libre.

### Les tests

Suite complète au vert : 37 + 12 unitaires, 35 e2e (dont 5 nouvelles sur la
route ICE), 24 Google, 19 PostgreSQL réel, 12 + 28 smoke, 22 navigateur réel,
**23 chat vocal**, test de charge à 6 participants, et le build de production.

---

## Entrée 11 — L'indicateur « qui parle » restait muet en ligne

**Date :** 22 août 2026
**Étape :** correction, après l'entrée 10

### Le symptôme

Sur le site en ligne, deux personnes rejoignent l'audio, les deux pastilles
s'affichent — mais **aucune ne pulse**, pas même la sienne, alors que le micro
a bien été autorisé.

Le fait que **sa propre** pastille ne pulse pas est l'indice décisif : cette
mesure-là ne fait intervenir aucun réseau. Le problème était donc entièrement
local, dans la détection du son — pas dans WebRTC, pas dans le TURN.

### Les deux causes

**1. On ne mesurait pas la bonne grandeur.** Le code prenait la moyenne du
**spectre de fréquences**, sur toute la bande (0 à ~24 kHz). Or la voix
n'occupe que le bas du spectre : les neuf dixièmes des mesures valaient zéro
et écrasaient la moyenne. Un vrai micro restait sous le seuil même en parlant
fort.

Pourquoi les tests ne l'avaient pas vu : le **faux micro** de Chromium émet un
signal large qui sature les basses fréquences. Mesuré ici, il donne **0,165**
sur cette moyenne — très au-dessus du seuil de 0,045. Il passait donc
largement, là où une vraie voix ne passait pas. *Un faux périphérique n'est
pas représentatif d'un vrai.*

On mesure maintenant le **volume réel du signal** (« RMS » : la moyenne de
l'énergie, lue dans le temps et non en fréquences). C'est la grandeur que
perçoit l'oreille.

**2. Le seuil était un chiffre écrit en dur.** 0,045 ne peut pas convenir à la
fois au micro d'un portable et à un casque. Le seuil s'ajuste désormais tout
seul : on suit le niveau le plus bas observé — le silence de la pièce — et on
déclenche nettement au-dessus.

### Une troisième cause, corrigée au passage

Un `AudioContext` créé alors que le « geste utilisateur » a expiré démarre
**suspendu**, et un analyseur suspendu ne mesure que du silence. C'est
exactement le cas en ligne : le clic est consommé par la fenêtre « Autoriser
le micro ? », et le contexte n'est créé qu'**après** la réponse. Sur iPhone,
il démarre suspendu dans tous les cas.

On appelle donc maintenant `resume()`, et l'état est écrit dans la console.

### Des journaux pour ne plus deviner

Toutes les étapes de l'appel écrivent une ligne préfixée `[audio]` dans la
console du navigateur : demande du micro, pistes obtenues, serveurs STUN/TURN
reçus, entrée dans l'appel, état de chaque liaison, son reçu.

Un mode détaillé affiche en plus le niveau du micro une fois par seconde :

```js
localStorage.setItem("audio-debug", "1")   // puis recharger la page
```

### Le test qui manquait

Aucun test ne vérifiait que la pastille **s'allume**. Il en existe un
maintenant — et surtout, le drapeau `--autoplay-policy=no-user-gesture-required`
a été **retiré** du lancement de Chromium : il forçait l'`AudioContext` à
démarrer actif et masquait donc précisément ce bug. Trois vérifications
ajoutées : ma pastille s'allume, l'autre personne le voit, et le halo est
réellement dessiné (la règle CSS s'applique vraiment).

### La leçon retenue

Deux pièges de test, tous deux du même genre : **un environnement de test plus
permissif que la réalité ne prouve rien**. Le faux micro était trop généreux,
et le drapeau autoplay supprimait la contrainte même qu'il fallait respecter.
À rapprocher de la leçon de l'entrée 3 sur jsdom.

### Le rappel utile

La route ICE n'est pas `/api/ice` mais **`/api/boards/<id>/ice`** — elle est
volontairement rattachée à un board, pour que les identifiants TURN (payants)
ne soient pas servis à n'importe qui (voir entrée 10).

### Les tests

Suite complète au vert : 37 + 12 unitaires, 35 e2e, 24 Google, 12 + 28 smoke,
22 navigateur réel, **26 chat vocal**, test de charge, build de production.

---

## Entrée 12 — Le chat vocal fonctionne en ligne, en 4G

**Date :** 22 août 2026
**Étape :** validation du bonus

### Le résultat

**Le chat vocal fonctionne sur le site en ligne, entre deux réseaux
différents** : un PC en WiFi et un téléphone en 4G. C'est le cas le plus
difficile — celui qui échouait avant — et il passe.

C'est aussi la validation de bout en bout du bonus : dessin, temps réel,
comptes, partage **et** voix, tout ensemble, sur l'URL publique en HTTPS.

### Ce qu'il a fallu pour y arriver

Deux choses, indépendantes l'une de l'autre, et il fallait les deux :

**1. Le relais TURN (entrée 10).** Les trois variables du compte Metered sont
posées sur Render :

```
TURN_URLS  TURN_USERNAME  TURN_CREDENTIAL
```

Sans elles, les deux navigateurs ne trouvaient aucun chemin l'un vers l'autre :
une 4G et un réseau domestique n'acceptent pas de connexion entrante directe.
STUN seul ne suffit donc pas dans ce cas — c'était la limite annoncée dès
l'entrée 9, et TURN la lève.

**2. Les corrections du micro (entrée 11, commit `de23916`).** Même une fois la
liaison établie, l'indicateur « qui parle » restait éteint : on mesurait la
moyenne du spectre de fréquences au lieu du volume réel, avec un seuil écrit
en dur, et l'`AudioContext` pouvait démarrer suspendu.

*À retenir :* deux pannes différentes se cumulaient et se masquaient
mutuellement. Sans TURN, on ne pouvait pas voir que la détection du micro
était cassée ; avec un micro muet, on ne pouvait pas confirmer que TURN
marchait. Il a fallu les traiter séparément, chacune avec son propre moyen de
vérification — le test à deux Chromium pour le micro, l'appel réel en 4G pour
le relais.

### Ce que ça vaut pour le sujet

Le bonus est désormais **démontrable en vidéo** : deux appareils, deux réseaux,
sur l'URL publique. À montrer dans la démo (~3 min) prévue à l'étape 6.

### Où en est le chat vocal

| | État |
|---|---|
| Appel entre deux onglets, en local | ✅ |
| Appel entre deux machines du même réseau | ✅ |
| **Appel PC (WiFi) ↔ téléphone (4G), en ligne** | ✅ **confirmé le 22 août 2026** |
| Indicateur « qui parle » | ✅ corrigé (entrée 11) |
| Couper / activer le micro | ✅ |
| Variables TURN posées sur Render | ✅ |

### Rappels utiles pour la suite

- La route ICE est **`/api/boards/<id>/ice`**, jamais `/api/ice`.
- Pour diagnostiquer un appel : F12 → Console, filtrer sur `[audio]`.
  Mode détaillé : `localStorage.setItem("audio-debug", "1")` puis recharger.
- Le micro n'est accessible qu'en **HTTPS** ou sur **`localhost`**.
- Le quota gratuit de Metered est limité : à surveiller si la démo est
  répétée souvent. Le relais n'est utilisé que lorsque la connexion directe
  échoue, donc un appel entre deux postes du même réseau ne consomme rien.

---
