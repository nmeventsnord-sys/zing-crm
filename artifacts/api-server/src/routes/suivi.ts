import { Router } from "express";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

router.get("/suivi/:contactId", async (req, res): Promise<void> => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM suivi WHERE contact_id = $1 ORDER BY created_at DESC",
      [req.params.contactId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/suivi", async (req, res): Promise<void> => {
  try {
    const {
      contact_id, type, note, date_interaction,
      photo_url, document_url, document_name, document_type,
    } = req.body as Record<string, string>;
    const { rows } = await pool.query(
      `INSERT INTO suivi
         (contact_id, type, note, date_interaction, photo_url,
          document_url, document_name, document_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        contact_id, type, note || null, date_interaction || null,
        photo_url || null, document_url || null,
        document_name || null, document_type || null,
      ]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/suivi/:id", async (req, res): Promise<void> => {
  try {
    await pool.query("DELETE FROM suivi WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
