import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { supabase, type Contact, type QuoteItem } from "@/lib/supabase";
import { FORFAITS, LIVRAISON_OPTIONS, SMILE40_PRICE_HT, SMILE40_ELIGIBLE, ttcToHt } from "@/lib/pricing";
import { formatCurrency, cn } from "@/lib/utils";
import { generatePdfFallback, type PdfPayload } from "@/lib/pdfFallback";

const round2 = (n: number) => Math.round(n * 100) / 100;

function computeTotals(items: QuoteItem[]) {
  return items.reduce(
    (acc, item) => {
      const ht = item.quantity * item.unit_price;
      const tva = ht * (item.tva_rate / 100);
      return { ht: acc.ht + ht, tva: acc.tva + tva, ttc: acc.ttc + ht + tva };
    },
    { ht: 0, tva: 0, ttc: 0 }
  );
}

async function generateQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from("quotes")
    .select("numero")
    .like("numero", `DEV-${year}-%`)
    .order("created_at", { ascending: false })
    .limit(100);
  let maxNum = 0;
  for (const row of data ?? []) {
    const parts = (row.numero as string | null)?.split("-");
    if (parts?.length === 3) {
      const n = parseInt(parts[2], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return `DEV-${year}-${String(maxNum + 1).padStart(3, "0")}`;
}

const inputCls = "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

export default function QuoteBuilder() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loadingContact, setLoadingContact] = useState(true);
  const [mode, setMode] = useState<"manual" | "ai">("manual");

  const [title, setTitle] = useState("Devis borne photo");
  const [notes, setNotes] = useState("");

  const [aiText, setAiText] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
  const [aiItems, setAiItems] = useState<QuoteItem[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [forfait, setForfait] = useState<string>("");
  const [hasLivraison, setHasLivraison] = useState(false);
  const [livraisonIdx, setLivraisonIdx] = useState(0);
  const [hasSmile40, setHasSmile40] = useState(false);
  const [extraItems, setExtraItems] = useState<Array<{ description: string; quantity: number; unit_price: number }>>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.from("clients").select("*").eq("id", id).single().then(({ data }) => {
      if (data) setContact(data as Contact);
      setLoadingContact(false);
    });
  }, [id]);

  const smile40Eligible = forfait !== "F100" && forfait !== "";

  useEffect(() => {
    if (!smile40Eligible) setHasSmile40(false);
  }, [smile40Eligible]);

  const manualItems = useMemo<QuoteItem[]>(() => {
    const items: QuoteItem[] = [];
    if (forfait) {
      const f = FORFAITS.find((x) => x.code === forfait);
      if (f) items.push({ description: f.label, quantity: 1, unit_price: ttcToHt(f.priceTTC), tva_rate: 20 });
    }
    if (hasLivraison) {
      const liv = LIVRAISON_OPTIONS[livraisonIdx];
      items.push({ description: `Livraison — ${liv.label}`, quantity: 1, unit_price: ttcToHt(liv.priceTTC), tva_rate: 20 });
    }
    if (hasSmile40 && smile40Eligible) {
      items.push({ description: "Remise Smile 40", quantity: 1, unit_price: SMILE40_PRICE_HT, tva_rate: 20 });
    }
    for (const e of extraItems) {
      if (e.description.trim()) {
        items.push({ description: e.description, quantity: e.quantity, unit_price: e.unit_price, tva_rate: 20 });
      }
    }
    return items;
  }, [forfait, hasLivraison, livraisonIdx, hasSmile40, smile40Eligible, extraItems]);

  const activeItems = mode === "manual" ? manualItems : (aiItems ?? []);
  const totals = computeTotals(activeItems);
  const isPro = contact?.type === "Professionnel";

  async function handleParseAI() {
    if (!aiText.trim()) return;
    setAiParsing(true);
    setAiError(null);
    setAiItems(null);
    try {
      const res = await fetch(`/api/ai/parse-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText }),
      });

      let payload: unknown;
      const rawText = await res.text();
      try {
        payload = JSON.parse(rawText);
      } catch {
        throw new Error("Réponse serveur illisible. Veuillez réessayer.");
      }

      const data = payload as Record<string, unknown>;
      if (!res.ok) throw new Error((data.error as string) ?? "Erreur IA");

      const lignes = data.lignes as Array<{
        ref: string;
        designation: string;
        qte: number;
        pu_ttc: number;
      }> | undefined;

      if (!Array.isArray(lignes) || lignes.length === 0) {
        throw new Error("Aucune ligne détectée. Reformulez votre description.");
      }

      const items: QuoteItem[] = lignes.map((l) => ({
        description: l.designation ?? l.ref ?? "Article",
        quantity: Number(l.qte) || 1,
        unit_price: round2(Number(l.pu_ttc) / 1.2),
        tva_rate: 20,
      }));

      const remise = Number(data.remise ?? 0);
      if (remise > 0) {
        items.push({
          description: "Remise Smile 40",
          quantity: 1,
          unit_price: round2(-remise / 1.2),
          tva_rate: 20,
        });
      }

      setAiItems(items);
      if (data.note_livraison && typeof data.note_livraison === "string") {
        setNotes(data.note_livraison);
      }
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiParsing(false);
    }
  }

  function updateAiItem(idx: number, field: keyof QuoteItem, value: string | number) {
    if (!aiItems) return;
    setAiItems(aiItems.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function addExtraItem() {
    setExtraItems([...extraItems, { description: "", quantity: 1, unit_price: 0 }]);
  }

  function updateExtraItem(idx: number, field: string, value: string | number) {
    setExtraItems(extraItems.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }

  function removeExtraItem(idx: number) {
    setExtraItems(extraItems.filter((_, i) => i !== idx));
  }

  function buildLignes(items: QuoteItem[]) {
    return items.map((item) => {
      const fMatch = FORFAITS.find((f) => f.label === item.description);
      const ref = fMatch?.code
        ?? (item.description.toLowerCase().includes("livraison") ? "fkm"
        : (item.description.toLowerCase().includes("remise") || item.description.toLowerCase().includes("smile")) ? "rem"
        : "");
      return {
        ref,
        designation: item.description,
        qte: item.quantity,
        pu_ttc: round2(item.unit_price * (1 + item.tva_rate / 100)),
      };
    });
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function handleSave() {
    if (!title.trim()) { setError("Le titre est obligatoire."); return; }
    if (activeItems.length === 0) { setError("Ajoutez au moins une ligne au devis."); return; }
    if (activeItems.some((i) => !i.description.trim())) { setError("Chaque ligne doit avoir une description."); return; }
    setSaving(true);
    setError(null);

    const quoteNumber = await generateQuoteNumber();
    const t = computeTotals(activeItems);
    const lignes = buildLignes(activeItems);

    const { error: sbErr } = await supabase.from("quotes").insert([{
      numero: quoteNumber,
      contact_id: contact?.id ?? null,
      contact_name: contact?.full_name ?? null,
      contact_type: contact?.type ?? null,
      titre: title,
      forfait: forfait || null,
      items: activeItems,
      lignes,
      total_ht: round2(t.ht),
      total_tva: round2(t.tva),
      total_ttc: round2(t.ttc),
      statut: "en_attente",
      notes: notes || null,
    }]);

    setSaving(false);
    if (sbErr) { setError(`Erreur Supabase : ${sbErr.message}`); return; }

    if (contact) {
      const nameParts = (contact.full_name ?? "").trim().split(" ");
      const pdfPayload: PdfPayload = {
        devis_num: quoteNumber,
        client: {
          prenom: nameParts[0] ?? "",
          nom: nameParts.slice(1).join(" "),
          email: contact.email ?? "",
          tel: contact.phone ?? "",
          societe: contact.company ?? "",
          adresse: contact.address ?? "",
          ville: "",
          type_event: "",
          date_event: "",
          lieu: "",
          type: contact.type ?? "Particulier",
        },
        lignes,
        note_livraison: notes || "",
        pro: contact.type === "Professionnel",
      };

      try {
        console.log("[PDF] Appel de /api/generate-pdf...");
        const pdfRes = await fetch("/api/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pdfPayload),
        });
        console.log("[PDF] Response status:", pdfRes.status);
        console.log("[PDF] Response ok:", pdfRes.ok);

        if (pdfRes.ok) {
          const blob = await pdfRes.blob();
          console.log("[PDF] Blob size:", blob.size);
          if (blob.size < 100) {
            throw new Error(`Blob trop petit (${blob.size} octets) — réponse invalide`);
          }
          triggerDownload(blob, `${quoteNumber}.pdf`);
          console.log("[PDF] Téléchargement déclenché avec succès (backend)");
        } else {
          const errText = await pdfRes.text().catch(() => "");
          console.error("[PDF] Erreur backend:", pdfRes.status, errText);
          throw new Error(`HTTP ${pdfRes.status}: ${errText.slice(0, 200)}`);
        }
      } catch (e) {
        console.error("[PDF] Erreur fetch, bascule vers jsPDF navigateur:", e);
        alert(`⚠️ API PDF indisponible (${(e as Error).message})\nGénération du PDF dans le navigateur...`);
        try {
          const fallbackBlob = generatePdfFallback(pdfPayload);
          console.log("[PDF] jsPDF blob size:", fallbackBlob.size);
          triggerDownload(fallbackBlob, `${quoteNumber}.pdf`);
          console.log("[PDF] Téléchargement déclenché (jsPDF fallback)");
        } catch (e2) {
          console.error("[PDF] Erreur jsPDF:", e2);
          alert(`❌ Impossible de générer le PDF : ${(e2 as Error).message}`);
        }
      }
    }

    setSuccess(true);
    setTimeout(() => navigate(`/contacts/${id}`), 2500);
  }

  if (loadingContact) {
    return <div className="text-center py-20 text-gray-400">Chargement...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <button onClick={() => navigate(`/contacts/${id}`)} className="text-sm text-gray-400 hover:text-blue-600 mb-2 block">
          ← Retour au contact
        </button>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-blue-700">Creer un devis</h1>
          {contact && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">{contact.full_name}</span>
              {contact.type && (
                <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium",
                  contact.type === "Professionnel"
                    ? "bg-blue-100 text-blue-700 border-blue-200"
                    : "bg-yellow-100 text-yellow-800 border-yellow-200"
                )}>
                  {contact.type}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setMode("manual")}
          className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
            mode === "manual" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700")}
        >
          Saisie manuelle
        </button>
        <button
          onClick={() => setMode("ai")}
          className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
            mode === "ai" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700")}
        >
          Analyse IA
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-sm font-medium flex items-center gap-2">
          <span>✅</span>
          <span>Devis enregistré et PDF téléchargé avec succès ! Redirection en cours...</span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Titre du devis</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Devis borne photo" />
        </div>

        {mode === "manual" && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Forfait *</label>
              <div className="grid grid-cols-2 gap-2">
                {FORFAITS.map((f) => (
                  <button
                    key={f.code}
                    onClick={() => setForfait(forfait === f.code ? "" : f.code)}
                    className={cn(
                      "border rounded-xl p-3 text-left transition-all",
                      forfait === f.code
                        ? "bg-blue-700 text-white border-blue-700"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                    )}
                  >
                    <div className="font-bold text-sm">{f.code} — {f.priceTTC} € TTC</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="livraison"
                  checked={hasLivraison}
                  onChange={(e) => setHasLivraison(e.target.checked)}
                  className="w-4 h-4 accent-blue-700"
                />
                <label htmlFor="livraison" className="text-sm font-semibold text-gray-700 cursor-pointer">
                  Livraison
                </label>
              </div>
              {hasLivraison && (
                <select
                  value={livraisonIdx}
                  onChange={(e) => setLivraisonIdx(parseInt(e.target.value))}
                  className={inputCls}
                >
                  {LIVRAISON_OPTIONS.map((opt, i) => (
                    <option key={i} value={i}>{opt.label} — {opt.priceTTC} € TTC</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="smile40"
                checked={hasSmile40}
                disabled={!smile40Eligible}
                onChange={(e) => setHasSmile40(e.target.checked)}
                className="w-4 h-4 accent-blue-700 disabled:opacity-40"
              />
              <label htmlFor="smile40" className={cn("text-sm font-semibold cursor-pointer", !smile40Eligible ? "text-gray-400" : "text-gray-700")}>
                Remise Smile 40 (-40 € TTC)
                {!smile40Eligible && forfait === "F100" && <span className="text-xs font-normal ml-1">(non applicable sur F100)</span>}
                {!smile40Eligible && !forfait && <span className="text-xs font-normal ml-1">(choisir un forfait d'abord)</span>}
              </label>
            </div>

            {extraItems.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-600">Lignes supplementaires</label>
                {extraItems.map((e, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      value={e.description}
                      onChange={(ev) => updateExtraItem(idx, "description", ev.target.value)}
                      placeholder="Description..."
                      className="col-span-6 border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number" min={1}
                      value={e.quantity}
                      onChange={(ev) => updateExtraItem(idx, "quantity", parseFloat(ev.target.value) || 1)}
                      className="col-span-2 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number" min={0} step={0.01}
                      value={e.unit_price}
                      onChange={(ev) => updateExtraItem(idx, "unit_price", parseFloat(ev.target.value) || 0)}
                      className="col-span-3 border border-gray-300 rounded-lg px-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={() => removeExtraItem(idx)} className="col-span-1 text-red-400 hover:text-red-600 text-lg leading-none text-center">×</button>
                  </div>
                ))}
                <div className="text-xs text-gray-400 px-1">Prix en HT</div>
              </div>
            )}

            <button onClick={addExtraItem} className="text-xs text-blue-700 hover:text-blue-500 font-semibold">
              + Ajouter une ligne personnalisee
            </button>
          </>
        )}

        {mode === "ai" && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-gray-600 mb-1 block">Decrivez le devis en texte libre</span>
              <textarea
                value={aiText}
                onChange={(e) => { setAiText(e.target.value); setAiItems(null); }}
                rows={4}
                placeholder={'Ex: "location borne photo F200 avec livraison 39\u20ac, remise Smile 40"'}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </label>
            <button
              onClick={handleParseAI}
              disabled={!aiText.trim() || aiParsing}
              className="w-full bg-blue-700 hover:bg-blue-600 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              {aiParsing ? "Analyse en cours..." : "Analyser avec l'IA"}
            </button>
            {aiError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{aiError}</div>}
            {aiItems && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600">Lignes extraites — modifiables :</p>
                <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 px-1">
                  <span className="col-span-6">Description</span>
                  <span className="col-span-2 text-center">Qte</span>
                  <span className="col-span-3 text-right">Prix HT (€)</span>
                </div>
                {aiItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      value={item.description}
                      onChange={(e) => updateAiItem(idx, "description", e.target.value)}
                      className="col-span-6 border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number" min={1}
                      value={item.quantity}
                      onChange={(e) => updateAiItem(idx, "quantity", parseFloat(e.target.value) || 1)}
                      className="col-span-2 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number" step={0.01}
                      value={item.unit_price}
                      onChange={(e) => updateAiItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                      className="col-span-3 border border-gray-300 rounded-lg px-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => setAiItems(aiItems.filter((_, i) => i !== idx))}
                      disabled={aiItems.length === 1}
                      className="col-span-1 text-red-400 hover:text-red-600 disabled:opacity-20 text-lg text-center leading-none"
                    >×</button>
                  </div>
                ))}
                <button
                  onClick={() => setAiItems([...aiItems, { description: "", quantity: 1, unit_price: 0, tva_rate: 20 }])}
                  className="text-xs text-blue-700 hover:text-blue-500 font-semibold"
                >
                  + Ajouter une ligne
                </button>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optionnel)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Conditions particulieres, remarques..."
          />
        </div>
      </div>

      {activeItems.length > 0 && (
        <div className="bg-white border border-blue-100 rounded-2xl p-5 space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recapitulatif</h3>
          {activeItems.map((item, i) => {
            const lineHT = item.quantity * item.unit_price;
            const lineTTC = lineHT * (1 + item.tva_rate / 100);
            return (
              <div key={i} className="flex justify-between text-sm text-gray-700">
                <span>{item.description} {item.quantity > 1 ? `× ${item.quantity}` : ""}</span>
                <span className="font-medium">{formatCurrency(isPro ? lineHT : lineTTC)}</span>
              </div>
            );
          })}
          <div className="border-t border-gray-100 pt-3 mt-3 space-y-1">
            {isPro ? (
              <>
                <div className="flex justify-between text-sm text-gray-500"><span>Total HT</span><span>{formatCurrency(totals.ht)}</span></div>
                <div className="flex justify-between text-sm text-gray-500"><span>TVA 20 %</span><span>{formatCurrency(totals.tva)}</span></div>
                <div className="flex justify-between text-base font-bold text-blue-700"><span>Total TTC</span><span>{formatCurrency(totals.ttc)}</span></div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm text-gray-400"><span>HT</span><span>{formatCurrency(totals.ht)}</span></div>
                <div className="flex justify-between text-base font-bold text-blue-700"><span>NET \u00c0 PAYER TTC</span><span>{formatCurrency(totals.ttc)}</span></div>
              </>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || activeItems.length === 0}
        className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-300 text-blue-900 font-bold py-3.5 rounded-xl transition-colors text-base"
      >
        {saving ? "Enregistrement..." : "Enregistrer et telecharger le PDF"}
      </button>
    </div>
  );
}
