import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useParams } from "wouter";
import { supabase, type Contact, type Quote, type QuoteItem, type ContactType, type SuiviItem, type ClientPerso } from "@/lib/supabase";
import { FORFAITS } from "@/lib/pricing";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { generatePdfFallback, type PdfPayload } from "@/lib/pdfFallback";

const round2 = (n: number) => Math.round(n * 100) / 100;

const TYPE_COLORS: Record<string, string> = {
  Professionnel: "bg-blue-100 text-blue-700 border-blue-200",
  Particulier: "bg-yellow-100 text-yellow-800 border-yellow-200",
};
const STATUS_LABELS: Record<string, string> = {
  en_attente: "En attente", accepte: "Accepté", refuse: "Refusé",
};
const STATUS_COLORS: Record<string, string> = {
  en_attente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  accepte: "bg-green-100 text-green-800 border-green-200",
  refuse: "bg-red-100 text-red-800 border-red-200",
};
const INT_TYPES = ["Appel", "Email", "Message", "Rencontre"];
const INT_ICONS: Record<string, string> = {
  Appel: "📞", Email: "✉️", Message: "💬", Rencontre: "🤝",
};
const INT_COLORS: Record<string, string> = {
  Appel: "bg-blue-100 text-blue-700 border-blue-200",
  Email: "bg-purple-100 text-purple-700 border-purple-200",
  Message: "bg-green-100 text-green-700 border-green-200",
  Rencontre: "bg-orange-100 text-orange-700 border-orange-200",
};

const inputCls = "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1";

