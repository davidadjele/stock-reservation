import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { router } from "./routes";

const app = express();

// CORS restreint à l'origine du frontend (surchargeable par variable
// d'environnement pour un déploiement).
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "10kb" }));
app.use(router);

// Sans ce gestionnaire, un corps JSON malformé renvoie une page HTML.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: "Corps de requête JSON invalide." });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Erreur interne." });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`http://localhost:${port}`));
