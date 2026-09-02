import { Request, Response, Router } from "express";
import { findProduct, listProducts, Product } from "./product";
import { withLock } from "./lock";

/** Réponse HTTP décidée à l'intérieur du verrou. */
type Outcome = { status: number; body: unknown };

/**
 * Idempotence : une requête portant un en-tête `Idempotency-Key` déjà traité
 * rejoue la réponse mémorisée au lieu de rejouer l'effet. Un double-clic ou un
 * retry réseau ne réserve donc qu'une seule fois. La clé est cantonnée à sa
 * route pour qu'une même clé ne puisse pas mélanger réservation et libération.
 */
const replays = new Map<string, Outcome>();

/**
 * Valide l'entrée, puis exécute `apply` sous le verrou du produit.
 * `apply` est synchrone et sans effet de bord hors du produit : c'est la seule
 * portion de code autorisée à lire et modifier le stock.
 */
async function execute(
  req: Request,
  res: Response,
  apply: (product: Product, quantity: number) => Outcome
) {
  const id = Number(req.params.id);
  const { quantity } = (req.body ?? {}) as { quantity?: unknown };

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Identifiant invalide." });
    return;
  }
  if (!Number.isInteger(quantity) || (quantity as number) <= 0) {
    res.status(400).json({ error: "Quantité invalide : entier strictement positif attendu." });
    return;
  }

  const product = findProduct(id);
  if (!product) {
    res.status(404).json({ error: "Produit introuvable." });
    return;
  }

  const header = req.header("Idempotency-Key");
  const key = header ? `${req.path}:${header}` : undefined;

  // Lecture et écriture de la clé sont dans le verrou : deux requêtes
  // simultanées partageant la même clé ne s'appliquent qu'une fois.
  const outcome = await withLock(product.id, () => {
    const replay = key ? replays.get(key) : undefined;
    if (replay) return replay;

    const result = apply(product, quantity as number);
    if (key) replays.set(key, result);
    return result;
  });

  res.status(outcome.status).json(outcome.body);
}

/** Le corps est sérialisé après la libération du verrou : on renvoie une copie. */
const snapshot = (message: string, product: Product): Outcome => ({
  status: 200,
  body: { message, product: { ...product } },
});

export const router = Router();

router.get("/products", (_req, res) => {
  res.json(listProducts());
});

router.post("/products/:id/reserve", (req, res) =>
  execute(req, res, (product, quantity) => {
    if (product.quantity < quantity) {
      return {
        status: 409,
        body: { error: `Stock insuffisant (disponible : ${product.quantity}).` },
      };
    }
    product.quantity -= quantity;
    return snapshot(`Réservé. Stock disponible : ${product.quantity}`, product);
  })
);

router.post("/products/:id/release", (req, res) =>
  execute(req, res, (product, quantity) => {
    if (product.quantity + quantity > product.capacity) {
      return {
        status: 409,
        body: { error: `Libération refusée : le stock total (${product.capacity}) serait dépassé.` },
      };
    }
    product.quantity += quantity;
    return snapshot(`Libéré. Stock disponible : ${product.quantity}`, product);
  })
);
