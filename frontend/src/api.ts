/** Miroir du modèle exposé par le backend (`backend/src/product.ts`). */
export type Product = {
  id: number;
  name: string;
  capacity: number;
  quantity: number;
};

export type Action = "reserve" | "release";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/** Erreur porteuse d'un message déjà lisible par l'utilisateur. */
export class ApiError extends Error {}

/** `crypto.randomUUID` exige un contexte sécurisé - localhost en est un. */
const newKey = () =>
  crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, init);
  } catch {
    throw new ApiError("Serveur injoignable. Lancez le backend sur le port 3001.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError((data as { error?: string }).error ?? `Erreur ${response.status}.`);
  }
  return data as T;
}

export const listProducts = () => request<Product[]>("/products");

export const submit = (id: number, action: Action, quantity: number) =>
  request<{ message: string; product: Product }>(`/products/${id}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Un renvoi de cette requête (retry réseau) ne produira pas un second effet.
      "Idempotency-Key": newKey(),
    },
    body: JSON.stringify({ quantity }),
  });
