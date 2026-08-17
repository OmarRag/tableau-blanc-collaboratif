# Mise en ligne (étape 5)

> ✅ **Fait le 17 août 2026.** Le site tourne sur
> **https://tableau-blanc-collaboratif.onrender.com**
>
> | | |
> |---|---|
> | Serveur | Render, offre gratuite, région **Frankfurt** |
> | Base de données | Neon PostgreSQL, offre gratuite, base `tableau_blanc`, *connection pooling*, région **Frankfurt** |
> | Variables sur Render | `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=production` |
> | Health check | `/healthz` |
> | Dépôt | https://github.com/OmarRag/tableau-blanc-collaboratif |
>
> Deux points à retenir : l'instance gratuite **s'endort après 15 minutes**
> (réveil en 30 à 50 s), et Render a été branché en mode **« Public Git
> Repository »** — il ne se redéploie donc **pas** tout seul après un
> `git push`, il faut cliquer *Manual Deploy → Deploy latest commit*.

Ce document explique **comment le projet est configuré pour la production**.

Tout ce qui est décrit ici est **gratuit** : aucune carte bancaire n'est
nécessaire, ni chez Render, ni chez Supabase, ni chez Neon.

---

## 1. Les trois services et leur rôle

| Service | Rôle | Offre gratuite |
|---|---|---|
| **GitHub** | Stocke le code. Render lit le code depuis là. | illimité pour un dépôt public |
| **Supabase** *(ou Neon)* | Héberge la base de données PostgreSQL. | oui, sans expiration |
| **Render** | Fait tourner le serveur Node et sert le site en HTTPS. | 1 service web gratuit |

> **Pourquoi une base séparée ?** Render efface le disque du service à chaque
> redéploiement. Un fichier SQLite y serait perdu à chaque mise à jour du code :
> tous les comptes et tous les dessins disparaîtraient. PostgreSQL vit sur une
> autre machine, donc les données survivent.
>
> Render propose aussi une base PostgreSQL gratuite, mais **elle est supprimée
> au bout de 30 jours**. Supabase et Neon n'ont pas cette limite : c'est pour
> cela qu'on les préfère ici.

---

## 2. Ce qui a été adapté dans le code

### La base de données change toute seule

Un seul interrupteur : la variable d'environnement `DATABASE_URL`.

```
DATABASE_URL absente  →  SQLite   (fichier local, mode développement)
DATABASE_URL présente →  PostgreSQL (mode en ligne)
```

Tout le serveur passe par trois fonctions (`all`, `get`, `run`) définies dans
[`server/src/db.js`](../server/src/db.js). Le reste du code ne sait pas quel
moteur tourne dessous. Les requêtes s'écrivent toujours avec des `?` ; la
traduction vers le style PostgreSQL (`$1`, `$2`…) est faite à un seul endroit.

Deux différences réelles entre les deux moteurs ont dû être traitées :

1. **Les dates.** On stocke un nombre de millisecondes (`Date.now()`, environ
   1 750 000 000 000). C'est trop grand pour un `INTEGER` PostgreSQL, qui
   s'arrête à ~2,1 milliards. Le schéma utilise donc `BIGINT` sur PostgreSQL.
2. **Le type renvoyé.** Le pilote PostgreSQL renvoie les `BIGINT` sous forme de
   **texte**, pour ne pas perdre de précision sur de très grands nombres. Sans
   correction, les dates devenaient des chaînes de caractères et les tris
   étaient faux. On force la reconversion en nombre au démarrage.

### La règle de fusion est passée dans le SQL

Avant, le serveur faisait « je lis la forme, je compare les horloges, j'écris ».
Avec SQLite c'était sûr, car tout était instantané. Avec PostgreSQL, chaque
accès est **asynchrone** : deux opérations sur la même forme peuvent
s'entrelacer et la mauvaise version peut gagner.

La comparaison est donc maintenant faite **dans la requête d'écriture**, en une
seule instruction atomique :

```sql
INSERT INTO shapes (...) VALUES (...)
ON CONFLICT (board_id, id) DO UPDATE SET ...
WHERE excluded.clock > shapes.clock
   OR (excluded.clock = shapes.clock AND excluded.actor > shapes.actor)
RETURNING id
```

C'est exactement la règle de [`shared/merge.js`](../shared/merge.js). Un test
automatique (`la règle SQL et la règle JavaScript donnent le même résultat`)
compare les deux sur cinq cas pour qu'elles ne divergent jamais.

### Prêt pour l'hébergeur

| Point | Ce qui a été fait | Pourquoi |
|---|---|---|
| Port | Écoute `process.env.PORT`, sur l'adresse `0.0.0.0` | Render impose le port. « localhost » n'accepterait que la machine elle-même : l'hébergeur ne verrait jamais le serveur démarrer. |
| HTTPS | `app.set("trust proxy", 1)` | Render termine le HTTPS devant l'application. Sans cette ligne, toutes les requêtes sembleraient venir de la même adresse IP et la limitation de débit bloquerait tout le monde d'un coup. |
| Cookies | `secure: true` quand `NODE_ENV=production` | Le cookie de connexion ne circule qu'en HTTPS. |
| Secrets | Le serveur **refuse de démarrer** si `SESSION_SECRET` est resté à sa valeur d'exemple en production | Sinon n'importe qui pourrait fabriquer un cookie de connexion valide. |
| Temps réel | Les autorisations d'origine croisée (CORS) sont désactivées en production | En ligne, la page et la connexion temps réel partent du même domaine : en autoriser d'autres ouvrirait le serveur inutilement. |
| Arrêt propre | `SIGTERM` ferme la base | Render envoie ce signal avant d'arrêter un service. |
| Surveillance | `/healthz` répond `{"ok":true}` | Render s'en sert pour vérifier que le service est vivant. |

### Comment on sait que ça marche

| Vérification | Commande |
|---|---|
| Le code fonctionne sur un **vrai PostgreSQL** (19 vérifications) | `npm run test:pg` |
| Le **client compilé** servi par Node fonctionne en mode production (22 vérifications) | `npm run build` puis `npm start`, et `npm run browser` |

`npm run test:pg` démarre un PostgreSQL réel dans un dossier temporaire, joue
tout le scénario (comptes, boards, partage, fusion, suppression en cascade),
puis supprime tout. Rien n'est installé durablement sur la machine.

---

## 3. Les valeurs à renseigner sur Render

Dans **Environment → Add Environment Variable** :

| Nom | Valeur | Où la trouver |
|---|---|---|
| `DATABASE_URL` | `postgresql://…` | Supabase ou Neon (voir la checklist) |
| `SESSION_SECRET` | une longue chaîne aléatoire | à générer, voir ci-dessous |
| `NODE_ENV` | `production` | à taper tel quel |

Pour générer le `SESSION_SECRET`, dans PowerShell :

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Ne pas définir `PORT` : Render s'en charge.

### Réglages du service Render

| Champ | Valeur |
|---|---|
| Language / Runtime | `Node` |
| Build Command | `npm run install:all && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| Instance Type | **Free** |
