import { useCallback, useEffect, useState } from "react";
import { ApiError, listProducts, submit, type Action, type Product } from "./api";
import { ProductRow } from "./ProductRow";

type Notice = { text: string; type: "ok" | "error" };

export function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  const report = useCallback((error: unknown) => {
    setNotice({
      text: error instanceof ApiError ? error.message : "Erreur inattendue.",
      type: "error",
    });
  }, []);

  useEffect(() => {
    listProducts().then(setProducts).catch(report);
  }, [report]);

  // Un seul minuteur à la fois : un message récent ne peut pas être effacé par
  // le minuteur d'un message précédent.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const run = useCallback(
    async (id: number, action: Action, quantity: number) => {
      try {
        const { message, product } = await submit(id, action, quantity);
        // Le serveur fait autorité sur le stock : on reprend sa réponse.
        setProducts((current) => current.map((p) => (p.id === product.id ? product : p)));
        setNotice({ text: message, type: "ok" });
      } catch (error) {
        report(error);
      }
    },
    [report]
  );

  return (
    <main>
      <h1>Réservation de stock</h1>

      <div className={`notice ${notice?.type ?? "hidden"}`} role="status">
        {notice?.text}
      </div>

      <table>
        <thead>
          <tr>
            <th>Produit</th>
            <th>Disponible</th>
            <th>Quantité</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <ProductRow key={product.id} product={product} onSubmit={run} />
          ))}
        </tbody>
      </table>
    </main>
  );
}
