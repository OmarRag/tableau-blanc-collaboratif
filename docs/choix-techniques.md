# Document de choix techniques

> Livrable demandé par le sujet : « A "design choices" doc justifying the sync
> algorithm picked ». Ce document explique **chaque décision** et surtout
> **pourquoi les autres options ont été écartées**.

---

## 1. Le principe qui a guidé tous les choix

L'objectif du stage n'est pas seulement d'avoir un projet qui marche, mais de
**comprendre** ce qu'on a construit pour pouvoir le refaire seul. À chaque
carrefour, la question posée a donc été :

> « Quelle option puis-je expliquer entièrement au tableau dans 3 mois ? »

Ce qui se traduit par : **l'outil le plus simple qui fait le travail**, quitte
à écrire un peu plus de code soi-même. Une bibliothèque qui fait tout
automatiquement fait gagner du temps aujourd'hui, mais empêche d'apprendre ce
qui se passe en dessous — et rend impossible le débogage quand ça casse.

---

## 2. L'algorithme de synchronisation (le choix central)

Le sujet propose trois approches et demande de justifier celle retenue.

### Les options

| Option | Principe | Avantages | Inconvénients |
|---|---|---|---|
| **CRDT** (Yjs, Automerge) | Structures de données qui fusionnent automatiquement, même après des semaines hors ligne | Très robuste, édition de texte collaborative gratuite, hors ligne long | Boîte noire de ~50 000 lignes ; impossible à expliquer ou déboguer pour un débutant ; taille des documents qui grossit |
| **OT** (Operational Transform) | Le serveur « transforme » les opérations concurrentes pour les rendre compatibles | Utilisé par Google Docs ; économe en mémoire | Les fonctions de transformation sont notoirement difficiles à écrire correctement ; un seul cas oublié = divergence silencieuse |
| **LWW + horloge de Lamport** | Chaque forme porte un numéro ; la version au plus grand numéro gagne | ~30 lignes de code, entièrement compréhensible, testable | Une modification concurrente sur la **même** forme en écrase une autre |

### Le choix : LWW par forme, avec horloge de Lamport

**Pourquoi c'est acceptable ici.** Un tableau blanc n'est pas un traitement de
texte. L'unité de travail est **la forme entière**, pas le caractère. Or deux
personnes qui dessinent travaillent presque toujours sur des formes
*différentes* : dans ce cas, aucune n'écrase l'autre, quelle que soit la
méthode. Le conflit ne se produit que si deux personnes déplacent
**exactement la même forme au même instant** — cas rare, et où « la dernière
gagne » correspond de toute façon à ce qu'attend l'utilisateur.

Le sujet valide explicitement cette lecture : *« Last-write-wins with vector
clocks (acceptable for shapes) »*.

**Pourquoi une horloge de Lamport plutôt que l'heure de la machine.** Si on
comparait `Date.now()`, un ordinateur dont l'horloge avance de 30 secondes
gagnerait systématiquement tous les conflits, y compris contre des
modifications faites *après* les siennes. L'horloge de Lamport est un simple
compteur qui ne mesure pas le temps mais **la causalité** :

- j'incrémente quand j'agis : `clock = max(clock connu) + 1` ;
- je me mets à jour quand je reçois : `clock = max(clock, reçu)`.

Si Alice modifie une forme **après avoir vu** la version de Bob, son numéro est
mathématiquement plus grand. L'ordre « qui savait quoi » est respecté sans
jamais faire confiance à l'heure d'une machine.

**Le départage à égalité.** Deux personnes qui n'ont pas vu la modification de
l'autre peuvent produire le même numéro. On compare alors les identifiants
d'auteur (`a.actor > b.actor`). Ce choix est arbitraire — mais il est
**déterministe et identique partout**, ce qui est la seule propriété
nécessaire : tout le monde désigne le même gagnant, donc tout le monde
converge vers le même dessin.

