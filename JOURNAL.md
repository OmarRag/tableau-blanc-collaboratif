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
| 5 | Mise en ligne | ⏳ À faire ensemble |
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
