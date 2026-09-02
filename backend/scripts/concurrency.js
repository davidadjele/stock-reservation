/**
 * Démonstration du problème senior : il reste 1 article, deux clients le
 * réservent simultanément - une seule réservation doit réussir.
 *
 * Usage : npm run dev (dans un autre terminal) puis npm run test:concurrency
 */
const API = process.env.API ?? "http://localhost:3001";
const PRODUCT_ID = Number(process.env.PRODUCT_ID ?? 1);

const post = (action, quantity, key) =>
  fetch(`${API}/products/${PRODUCT_ID}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify({ quantity }),
  }).then(async (r) => ({ status: r.status, ...(await r.json()) }));

const label = (r) => `${r.status} - ${r.message ?? r.error}`;

async function main() {
  const products = await fetch(`${API}/products`).then((r) => r.json());
  const product = products.find((p) => p.id === PRODUCT_ID);
  if (!product) throw new Error(`Produit ${PRODUCT_ID} introuvable.`);

  // Ramène le stock à exactement 1 article.
  if (product.quantity > 1) await post("reserve", product.quantity - 1);
  else if (product.quantity < 1) await post("release", 1 - product.quantity);

  console.log(`Produit « ${product.name} » - stock ramené à 1.\n`);

  // Client A et Client B réservent le dernier article en même temps.
  const [a, b] = await Promise.all([post("reserve", 1), post("reserve", 1)]);
  console.log("Client A :", label(a));
  console.log("Client B :", label(b));

  const reserved = [a, b].filter((r) => r.status === 200).length;
  console.log(
    reserved === 1
      ? "\nOK - une seule réservation a réussi."
      : `\nECHEC - ${reserved} réservations ont réussi.`
  );

  // Idempotence : deux envois de la même clé ne libèrent qu'une fois.
  const key = `demo-${Date.now()}`;
  const first = await post("release", 1, key);
  const retry = await post("release", 1, key);
  console.log("\nLibération  :", label(first));
  console.log("Rejeu (même Idempotency-Key) :", label(retry));

  const stock = await fetch(`${API}/products`)
    .then((r) => r.json())
    .then((list) => list.find((p) => p.id === PRODUCT_ID).quantity);
  console.log(
    stock === 1
      ? "OK - le rejeu n'a pas produit de second effet."
      : `ECHEC - stock attendu 1, obtenu ${stock}.`
  );

  process.exitCode = reserved === 1 && stock === 1 ? 0 : 1;
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