**Ce qu'on perd, assumé.** Contrairement à un CRDT, on ne gère pas une
déconnexion de plusieurs jours avec fusion intelligente : au retour, la règle
« la dernière gagne » s'applique brutalement. Pour une session de travail
normale (quelques heures, coupures de quelques secondes ou minutes), c'est
sans conséquence. Migrer vers Yjs plus tard resterait possible : toute la règle
tient dans `shared/merge.js`, un seul fichier de 30 lignes.

### Une règle unique, partagée par le client et le serveur

`shared/merge.js` est importé **des deux côtés**. Si le navigateur et le
serveur appliquaient deux règles écrites séparément, la moindre différence
provoquerait une divergence invisible. Un seul fichier = une seule vérité.

---

## 3. Interface : JavaScript « vanilla » plutôt que React

Le sujet recommande React + Konva/Fabric.js, mais autorise « plain Canvas API ».

**Pourquoi vanilla :**

- React sert à synchroniser un arbre HTML avec des données. Or **un canvas
  n'est pas un arbre HTML** : c'est une seule balise sur laquelle on peint des
  pixels. React n'apporte donc rien sur le cœur du projet.
- Konva/Fabric.js gèrent les formes, la sélection et le hit-testing à notre
  place — c'est-à-dire précisément les algorithmes que le stage doit faire
  comprendre (transformation écran ↔ monde, test « le clic touche-t-il ce
  trait ? »).
- Moins de couches = piles d'erreurs lisibles, et débogage possible.

**Coût assumé :** environ 900 lignes de JavaScript écrites à la main pour le
moteur de dessin. En contrepartie, chaque ligne est explicable.

---

## 4. Base de données : SQLite via `node:sqlite`

| Option | Écartée parce que |
|---|---|
| PostgreSQL | Serveur séparé à installer, configurer et faire tourner. Inutile pour un projet à quelques dizaines d'utilisateurs. |
| `better-sqlite3` (paquet npm) | Module natif C++ : nécessite des outils de compilation sur la machine, échoue régulièrement sous Windows. |
| **`node:sqlite`** ✅ | **Intégré à Node.js 22+**. Zéro dépendance, zéro compilation, API synchrone simple. La base est un seul fichier. |

Le mode **WAL** (`journal_mode = WAL`) est activé : il permet de lire pendant
qu'on écrit, ce qui est indispensable quand plusieurs personnes écrivent sur le
même board.

**Limite connue :** SQLite est un fichier local, donc lié à une seule machine.
Pour déployer sur plusieurs serveurs il faudrait passer à PostgreSQL et à Redis
pour la diffusion entre serveurs. Ce n'est pas nécessaire pour ce stage, et la
couche d'accès aux données est isolée dans `server/src/boards.js`, ce qui rend
la migration localisée.

---

## 5. Temps réel : Socket.IO plutôt que WebSocket brut

Un WebSocket brut oblige à réécrire soi-même : la reconnexion automatique avec
délai croissant, le découpage en « rooms », les accusés de réception, et le
repli en HTTP long-polling quand un pare-feu bloque les WebSockets.

Socket.IO fournit les quatre. Les accusés de réception sont particulièrement
utiles ici : c'est ce qui permet de savoir **quand** retirer une opération de
la file d'attente, donc de garantir qu'aucun trait n'est perdu.

---

## 6. Regroupement des envois (40 ms)

Envoyer un message réseau à chaque mouvement de souris produirait ~200
messages par seconde et par personne. Le client range donc les opérations dans
une **boîte d'envoi indexée par forme**, vidée toutes les 40 ms (25 fois par
seconde).

Ne garder que la dernière version de chaque forme ne perd **aucune
information** : c'est exactement la même règle que « la dernière écriture
gagne ». Les deux décisions se renforcent l'une l'autre.

Effet mesuré : 240 formes dessinées par 6 personnes simultanément, aucune
perte, latence au 95e centile de 9 ms.

---

## 7. Ordre d'empilement des formes

Problème : si l'ordre d'affichage dépendait de l'ordre d'arrivée des messages,
deux navigateurs pourraient afficher un rectangle rouge devant un bleu chez
l'un, et l'inverse chez l'autre.

