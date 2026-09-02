import { useState } from "react";
import type { Action, Product } from "./api";

type Props = {
  product: Product;
  onSubmit: (id: number, action: Action, quantity: number) => Promise<void>;
};

export function ProductRow({ product, onSubmit }: Props) {
  const [quantity, setQuantity] = useState("1");
  const [pending, setPending] = useState(false);

  // Les boutons sont désactivés pendant l'appel : première barrière contre le
  // double envoi. La seconde est l'en-tête `Idempotency-Key`, côté serveur.
  async function run(action: Action) {
    setPending(true);
    try {
      await onSubmit(product.id, action, Number.parseInt(quantity, 10));
    } finally {
      setPending(false);
    }
  }

  return (
    <tr>
      <td>{product.name}</td>
      <td>
        {product.quantity}
        <span className="total"> / {product.capacity}</span>
      </td>
      <td>
        <input
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          aria-label={`Quantité pour ${product.name}`}
        />
      </td>
      <td>
        <button className="reserve" disabled={pending} onClick={() => run("reserve")}>
          Réserver
        </button>
        <button className="release" disabled={pending} onClick={() => run("release")}>
          Libérer
        </button>
      </td>
    </tr>
  );
}
