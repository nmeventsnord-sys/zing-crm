import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();

router.post("/ai/parse-contact", async (req, res): Promise<void> => {
  const { text } = req.body as { text?: string };

  if (!text || typeof text !== "string" || !text.trim()) {
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
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Extrais les informations de contact à partir du texte libre suivant. Réponds UNIQUEMENT avec un objet JSON valide contenant ces champs (utilise null pour les champs manquants) :
{
  "full_name": string,
  "email": string | null,
  "phone": string | null,
  "company": string | null,
  "address": string | null,
  "notes": string | null
}

Texte à analyser :
${text}`,
        },
      ],
    });

    const raw = message.content[0];
    if (raw.type !== "text") {
      res.status(500).json({ error: "Type de réponse IA inattendu." });
      return;
    }

    const jsonMatch = raw.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: "Impossible d'extraire le JSON de la réponse IA." });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err: unknown) {
    let userMessage = "Erreur lors de l'analyse IA.";
    if (err instanceof Error) {
      const raw = err.message;
      // Try to extract a clean Anthropic error message
      try {
        const jsonStart = raw.indexOf("{");
        if (jsonStart !== -1) {
          const parsed = JSON.parse(raw.slice(jsonStart)) as { error?: { message?: string } };
          if (parsed?.error?.message) {
            userMessage = parsed.error.message;
          } else {
            userMessage = raw;
          }
        } else {
          userMessage = raw;
        }
      } catch {
        userMessage = raw;
      }
    }
    res.status(500).json({ error: userMessage });
  }
});

export default router;
