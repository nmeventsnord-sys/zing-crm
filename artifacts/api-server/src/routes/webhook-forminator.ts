import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

function supabaseAdmin() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY not set");
  return createClient(url, key);
}

const FORM_PRO  = 8148;
const FORM_PART = 8174;

function extractFields(body: Record<string, unknown>): Record<string, string> {
  const raw: Record<string, unknown> =
    body["fields"] && typeof body["fields"] === "object" && !Array.isArray(body["fields"])
      ? (body["fields"] as Record<string, unknown>)
      : body;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = v == null ? "" : String(v);
  }
  return out;
}

// GET /api/webhook/forminator — health check for WordPress config
router.get("/webhook/forminator", (_req, res): void => {
  res.json({ status: "ok", message: "Webhook Forminator actif" });
});

// POST /api/webhook/forminator — public, no auth
router.post("/webhook/forminator", async (req, res): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const formId = Number(body["form_id"] ?? 0);
    const fields = extractFields(body);

    console.log(`[webhook-forminator] form_id=${formId}`, fields);

    const nom    = (fields["name-1"]    ?? "").trim();
    const prenom = (fields["name-2"]    ?? "").trim();
    const tel    = (fields["phone-1"]   ?? "").trim();
    const email  = (fields["email-1"]   ?? "").trim();
    const lieu   = (fields["text-3"]    ?? "").trim();
    const date   = (fields["date-1"]    ?? "").trim();
    const notes  = (fields["textarea-1"]?? "").trim();

    let type: "Particulier" | "Professionnel" = "Particulier";
    let societe = "";
    let sourceContact = "Site web Particulier";

    if (formId === FORM_PRO) {
      type          = "Professionnel";
      societe       = (fields["text-1"] ?? "").trim();
      sourceContact = "Site web Pro";
    } else if (formId === FORM_PART) {
      type          = "Particulier";
      sourceContact = "Site web Particulier";
    } else {
      console.warn(`[webhook-forminator] Unknown form_id=${formId}, defaulting to Particulier`);
    }

    const fullName = [prenom, nom].filter(Boolean).join(" ") || "Inconnu";
    const rawInput = JSON.stringify({ form_id: formId, source: sourceContact, ...fields });

    const sb = supabaseAdmin();
    const { data: contact, error: sbErr } = await sb
      .from("clients")
      .insert({
        full_name : fullName,
        type      : type,
        company   : societe || null,
        email     : email   || null,
        phone     : tel     || null,
        notes     : notes   || null,
        raw_input : rawInput,
      })
      .select("id")
      .single();

    if (sbErr) {
      console.error("[webhook-forminator] Supabase error:", sbErr.message);
      res.status(500).json({ ok: false, error: sbErr.message });
      return;
    }

    const contactId: string = (contact as { id: string }).id;
    console.log(`[webhook-forminator] Contact created id=${contactId}`);

    try {
      await pool.query(
        `INSERT INTO client_perso
           (contact_id, source_contact, lieu_evenement, date_evenement, status)
         VALUES ($1, $2, $3, $4, 'nouveau')
         ON CONFLICT (contact_id) DO UPDATE
           SET source_contact  = EXCLUDED.source_contact,
               lieu_evenement  = COALESCE(EXCLUDED.lieu_evenement, client_perso.lieu_evenement),
               date_evenement  = COALESCE(EXCLUDED.date_evenement, client_perso.date_evenement),
               status          = COALESCE(client_perso.status, 'nouveau'),
               updated_at      = now()`,
        [contactId, sourceContact, lieu || null, date || null]
      );
    } catch (persoErr) {
      console.warn("[webhook-forminator] client_perso upsert failed:", String(persoErr));
    }

    res.status(200).json({ ok: true, contact_id: contactId });
  } catch (err) {
    console.error("[webhook-forminator] Unexpected error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
