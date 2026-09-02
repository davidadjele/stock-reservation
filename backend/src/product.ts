/**
 * Modèle de données.
 *
 * - `capacity` : stock total du produit (borne haute, immuable).
 * - `quantity` : stock disponible à la réservation.
 *
 * Invariant garanti par le domaine : 0 <= quantity <= capacity.
 * Réserver décrémente `quantity`, libérer l'incrémente sans dépasser `capacity`.
 */
export type Product = {
  id: number;
  name: string;
  capacity: number;
  quantity: number;
};

/** Stock en mémoire - tient lieu de base de données pour l'exercice. */
const products: Product[] = [
  { id: 1, name: "Laptop Lenovo", capacity: 5, quantity: 5 },
  { id: 2, name: "Souris USB", capacity: 10, quantity: 10 },
  { id: 3, name: "Clavier mécanique", capacity: 3, quantity: 3 },
];

export const listProducts = (): Product[] => products;

export const findProduct = (id: number): Product | undefined =>
  products.find((product) => product.id === id);
