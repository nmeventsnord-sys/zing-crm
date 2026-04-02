import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();

router.post("/ai/parse-quote", async (req, res): Promise<void> => {
  const { text } = req.body as { text?: string };

  if (!text?.trim()) {
    res.status(400).json({ error: "Le champ 'text' est requis." });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Clé API Anthropic non configurée." });
    return;
  }

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Tu es un assistant pour Time to Smile (location de borne photo).

TARIFS TTC :
f100=199, f200=299, f400=399, f800=499
LIVRAISON TTC : 0-10km=39, 10-15km=49, 15-30km=59, 30-40km=69, 40-50km=79, 50-60km=89, 60-80km=99
REMISE SMILE 40 : remise=40 uniquement si f200 ou f400 ou f800 ET "smile 40" mentionné, sinon remise=0. Jamais sur f100.

Analyse ce texte et retourne UNIQUEMENT du JSON pur, sans balises markdown, sans backticks, sans aucun texte avant ou après.

Format exact (remplace les valeurs) :
{"lignes":[{"ref":"f200","designation":"Location borne photo F200 — 2h00","qte":1,"pu_ttc":299.00}],"remise":0,"note_livraison":null}

Règles :
- ref : l'une de f100/f200/f400/f800 pour les forfaits, "livraison" pour la livraison, "autre" pour les autres
- designation : libellé clair en français
- qte : entier >= 1
- pu_ttc : prix unitaire TTC (positif, même pour les remises — le backend gère le signe)
- remise : 40 si Smile 40 applicable, sinon 0
- note_livraison : description livraison ou null

Texte : ${text}`,
        },
      ],
    });

    const raw = message.content[0];
    if (raw.type !== "text") {
      res.status(500).json({ error: "Type de réponse IA inattendu." });
      return;
    }

    let cleaned = raw.text.trim();

    // Strip markdown code fences
    cleaned = cleaned.replace(/```(?:json)?[\r\n]*/gi, "").replace(/```/g, "");

    // Extract the JSON object
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      res.status(500).json({
        error: "L'IA n'a pas retourné de JSON valide. Essayez de reformuler votre description.",
      });
      return;
    }
    cleaned = cleaned.slice(start, end + 1);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(500).json({
        error: "Impossible de lire la réponse IA. Essayez de reformuler votre description.",
      });
      return;
    }

    res.json(parsed);
  } catch (err: unknown) {
    let msg = "Erreur lors de l'analyse IA.";
    if (err instanceof Error) {
      try {
        const j = err.message.indexOf("{");
        if (j !== -1) {
          const p = JSON.parse(err.message.slice(j)) as { error?: { message?: string } };
          msg = p?.error?.message ?? err.message;
        } else {
          msg = err.message;
        }
      } catch { msg = err.message; }
    }
    res.status(500).json({ error: msg });
  }
});

export default router;