Solution : chaque forme mémorise `z`, la valeur de l'horloge de Lamport **au
moment de sa création**. Toutes les machines trient sur ce nombre (puis sur
l'identifiant en cas d'égalité), donc toutes affichent le même empilement.

---

## 8. Undo/redo local et non partagé

Le sujet précise « Undo/redo (local) ». C'est aussi le comportement attendu :
si Alice fait `Ctrl+Z`, elle veut annuler **son** dernier trait, pas celui que
Bob vient de faire.

L'historique est donc une pile de changements `{avant, après}` propre à chaque
navigateur. Annuler consiste à réappliquer l'état « avant » — qui est alors
diffusé aux autres comme une modification normale.

---

## 9. Comptes : mot de passe maison plutôt qu'une bibliothèque d'auth

| Option | Écartée parce que |
|---|---|
| Lucia, Auth.js | Beaucoup de configuration et de concepts (adapters, providers, callbacks) pour un besoin simple. |
| JWT | Un jeton JWT ne peut pas être révoqué avant son expiration : se déconnecter ne déconnecte pas vraiment. |
| **Session en base + cookie** ✅ | Une ligne dans une table, supprimée à la déconnexion. Facile à expliquer, et la déconnexion est immédiate. |

Mots de passe : **scrypt** (fourni par Node, volontairement lent), sel
aléatoire par compte, comparaison à temps constant pour ne pas laisser deviner
le mot de passe en mesurant le temps de réponse.

OAuth Google/GitHub n'est pas implémenté : le sujet demande « email + mot de
passe **ou** OAuth ».

---

## 10. Modèle de droits

Trois rôles seulement — `owner`, `edit`, `view` — et **le plus fort l'emporte**
quand plusieurs raisons d'avoir accès se cumulent (être invité *et* le board
être public).

Un accès peut venir de trois sources : être propriétaire, être invité par
email, ou posséder le lien de partage. Le board public ajoute un droit de
lecture pour tout le monde, même sans compte.

Tout est calculé par une seule fonction, `roleFor()`, appelée aussi bien par
l'API HTTP que par la couche temps réel : **impossible d'oublier un contrôle
d'un côté**.

---

## 11. Stratégie de test

Sans navigateur automatisé, il fallait quand même pouvoir vérifier le code de
l'interface. Quatre niveaux ont été mis en place :

| Niveau | Commande | Ce qu'il vérifie |
|---|---|---|
| Unitaire | `npm test` | Règle de fusion, droits, mots de passe, géométrie du dessin, caméra (25 tests) |
| Bout en bout | `npm run e2e` | 2 utilisateurs réels : comptes, temps réel, conflits, reconnexion, partage, limitation de débit (27 vérifications) |
| Interface (rapide) | `npm run smoke` | Les vraies pages exécutées dans un DOM simulé (jsdom) : on clique, on dessine à la souris, on annule (28 vérifications) |
| Navigateur réel | `npm run browser` | Chromium piloté par Playwright : inscription, création de board, dessin avec les 7 outils, fenêtres, **lecture de la console** (22 vérifications) |
| Charge | `npm run load` | 6 participants, 240 formes : latence, convergence, aucune perte |

Le test jsdom fournit un faux contexte 2D qui **compte les appels de dessin** :
on peut ainsi affirmer « le rectangle a bien été tracé » sans écran. Il est
rapide et sans dépendance lourde.

**Mais jsdom ne calcule aucune mise en page.** Il ne connaît ni la taille réelle
des éléments, ni leur superposition, ni la priorité entre la feuille de style du
projet et celle du navigateur. Deux bugs bloquants sont passés à travers pour
cette raison exacte (voir `JOURNAL.md`, entrée 3) : un canvas resté à 300 × 150
pixels dans un coin, et des fenêtres impossibles à fermer. **Le test Chromium
fait donc autorité** ; jsdom n'est qu'un filet de sécurité rapide.