function getForfaitRef(description: string): string {
  const f = FORFAITS.find((f) => f.label === description);
  if (f) return f.code;
  if (description.toLowerCase().includes("livraison")) return "fkm";
  if (description.toLowerCase().includes("remise") || description.toLowerCase().includes("smile")) return "rem";
  return "";
}

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  // ── Core data ─────────────────────────────────────────────────
  const [contact, setContact] = useState<Contact | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ── Tabs ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"infos" | "suivi">("infos");

  // ── Edit contact ─────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editPrenom, setEditPrenom] = useState("");
  const [editNom, setEditNom] = useState("");
  const [editType, setEditType] = useState<ContactType | "">("");
  const [editCompany, setEditCompany] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Quote detail expansion ────────────────────────────────────
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // ── Suivi ────────────────────────────────────────────────────
  const [suiviList, setSuiviList] = useState<SuiviItem[]>([]);
  const [loadingSuivi, setLoadingSuivi] = useState(false);
  const [addingInt, setAddingInt] = useState(false);
  const [intType, setIntType] = useState("Appel");
  const [intNote, setIntNote] = useState("");
  const [intDate, setIntDate] = useState(new Date().toISOString().split("T")[0]);
  const [savingInt, setSavingInt] = useState(false);
  const [intPhoto, setIntPhoto] = useState<File | null>(null);
  const [photoProgress, setPhotoProgress] = useState<number>(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [intDoc, setIntDoc] = useState<File | null>(null);
  const [docProgress, setDocProgress] = useState<number>(0);
  const [docError, setDocError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ── Personalization ───────────────────────────────────────────
  const [perso, setPerso] = useState<Partial<ClientPerso>>({});
  const [savingPerso, setSavingPerso] = useState(false);
  const [persoSaved, setPersoSaved] = useState(false);

  // ── Load ──────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: c }, { data: q }] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id).single(),
        supabase.from("quotes").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
      ]);
      if (!c) { setNotFound(true); setLoading(false); return; }
      setContact(c as Contact);
      setQuotes((q ?? []) as Quote[]);
      setLoading(false);
    }
    load();
  }, [id]);

  const loadSuivi = useCallback(async () => {
    setLoadingSuivi(true);
    try {
      const [sRes, pRes] = await Promise.all([
        fetch(`/api/suivi/${id}`),
        fetch(`/api/client-perso/${id}`),
      ]);
      if (sRes.ok) setSuiviList(await sRes.json());
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData) setPerso(pData);
      }
    } finally {
      setLoadingSuivi(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === "suivi") loadSuivi();
  }, [activeTab, loadSuivi]);

  // ── Edit contact ─────────────────────────────────────────────
  function openEdit() {
    if (!contact) return;
    const parts = contact.full_name?.trim().split(" ") ?? [];
    setEditPrenom(parts[0] ?? "");
    setEditNom(parts.slice(1).join(" "));
    setEditType(contact.type ?? "");
    setEditCompany(contact.company ?? "");
    setEditEmail(contact.email ?? "");
    setEditPhone(contact.phone ?? "");
    setEditAddress(contact.address ?? "");
    setEditNotes(contact.notes ?? "");
    setEditError(null);
    setIsEditing(true);
  }

  async function handleEditSave() {
    if (!editPrenom.trim()) { setEditError("Le prénom est obligatoire."); return; }
    setEditSaving(true);
    setEditError(null);
    const fullName = [editPrenom.trim(), editNom.trim()].filter(Boolean).join(" ");
    const { error: sbErr } = await supabase.from("clients").update({
      full_name: fullName, type: editType || null,
      company: editCompany.trim() || null, email: editEmail.trim() || null,
      phone: editPhone.trim() || null, address: editAddress.trim() || null,
      notes: editNotes.trim() || null,
    }).eq("id", id);
    setEditSaving(false);
    if (sbErr) { setEditError(sbErr.message); return; }
    setContact((prev) => prev ? {
      ...prev, full_name: fullName, type: (editType as ContactType) || null,
      company: editCompany.trim() || null, email: editEmail.trim() || null,
      phone: editPhone.trim() || null, address: editAddress.trim() || null,
      notes: editNotes.trim() || null,
    } : prev);
    setIsEditing(false);
  }

  // ── Quote status ─────────────────────────────────────────────
  async function updateStatus(quoteId: string, newStatus: Quote["statut"]) {
    setUpdatingStatus(quoteId);
    await supabase.from("quotes").update({ statut: newStatus }).eq("id", quoteId);
    setQuotes((prev) => prev.map((q) => q.id === quoteId ? { ...q, statut: newStatus } : q));
    setUpdatingStatus(null);
  }

  // ── PDF download helper ───────────────────────────────────────
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

  // ── PDF regeneration ─────────────────────────────────────────
  async function downloadPdf(q: Quote) {
    if (!contact) return;
    setGeneratingPdf(q.id);
    try {
      const nameParts = (contact.full_name ?? "").trim().split(" ");

      const lignes: Array<{ ref: string; designation: string; qte: number; pu_ttc: number }> =
        Array.isArray(q.lignes) && q.lignes.length > 0
          ? (q.lignes as Array<{ ref: string; designation: string; qte: number; pu_ttc: number }>)
          : ((q.items ?? []) as QuoteItem[]).map((item) => ({
              ref: getForfaitRef(item.description),
              designation: item.description,
              qte: item.quantity,
              pu_ttc: round2(item.unit_price * (1 + item.tva_rate / 100)),
            }));

      const pdfPayload: PdfPayload = {
        devis_num: q.numero ?? q.id,
        client: {
          prenom: nameParts[0] ?? "",
          nom: nameParts.slice(1).join(" "),
          email: contact.email ?? "",
          tel: contact.phone ?? "",
          societe: contact.company ?? "",
          adresse: contact.address ?? "",
          ville: "", type_event: "", date_event: "", lieu: "",
          type: contact.type ?? "Particulier",
        },
        lignes,
        note_livraison: q.notes ?? "",
        pro: contact.type === "Professionnel",
      };

      try {
        console.log("[PDF] Appel de /api/generate-pdf...");
        const res = await fetch("/api/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pdfPayload),
        });
        console.log("[PDF] Response status:", res.status);
        console.log("[PDF] Response ok:", res.ok);

        if (res.ok) {
          const blob = await res.blob();
          console.log("[PDF] Blob size:", blob.size);
          if (blob.size < 100) {
            throw new Error(`Blob trop petit (${blob.size} octets)`);
          }
          triggerDownload(blob, `${q.numero ?? "devis"}.pdf`);
          console.log("[PDF] Téléchargement déclenché avec succès (backend)");
        } else {
          const errText = await res.text().catch(() => "");
          console.error("[PDF] Erreur backend:", res.status, errText);
          throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
        }
      } catch (e) {
        console.error("[PDF] Erreur fetch, bascule vers jsPDF navigateur:", e);
        alert(`⚠️ API PDF indisponible (${(e as Error).message})\nGénération dans le navigateur...`);
        try {
          const fallbackBlob = generatePdfFallback(pdfPayload);
          console.log("[PDF] jsPDF blob size:", fallbackBlob.size);
          triggerDownload(fallbackBlob, `${q.numero ?? "devis"}.pdf`);
          console.log("[PDF] Téléchargement déclenché (jsPDF fallback)");
        } catch (e2) {
          console.error("[PDF] Erreur jsPDF:", e2);
          alert(`❌ Impossible de générer le PDF : ${(e2 as Error).message}`);
        }
      }
    } finally {
      setGeneratingPdf(null);
    }
  }

  // ── Suivi interactions ────────────────────────────────────────
  async function uploadPhoto(file: File): Promise<string | null> {
    setPhotoProgress(10);
    setPhotoError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const filename = `${id}/${Date.now()}.${ext}`;

    // Ensure bucket exists (auto-create attempt, graceful on failure)
    const { error: bucketErr } = await supabase.storage.createBucket("suivi-photos", { public: true });
    if (bucketErr && !bucketErr.message.includes("already exists") && !bucketErr.message.toLowerCase().includes("duplicate")) {
      // Not a "already exists" error — bucket creation failed, try upload anyway
      console.warn("Bucket create warning:", bucketErr.message);
    }

    setPhotoProgress(40);
    const { data, error } = await supabase.storage.from("suivi-photos").upload(filename, file, {
      cacheControl: "3600", upsert: false, contentType: file.type,
    });
    setPhotoProgress(90);

    if (error) {
      if (error.message.toLowerCase().includes("bucket") || error.message.toLowerCase().includes("not found")) {
        setPhotoError('Bucket introuvable. Créez le bucket "suivi-photos" (public) dans votre dashboard Supabase > Storage.');
      } else {
        setPhotoError(`Erreur upload : ${error.message}`);
      }
      setPhotoProgress(0);
      return null;
    }

    const { data: urlData } = supabase.storage.from("suivi-photos").getPublicUrl(data.path);
    setPhotoProgress(100);
    return urlData.publicUrl;
  }

  async function uploadDocument(file: File): Promise<string | null> {
    setDocProgress(10);
    setDocError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const filename = `${id}/${Date.now()}.${ext}`;

    const { error: bucketErr } = await supabase.storage.createBucket("suivi-documents", { public: true });
    if (bucketErr && !bucketErr.message.includes("already exists") && !bucketErr.message.toLowerCase().includes("duplicate")) {
      console.warn("Bucket create warning:", bucketErr.message);
    }

    setDocProgress(40);
    const { data, error } = await supabase.storage.from("suivi-documents").upload(filename, file, {
      cacheControl: "3600", upsert: false, contentType: file.type,
    });
    setDocProgress(90);

    if (error) {
      if (error.message.toLowerCase().includes("bucket") || error.message.toLowerCase().includes("not found")) {
        setDocError('Bucket introuvable. Créez le bucket "suivi-documents" (public) dans votre dashboard Supabase > Storage.');
      } else {
        setDocError(`Erreur upload : ${error.message}`);
      }
      setDocProgress(0);
      return null;
    }

    const { data: urlData } = supabase.storage.from("suivi-documents").getPublicUrl(data.path);
    setDocProgress(100);
    return urlData.publicUrl;
  }

  async function handleAddInteraction() {
    if (!intNote.trim()) return;
    setSavingInt(true);
    setPhotoError(null);
    setDocError(null);
    let photo_url: string | null = null;
    let document_url: string | null = null;
    let document_name: string | null = null;
    let document_type: string | null = null;
    try {
      if (intPhoto) {
        photo_url = await uploadPhoto(intPhoto);
        if (photo_url === null && photoError) { setSavingInt(false); return; }
      }
      if (intDoc) {
        document_url = await uploadDocument(intDoc);
        if (document_url === null && docError) { setSavingInt(false); return; }
        document_name = intDoc.name;
        document_type = intDoc.type;
      }
      const res = await fetch("/api/suivi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: id, type: intType, note: intNote, date_interaction: intDate, photo_url, document_url, document_name, document_type }),
      });
      if (res.ok) {
        const newItem = await res.json();
        setSuiviList((prev) => [newItem, ...prev]);
        setIntNote("");
        setIntDate(new Date().toISOString().split("T")[0]);
        setIntPhoto(null);
        setPhotoProgress(0);
        setIntDoc(null);
        setDocProgress(0);
        setAddingInt(false);
      }
    } finally {
      setSavingInt(false);
    }
  }

  async function handleDeleteInteraction(siId: string) {
    await fetch(`/api/suivi/${siId}`, { method: "DELETE" });
    setSuiviList((prev) => prev.filter((s) => s.id !== siId));
  }

  // ── Personalization ───────────────────────────────────────────
  async function handleSavePerso() {
    setSavingPerso(true);
    try {
      await fetch(`/api/client-perso/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(perso),
      });
      setPersoSaved(true);
      setTimeout(() => setPersoSaved(false), 2500);
    } finally {
      setSavingPerso(false);
    }
  }

  // ── Guards ────────────────────────────────────────────────────
  if (loading) return <div className="text-center py-20 text-gray-400">Chargement...</div>;
  if (notFound || !contact) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Contact introuvable.</p>
        <Link href="/contacts"><button className="text-blue-700 underline text-sm">Retour aux contacts</button></Link>
      </div>
    );
  }

  // ── Edit form ─────────────────────────────────────────────────
  if (isEditing) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <button onClick={() => setIsEditing(false)} className="text-sm text-gray-400 hover:text-blue-600 mb-2 block">← Annuler</button>
          <h1 className="text-2xl font-bold text-blue-700">Modifier le contact</h1>
        </div>
        {editError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{editError}</div>}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Prénom *</label><input value={editPrenom} onChange={(e) => setEditPrenom(e.target.value)} className={inputCls} placeholder="Prénom" /></div>
            <div><label className={labelCls}>Nom</label><input value={editNom} onChange={(e) => setEditNom(e.target.value)} className={inputCls} placeholder="Nom de famille" /></div>
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <div className="flex gap-3">
              {(["Particulier", "Professionnel"] as ContactType[]).map((t) => (
                <button key={t} onClick={() => setEditType(editType === t ? "" : t)}
                  className={cn("flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all",
                    editType === t ? (t === "Professionnel" ? "bg-blue-700 text-white border-blue-700" : "bg-yellow-400 text-blue-900 border-yellow-400") : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  )}>{t}</button>
              ))}
            </div>
          </div>
          <div><label className={labelCls}>Société</label><input value={editCompany} onChange={(e) => setEditCompany(e.target.value)} className={inputCls} placeholder="Nom de l'entreprise" /></div>
          <div><label className={labelCls}>Email</label><input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className={inputCls} placeholder="email@exemple.fr" /></div>
          <div><label className={labelCls}>Téléphone</label><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className={inputCls} placeholder="06 00 00 00 00" /></div>
          <div><label className={labelCls}>Adresse</label><input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className={inputCls} placeholder="Adresse complète" /></div>
          <div><label className={labelCls}>Notes</label><textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Informations complémentaires..." /></div>
          <div className="flex gap-3">
            <button onClick={handleEditSave} disabled={editSaving} className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors">
              {editSaving ? "Enregistrement..." : "Sauvegarder"}
            </button>
            <button onClick={() => setIsEditing(false)} className="px-6 py-3 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 font-semibold transition-colors">Annuler</button>
          </div>
        </div>
      </div>
    );
  }

  const isPro = contact.type === "Professionnel";

  // ── Main view ─────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxUrl}
              alt="photo plein écran"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-red-500 font-bold text-sm transition-colors"
            >✕</button>
            <a
              href={lightboxUrl}
              download
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-xs bg-white text-gray-700 px-3 py-1.5 rounded-full shadow font-medium hover:bg-gray-100 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >⬇ Télécharger</a>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/contacts"><button className="text-sm text-gray-400 hover:text-blue-600 mb-2 block">← Retour aux contacts</button></Link>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-12 h-12 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {contact.full_name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{contact.full_name}</h1>
              {contact.type && (
                <span className={cn("text-xs px-2.5 py-0.5 rounded-full border font-medium", TYPE_COLORS[contact.type] ?? "bg-gray-100 text-gray-600 border-gray-200")}>
                  {contact.type}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={openEdit} className="border border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-700 font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm">
            ✏️ Modifier
          </button>
          <button onClick={() => navigate(`/contacts/${contact.id}/quote`)}
            className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-5 py-2.5 rounded-xl transition-colors text-sm">
            + Nouveau devis
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(["infos", "suivi"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors",
              activeTab === tab ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
            )}>
            {tab === "infos" ? "Informations" : "Suivi"}
          </button>
        ))}
      </div>

      {/* ── INFORMATIONS TAB ─────────────────────────────────── */}
      {activeTab === "infos" && (
        <div className="space-y-5">
          {/* Contact info */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-2">Coordonnées</h2>
            <InfoRow label="Email" value={contact.email} />
            <InfoRow label="Téléphone" value={contact.phone} />
            <InfoRow label="Société" value={contact.company} />
            <InfoRow label="Adresse" value={contact.address} />
            <InfoRow label="Notes" value={contact.notes} />
            <InfoRow label="Ajouté le" value={formatDate(contact.created_at)} />
          </div>

          {/* Quotes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Devis ({quotes.length})</h2>
              <button onClick={() => navigate(`/contacts/${contact.id}/quote`)}
                className="text-sm text-blue-700 hover:text-blue-500 font-semibold">+ Nouveau devis</button>
            </div>

            {quotes.length === 0 ? (
              <div className="text-center py-10 bg-white border border-gray-100 rounded-2xl">
                <p className="text-gray-400 text-sm">Aucun devis pour ce contact.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {quotes.map((q) => {
                  const displayTotal = isPro ? (q.total_ht ?? 0) : (q.total_ttc ?? 0);
                  const displayLabel = isPro ? "HT" : "TTC";
                  const statut = q.statut ?? "en_attente";
                  const isExpanded = expandedQuote === q.id;
                  const items: QuoteItem[] = (q.items ?? []) as QuoteItem[];

                  return (
                    <div key={q.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-blue-200 transition-all">
                      {/* Quote summary row */}
                      <div className="p-4 flex items-center gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {q.numero && <span className="text-xs font-mono text-gray-400">{q.numero}</span>}
                            <span className="font-semibold text-gray-900 truncate">{q.titre}</span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0", STATUS_COLORS[statut] ?? "bg-gray-100 text-gray-500 border-gray-200")}>
                              {STATUS_LABELS[statut] ?? statut}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDate(q.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="font-bold text-blue-700">{formatCurrency(displayTotal)}</p>
                            <p className="text-xs text-gray-400">{displayLabel}</p>
                          </div>
                          <button onClick={() => setExpandedQuote(isExpanded ? null : q.id)}
                            className="text-xs border border-gray-300 hover:border-blue-400 hover:text-blue-700 text-gray-600 font-semibold px-3 py-1.5 rounded-lg transition-colors">
                            {isExpanded ? "Fermer ▲" : "Voir le devis ▼"}
                          </button>
                        </div>
                      </div>

                      {/* Expanded quote detail */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 px-4 pb-4 space-y-4 bg-gray-50">
                          {/* Items table */}
                          {items.length > 0 ? (
                            <div className="mt-3 overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-[#0D1B2A] text-white">
                                    <td className="px-3 py-2 font-semibold rounded-tl-lg">Désignation</td>
                                    <td className="px-3 py-2 font-semibold text-right">Qté</td>
                                    <td className="px-3 py-2 font-semibold text-right">P.U. HT</td>
                                    <td className="px-3 py-2 font-semibold text-right">P.U. TTC</td>
                                    <td className="px-3 py-2 font-semibold text-right rounded-tr-lg">Total TTC</td>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((item, i) => {
                                    const puTtc = item.unit_price * (1 + item.tva_rate / 100);
                                    const totalTtc = item.quantity * puTtc;
                                    return (
                                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                        <td className="px-3 py-2 text-gray-800">{item.description}</td>
                                        <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                                        <td className="px-3 py-2 text-right text-gray-500">{formatCurrency(item.unit_price)}</td>
                                        <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(round2(puTtc))}</td>
                                        <td className="px-3 py-2 text-right font-semibold text-blue-700">{formatCurrency(round2(totalTtc))}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-[#0D1B2A] text-white">
                                    <td colSpan={4} className="px-3 py-2 font-bold text-right rounded-bl-lg">NET À PAYER</td>
                                    <td className="px-3 py-2 font-bold text-right text-[#C9A84C] rounded-br-lg">{formatCurrency(q.total_ttc ?? 0)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 mt-3">Aucune ligne enregistrée.</p>
                          )}

                          {q.notes && (
                            <p className="text-xs text-gray-500 italic">Note : {q.notes}</p>
                          )}

                          {/* Status + PDF */}
                          <div className="flex items-center gap-3 flex-wrap pt-1">
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-semibold text-gray-600">Statut :</label>
                              <select
                                value={statut}
                                disabled={updatingStatus === q.id}
                                onChange={(e) => updateStatus(q.id, e.target.value as Quote["statut"])}
                                className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="en_attente">En attente</option>
                                <option value="accepte">Accepté</option>
                                <option value="refuse">Refusé</option>
                              </select>
                            </div>
                            <button
                              onClick={() => downloadPdf(q)}
                              disabled={generatingPdf === q.id}
                              className="flex items-center gap-1.5 bg-[#C9A84C] hover:bg-yellow-500 disabled:bg-gray-300 text-[#0D1B2A] font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
                            >
                              {generatingPdf === q.id ? "⏳ Génération..." : "⬇️ Télécharger le PDF"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUIVI TAB ────────────────────────────────────────── */}
      {activeTab === "suivi" && (
        <div className="space-y-5">
          {loadingSuivi ? (
            <div className="text-center py-10 text-gray-400 text-sm">Chargement...</div>
          ) : (
            <>
              {/* Interactions */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-800">Interactions ({suiviList.length})</h2>
                  <button
                    onClick={() => setAddingInt(!addingInt)}
                    className="bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {addingInt ? "Annuler" : "+ Ajouter une interaction"}
                  </button>
                </div>

                {/* Add interaction form */}
                {addingInt && (
                  <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {INT_TYPES.map((t) => (
                        <button key={t} onClick={() => setIntType(t)}
                          className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                            intType === t ? "bg-blue-700 text-white border-blue-700" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                          )}>
                          {INT_ICONS[t]} {t}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Date</label>
                        <input type="date" value={intDate} onChange={(e) => setIntDate(e.target.value)} className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Note *</label>
                      <textarea
                        value={intNote}
                        onChange={(e) => setIntNote(e.target.value)}
                        rows={3}
                        placeholder="Détails de l'interaction..."
                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    {/* Photo upload */}
                    <div>
                      <label className={labelCls}>Photo (optionnel)</label>
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="cursor-pointer flex items-center gap-2 bg-white border border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-700 px-3 py-2 rounded-xl text-xs font-semibold transition-colors">
                          <span>📷</span>
                          <span>{intPhoto ? intPhoto.name.slice(0, 24) + (intPhoto.name.length > 24 ? "…" : "") : "Choisir une photo"}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,.heic"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              setIntPhoto(f);
                              setPhotoError(null);
                              setPhotoProgress(0);
                            }}
                          />
                        </label>
                        {intPhoto && (
                          <button onClick={() => { setIntPhoto(null); setPhotoProgress(0); setPhotoError(null); }}
                            className="text-xs text-red-400 hover:text-red-600">✕ Retirer</button>
                        )}
                      </div>
                      {intPhoto && (
                        <div className="mt-2">
                          <img src={URL.createObjectURL(intPhoto)} alt="aperçu"
                            className="max-w-[200px] max-h-[150px] object-cover rounded-lg border border-gray-200" />
                        </div>
                      )}
                      {photoProgress > 0 && photoProgress < 100 && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 text-xs text-blue-600">
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                              <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${photoProgress}%` }} />
                            </div>
                            <span>{photoProgress}%</span>
                          </div>
                        </div>
                      )}
                      {photoError && (
                        <p className="mt-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{photoError}</p>
                      )}
                    </div>

                    {/* Document upload */}
                    <div>
                      <label className={labelCls}>Document (PDF, Word, image — optionnel)</label>
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="cursor-pointer flex items-center gap-2 bg-white border border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-700 px-3 py-2 rounded-xl text-xs font-semibold transition-colors">
                          <span>📎</span>
                          <span>{intDoc ? intDoc.name.slice(0, 28) + (intDoc.name.length > 28 ? "…" : "") : "Joindre un document"}</span>
                          <input
                            type="file"
                            accept="image/*,.pdf,.docx,.doc,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              setIntDoc(f);
                              setDocError(null);
                              setDocProgress(0);
                            }}
                          />
                        </label>
                        {intDoc && (
                          <button onClick={() => { setIntDoc(null); setDocProgress(0); setDocError(null); }}
                            className="text-xs text-red-400 hover:text-red-600">✕ Retirer</button>
                        )}
                      </div>
                      {intDoc && intDoc.type.startsWith("image/") && (
                        <div className="mt-2">
                          <img src={URL.createObjectURL(intDoc)} alt="aperçu"
                            className="max-w-[200px] max-h-[150px] object-cover rounded-lg border border-gray-200" />
                        </div>
                      )}
                      {docProgress > 0 && docProgress < 100 && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 text-xs text-blue-600">
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                              <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${docProgress}%` }} />
                            </div>
                            <span>{docProgress}%</span>
                          </div>
                        </div>
                      )}
                      {docError && (
                        <p className="mt-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{docError}</p>
                      )}
                    </div>

                    <button
                      onClick={handleAddInteraction}
                      disabled={savingInt || !intNote.trim()}
                      className="bg-blue-700 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors"
                    >
                      {savingInt ? (intPhoto && photoProgress < 100 ? `Envoi photo ${photoProgress}%…` : "Enregistrement...") : "Enregistrer l'interaction"}
                    </button>
                  </div>
                )}

                {/* Timeline */}
                {suiviList.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    Aucune interaction enregistrée.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {suiviList.map((s) => (
                      <div key={s.id} className="flex gap-3 px-5 py-4 hover:bg-gray-50 transition-colors group">
                        <div className="flex-shrink-0 mt-0.5">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", INT_COLORS[s.type] ?? "bg-gray-100 text-gray-600 border-gray-200")}>
                            {INT_ICONS[s.type] ?? ""} {s.type}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {s.note && <p className="text-sm text-gray-800">{s.note}</p>}
                          {s.photo_url && (
                            <button
                              onClick={() => setLightboxUrl(s.photo_url)}
                              className="mt-2 block focus:outline-none"
                              title="Voir en grand"
                            >
                              <img
                                src={s.photo_url}
                                alt="photo interaction"
                                className="max-w-[200px] max-h-[150px] object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity cursor-zoom-in"
                              />
                            </button>
                          )}
                          {s.document_url && (
                            <div className="mt-2">
                              {s.document_type?.startsWith("image/") ? (
                                <button
                                  onClick={() => setLightboxUrl(s.document_url)}
                                  className="block focus:outline-none"
                                  title="Voir en grand"
                                >
                                  <img
                                    src={s.document_url}
                                    alt={s.document_name ?? "document"}
                                    className="max-w-[200px] max-h-[150px] object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity cursor-zoom-in"
                                  />
                                </button>
                              ) : (
                                <a
                                  href={s.document_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-xs bg-gray-50 border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700 hover:text-blue-700 px-3 py-2 rounded-lg transition-colors"
                                >
                                  <span>
                                    {s.document_type?.includes("pdf") ? "📄" :
                                     (s.document_type?.includes("word") || s.document_type?.includes("doc")) ? "📝" : "📎"}
                                  </span>
                                  <span className="font-medium">{s.document_name ?? "Document"}</span>
                                  <span className="text-gray-400">⬇</span>
                                </a>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {s.date_interaction ?? formatDate(s.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteInteraction(s.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-xs transition-all flex-shrink-0"
                          title="Supprimer"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Personalization */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-gray-800">Personnalisation client</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Type d'événement préféré</label>
                    <input value={perso.type_evenement ?? ""} onChange={(e) => setPerso((p) => ({ ...p, type_evenement: e.target.value }))} className={inputCls} placeholder="Mariage, anniversaire..." />
                  </div>
                  <div>
                    <label className={labelCls}>Date de l'événement</label>
                    <input value={perso.date_evenement ?? ""} onChange={(e) => setPerso((p) => ({ ...p, date_evenement: e.target.value }))} className={inputCls} placeholder="jj/mm/aaaa" />
                  </div>
                  <div>
                    <label className={labelCls}>Lieu</label>
                    <input value={perso.lieu_evenement ?? ""} onChange={(e) => setPerso((p) => ({ ...p, lieu_evenement: e.target.value }))} className={inputCls} placeholder="Ville, salle..." />
                  </div>
                  <div>
                    <label className={labelCls}>Nombre de personnes</label>
                    <input value={perso.nb_personnes ?? ""} onChange={(e) => setPerso((p) => ({ ...p, nb_personnes: e.target.value }))} className={inputCls} placeholder="Ex : 150" />
                  </div>
                  <div>
                    <label className={labelCls}>Préférences photos</label>
                    <input value={perso.preferences_photos ?? ""} onChange={(e) => setPerso((p) => ({ ...p, preferences_photos: e.target.value }))} className={inputCls} placeholder="Filtres, cadres..." />
                  </div>
                  <div>
                    <label className={labelCls}>Code promo utilisé</label>
                    <input value={perso.code_promo ?? ""} onChange={(e) => setPerso((p) => ({ ...p, code_promo: e.target.value }))} className={inputCls} placeholder="SMILE10..." />
                  </div>
                  <div>
                    <label className={labelCls}>Source (comment ils ont connu TTS)</label>
                    <input value={perso.source_contact ?? ""} onChange={(e) => setPerso((p) => ({ ...p, source_contact: e.target.value }))} className={inputCls} placeholder="Instagram, bouche-à-oreille..." />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Commentaires personnalisés</label>
                  <textarea
                    value={perso.commentaires_perso ?? ""}
                    onChange={(e) => setPerso((p) => ({ ...p, commentaires_perso: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Notes personnalisées sur ce client..."
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSavePerso}
                    disabled={savingPerso}
                    className="bg-[#0D1B2A] hover:bg-blue-900 disabled:bg-gray-300 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    {savingPerso ? "Enregistrement..." : "Sauvegarder la personnalisation"}
                  </button>
                  {persoSaved && <span className="text-green-600 text-sm font-medium">✓ Sauvegardé</span>}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-gray-400 w-24 flex-shrink-0">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}
