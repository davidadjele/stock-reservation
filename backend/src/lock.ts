/**
 * Concurrence : un verrou par produit.
 *
 * Chaque section critique est chaînée derrière la précédente pour le même
 * produit. Lire puis écrire le stock devient atomique : deux requêtes
 * simultanées ne peuvent pas observer le même stock avant décrément.
 * Le chaînage reste valable si la section critique devient asynchrone
 * (appel à une base de données).
 */
const locks = new Map<number, Promise<unknown>>();

export function withLock<T>(id: number, critical: () => T | Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  const result = previous.then(critical);

  // La file ne doit pas rester bloquée si la section critique échoue.
  locks.set(
    id,
    result.then(
      () => {},
      () => {}
    )
  );

  return result;
}
