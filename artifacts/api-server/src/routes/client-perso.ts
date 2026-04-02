import { Router } from "express";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

// GET /api/client-perso  — all records, optional ?statuses=nouveau,a_appeler
router.get("/client-perso", async (req, res): Promise<void> => {
  try {
    const statusParam = req.query["statuses"] as string | undefined;
    let query: string;
    let params: string[];
    if (statusParam) {
      const statuses = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
      query = `SELECT * FROM client_perso WHERE status = ANY($1) ORDER BY contact_id`;
      params = [statuses as unknown as string];
    } else {
      query = "SELECT * FROM client_perso ORDER BY contact_id";
      params = [];
    }
    const { rows } = await pool.query(query, params.length ? params : undefined);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/client-perso/:contactId
router.get("/client-perso/:contactId", async (req, res): Promise<void> => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM client_perso WHERE contact_id = $1",
      [req.params.contactId]
    );
    res.json(rows[0] ?? null);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// PATCH /api/client-perso/:contactId/status — quick status update
router.patch("/client-perso/:contactId/status", async (req, res): Promise<void> => {
  try {
    const { contactId } = req.params;
    const { status } = req.body as { status: string };
    if (!status) { res.status(400).json({ error: "status required" }); return; }
    await pool.query(
      `INSERT INTO client_perso (contact_id, status)
       VALUES ($1, $2)
       ON CONFLICT (contact_id) DO UPDATE SET status = $2, updated_at = now()`,
      [contactId, status]
    );
    res.json({ ok: true, contact_id: contactId, status });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// PUT /api/client-perso/:contactId — full upsert
router.put("/client-perso/:contactId", async (req, res): Promise<void> => {
  try {
    const { contactId } = req.params;
    const {
      type_evenement, date_evenement, lieu_evenement, nb_personnes,
      preferences_photos, code_promo, source_contact, commentaires_perso, status,
    } = req.body as Record<string, string>;
    const { rows } = await pool.query(
      `INSERT INTO client_perso
         (contact_id, type_evenement, date_evenement, lieu_evenement, nb_personnes,
          preferences_photos, code_promo, source_contact, commentaires_perso, status, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
       ON CONFLICT (contact_id) DO UPDATE SET
         type_evenement = $2, date_evenement = $3, lieu_evenement = $4, nb_personnes = $5,
         preferences_photos = $6, code_promo = $7, source_contact = $8,
         commentaires_perso = $9, status = COALESCE($10, client_perso.status), updated_at = now()
       RETURNING *`,
      [contactId, type_evenement||null, date_evenement||null, lieu_evenement||null,
       nb_personnes||null, preferences_photos||null, code_promo||null,
       source_contact||null, commentaires_perso||null, status||null]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
