# Stock Reservation

Mini-application de réservation de stock : API Node/TypeScript + interface React.

## Lancer

Deux terminaux.

```bash
cd backend    && npm install && npm run dev   # API  → http://localhost:3001
cd frontend   && npm install && npm run dev   # UI   → http://localhost:5173
```

## Tests

Depuis le dossier `backend` :

```bash
npm test
```

Cette commande compile TypeScript puis lance les tests unitaires avec `node:test`.

Pour vérifier la concurrence avec l'API démarrée dans un autre terminal :

```bash
npm run test:concurrency
```

## Structure

```
backend/src/
  index.ts        serveur Express, middlewares, erreurs
  routes.ts       routes HTTP, validation, idempotence
  product.ts      modèle de données et stock en mémoire
  lock.ts         verrou par produit (concurrence)
backend/scripts/
  concurrency.js  démonstration du scénario de double réservation

frontend/src/
  App.tsx         liste des produits, messages succès/erreur
  ProductRow.tsx  une ligne : stock, saisie, réserver, libérer
  api.ts          client HTTP, types partagés, clés d'idempotence
```

## Modèle de données

```ts
type Product = {
  id: number;
  name: string;
  capacity: number; // stock total, borne haute immuable
  quantity: number; // stock disponible à la réservation
};
```

Invariant : `0 <= quantity <= capacity`.

`capacity` s'ajoute au modèle de l'énoncé pour borner `release` : sans borne
haute, on pourrait créer du stock à l'infini. Le stock vit en mémoire, donc
réinitialisé à chaque redémarrage.

## API

| Méthode | Route                   | Corps               | Réponses                   |
| ------- | ----------------------- | ------------------- | -------------------------- |
| `GET`   | `/products`             | -                   | `200`                      |
| `POST`  | `/products/:id/reserve` | `{ "quantity": 2 }` | `200`, `400`, `404`, `409` |
| `POST`  | `/products/:id/release` | `{ "quantity": 2 }` | `200`, `400`, `404`, `409` |

En-tête optionnel sur les `POST` : `Idempotency-Key: <chaîne unique>`.

- `400` - quantité non entière, nulle ou négative ; identifiant non numérique ; JSON invalide
- `404` - produit inconnu
- `409` - réservation supérieure au stock, ou libération dépassant le stock total

## Concurrence

Chaque produit a un verrou : les sections critiques sont chaînées dans une file
de promesses (`lock.ts`). Vérification du stock et écriture forment un bloc
atomique - deux requêtes ne peuvent pas lire le même stock avant décrément.

Deux détails qui comptent : la réponse est construite **dans** le verrou sur une
copie du produit (sinon elle refléterait un stock déjà modifié), et le verrou
est libéré même en cas d'erreur (sinon la file du produit reste bloquée).

Vérification, backend démarré :

```bash
npm run test:concurrency   # ramène le stock à 1, lance 2 réservations simultanées
```

## Double réservation

Deux situations, deux réponses :

1. **Deux clients, un article** - le verrou sérialise, une seule passe, l'autre
   reçoit `409`. Personne n'est servi silencieusement en double.
2. **Un client, deux envois** (double-clic, retry après timeout) - les deux
   requêtes sont légitimes et s'appliqueraient. C'est l'idempotence qui répond.
   Côté UI, les boutons sont aussi désactivés pendant l'appel.

## Idempotence

La première requête portant un `Idempotency-Key` exécute l'opération et mémorise
sa réponse ; toute requête ultérieure avec la même clé rejoue cette réponse sans
réappliquer l'effet. La lecture et l'écriture de la clé ont lieu dans le verrou,
donc deux requêtes concurrentes partageant une clé ne s'appliquent qu'une fois.
La clé est cantonnée à sa route.

```bash
curl -X POST localhost:3001/products/1/reserve \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: abc-123' \
  -d '{"quantity":1}'      # 200, stock décrémenté
# relancée à l'identique   # 200, même réponse, stock inchangé
```

Les clés sont en mémoire, sans expiration - à déplacer en Redis avec TTL.

## Sécurité essentielle

En place :

- validation stricte : `quantity` entier strictement positif ; identifiant validé
  par `Number` (et non `parseInt`, qui accepterait `1abc`)
- JSON malformé → `400` JSON, pas la page HTML par défaut d'Express
- corps limité à 10 ko
- CORS restreint à l'origine du frontend (variable `CORS_ORIGIN`)
- pas d'injection HTML : React échappe par défaut, aucun `dangerouslySetInnerHTML`
- erreurs inattendues → message générique, la pile reste côté serveur

Hors périmètre : pas d'authentification (rien n'associe une réservation à un
utilisateur), pas de limitation de débit.

## Améliorations production

- **Persistance** : PostgreSQL, concurrence gérée par la base -
  `UPDATE products SET quantity = quantity - $1 WHERE id = $2 AND quantity >= $1`,
  le nombre de lignes affectées tranche. Le verrou en mémoire ne protège qu'une
  instance : avec deux répliques, il ne protège plus rien.
- **Idempotence durable** : clés en Redis, TTL 24 h, partagées entre instances.
- **Réservations temporaires** : expiration des paniers abandonnés plutôt qu'un
  stock bloqué indéfiniment.
- **Journal des mouvements** plutôt qu'un compteur - `release` deviendrait
  « annuler la réservation X », ce qui rend `capacity` inutile.
- **Authentification** : `release` réservé au propriétaire ou à un administrateur.
- **Limitation de débit**, tests HTTP automatisés, logs structurés
  et métriques sur les `409` (un taux qui monte signale une rupture).

## Outils

Documentation officielle et ChatGPT, utilisés comme support pour valider certaines approches techniques. La solution a été développée par mes soins ; le code final a été relu, adapté, testé et validé par moi-même.
