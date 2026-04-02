import { Router } from "express";
import { generateDevis } from "../pdf/devis";

const router = Router();

router.post("/generate-pdf", async (req, res) => {
  try {
    const payload = req.body;
    console.log("[generate-pdf] Generating PDF for:", payload?.devis_num);
    const pdfBuffer = await generateDevis(payload);
    console.log("[generate-pdf] OK —", pdfBuffer.length, "octets");
    const num = payload?.devis_num ?? "devis";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${num}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error("[generate-pdf] Erreur:", e);
    res.status(500).json({ error: String(e) });
  }
});

export default router;
