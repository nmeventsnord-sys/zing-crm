import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { supabase, type Contact, type Quote } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
type Perso = {
  contact_id: string;
  status: string | null;
  source_contact: string | null;
  type_evenement: string | null;
  date_evenement: string | null;
  lieu_evenement: string | null;
};

type KanbanContact = Contact & { perso?: Perso };

type KanbanStats = {
  total: number;
  aAppeler: number;
  enAttente: number;
  confirmes: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function splitName(fullName: string): { prenom: string; nom: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { prenom: "", nom: parts[0] };
  return { prenom: parts[0], nom: parts.slice(1).join(" ") };
}

function round2(n: number) { return Math.round(n * 100) / 100; }
function ttcToHt(ttc: number) { return round2(ttc / 1.2); }

async function downloadPdf(quote: Quote, contact: Contact) {
  const { prenom, nom } = splitName(contact.full_name);
  const lines = (quote.lignes as Array<{ ref: string; designation: string; qte: number; pu_ttc: number }> | null) ?? [];
  const payload = {
    devis_num: quote.numero ?? "DEVIS",
    pro: contact.type === "Professionnel",
    client: {
      prenom,
      nom,
      email: contact.email ?? "",
      tel: contact.phone ?? "",
      societe: contact.company ?? "",
      type: contact.type ?? "Particulier",
    },
    lignes: lines.map((l) => ({
      ref: l.ref,
      designation: l.designation,
      qte: l.qte,
      pu_ttc: l.pu_ttc,
    })),
  };
  const res = await fetch("/api/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { alert("Erreur PDF"); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${quote.numero ?? "devis"}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

async function createAutoQuotes(contactId: string, contactName: string, contactType: string) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  const forfaits = [
    { code: "F100", label: "Location de borne photo + 100 tirages instantanes", pu: 199 },
    { code: "F200", label: "Location de borne photo + 200 tirages instantanes", pu: 299 },
  ];
  const results = [];
  for (const f of forfaits) {
    const ht = ttcToHt(f.pu);
    const tva = round2(ht * 0.2);
    const { data } = await supabase.from("quotes").insert({
      contact_id: contactId,
      contact_name: contactName,
      contact_type: contactType,
      numero: `DEV-${dateStr}-${suffix}-${f.code}`,
      titre: `Devis ${f.code} - ${contactName}`,
      forfait: f.code,
      lignes: [{ ref: f.code, designation: f.label, qte: 1, pu_ttc: f.pu }],
      total_ht: ht,
      total_tva: tva,
      total_ttc: f.pu,
      statut: "en_attente",
    }).select("*").single();
    if (data) results.push(data);
  }
  return results;
}

async function setClientStatus(contactId: string, status: string) {
  await fetch(`/api/client-perso/${contactId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

async function logRelance(contactId: string, quoteNum: string) {
  await fetch("/api/suivi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contact_id: contactId,
      type: "relance",
      note: `Relance devis ${quoteNum}`,
    }),
  });
}

// ── Source badge ───────────────────────────────────────────────────────────────
function SourceBadge({ perso, contact }: { perso?: Perso; contact: Contact }) {
  const src = perso?.source_contact ?? (() => {
    try {
      const raw = JSON.parse(contact.raw_input ?? "{}");
      if (raw.form_id === 8148) return "Site web Pro";
      if (raw.form_id === 8174) return "Site web Particulier";
    } catch (_) {}
    return "Appel";
  })();
  const isWeb = src?.startsWith("Site web");
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isWeb ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
      {isWeb ? "🌐 Site web" : "📞 Appel"}
    </span>
  );
}

// ── Appel entrant modal ────────────────────────────────────────────────────────
function AppelModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ prenom: "", nom: "", telephone: "", notes: "", date_evenement: "", type_evenement: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom.trim()) return;
    setSaving(true);
    try {
      const fullName = [form.prenom.trim(), form.nom.trim()].filter(Boolean).join(" ");
      const { data: contact, error } = await supabase.from("clients").insert({
        full_name: fullName,
        phone: form.telephone || null,
        notes: form.notes || null,
        type: "Particulier",
        raw_input: JSON.stringify({ source: "Appel" }),
      }).select("id").single();
      if (error) { alert("Erreur: " + error.message); setSaving(false); return; }
      const cid = (contact as { id: string }).id;
      await fetch(`/api/client-perso/${cid}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "a_appeler" }),
      });
      if (form.date_evenement || form.type_evenement) {
        await fetch(`/api/client-perso/${cid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_contact: "Appel",
            date_evenement: form.date_evenement || null,
            type_evenement: form.type_evenement || null,
            status: "a_appeler",
          }),
        });
      }
      onCreated();
    } finally { setSaving(false); }
  }

  const field = (key: keyof typeof form, label: string, type = "text", placeholder = "") => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-4">📞 Appel entrant</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field("prenom", "Prénom", "text", "Marie")}
            {field("nom", "Nom *", "text", "Dupont")}
          </div>
          {field("telephone", "Téléphone", "tel", "06 12 34 56 78")}
          {field("date_evenement", "Date événement", "date")}
          {field("type_evenement", "Type événement", "text", "Mariage, anniversaire...")}
          {field("notes", "Notes")}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 rounded-xl py-2.5 font-medium hover:bg-gray-50 transition-colors">Annuler</button>
            <button type="submit" disabled={saving || !form.nom.trim()} className="flex-1 bg-blue-700 text-white rounded-xl py-2.5 font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors">
              {saving ? "Enregistrement..." : "Créer le contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Column 1 Card ─────────────────────────────────────────────────────────────
function Col1Card({ client, onAction }: { client: KanbanContact; onAction: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [_, navigate] = useLocation();
  const days = daysSince(client.created_at);

  async function handleEuTel() {
    setLoading("eu");
    await setClientStatus(client.id, "devis_envoye");
    onAction();
    navigate(`/contacts/${client.id}/quote`);
  }

  async function handlePasEu() {
    setLoading("pas");
    await createAutoQuotes(client.id, client.full_name, client.type ?? "Particulier");
    await setClientStatus(client.id, "essai1_pas_eu");
    onAction();
    setLoading(null);
  }

  return (
    <div className="bg-white rounded-xl border border-red-100 p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-1">
        <p className="font-semibold text-gray-900 text-sm leading-tight">{client.full_name}</p>
        <span className="text-[10px] text-gray-400 ml-1 shrink-0">J+{days}</span>
      </div>
      {client.phone && <p className="text-xs text-blue-700 font-medium mb-1">📞 {client.phone}</p>}
      {client.perso?.type_evenement && <p className="text-xs text-gray-500">{client.perso.type_evenement}</p>}
      {client.perso?.date_evenement && <p className="text-xs text-gray-500">📅 {client.perso.date_evenement}</p>}
      <div className="my-2">
        <SourceBadge perso={client.perso} contact={client} />
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={handleEuTel}
          disabled={!!loading}
          className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg py-1.5 font-medium disabled:opacity-50 transition-colors"
        >
          {loading === "eu" ? "..." : "✓ Eu au tél"}
        </button>
        <button
          onClick={handlePasEu}
          disabled={!!loading}
          className="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg py-1.5 font-medium disabled:opacity-50 transition-colors"
        >
          {loading === "pas" ? "..." : "Pas eu au tél"}
        </button>
      </div>
    </div>
  );
}

// ── Column 2 Card ─────────────────────────────────────────────────────────────
function Col2Card({ client, quotes, onAction }: { client: KanbanContact; quotes: Quote[]; onAction: () => void }) {
  const [loading, setLoading] = useState(false);
  const [dlLoading, setDlLoading] = useState<string | null>(null);

  async function handleDevisEnvoyes() {
    setLoading(true);
    await setClientStatus(client.id, "devis_envoye");
    onAction();
    setLoading(false);
  }

  async function handleDownload(q: Quote) {
    setDlLoading(q.id);
    await downloadPdf(q, client);
    setDlLoading(null);
  }

  return (
    <div className="bg-white rounded-xl border border-orange-100 p-3 shadow-sm hover:shadow-md transition-shadow">
      <p className="font-semibold text-gray-900 text-sm mb-2">{client.full_name}</p>
      {quotes.length === 0 ? (
        <p className="text-xs text-gray-400 italic mb-2">Aucun devis généré</p>
      ) : (
        <div className="space-y-1 mb-2">
          {quotes.map((q) => (
            <div key={q.id} className="flex items-center justify-between bg-orange-50 rounded-lg px-2 py-1">
              <span className="text-xs text-gray-700 font-medium">{q.numero}</span>
              <span className="text-xs font-bold text-orange-700">{q.total_ttc}€</span>
              <button
                onClick={() => handleDownload(q)}
                disabled={dlLoading === q.id}
                className="text-[10px] bg-orange-500 hover:bg-orange-600 text-white px-2 py-0.5 rounded font-medium disabled:opacity-50"
              >
                {dlLoading === q.id ? "..." : "PDF"}
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={handleDevisEnvoyes}
        disabled={loading}
        className="w-full text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-1.5 font-medium disabled:opacity-50 transition-colors"
      >
        {loading ? "..." : "Devis envoyés ✓"}
      </button>
    </div>
  );
}

// ── Column 3 Card ─────────────────────────────────────────────────────────────
function Col3Card({ quote, onAction }: { quote: Quote; onAction: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const days = daysSince(quote.created_at);

  async function handleRelancer() {
    setLoading("relance");
    await logRelance(quote.contact_id ?? "", quote.numero ?? "?");
    alert("Relance enregistrée dans le suivi !");
    setLoading(null);
  }

  async function handleAccepte() {
    setLoading("acc");
    await supabase.from("quotes").update({ statut: "accepte" }).eq("id", quote.id);
    if (quote.contact_id) await setClientStatus(quote.contact_id, "confirme");
    onAction();
    setLoading(null);
  }

  async function handleRefuse() {
    setLoading("ref");
    await supabase.from("quotes").update({ statut: "refuse" }).eq("id", quote.id);
    if (quote.contact_id) await setClientStatus(quote.contact_id, "perdu");
    onAction();
    setLoading(null);
  }

  const isUrgent = days >= 7;
  const isRelance = days >= 2;

  return (
    <div className="bg-white rounded-xl border border-blue-100 p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-1">
        <p className="font-semibold text-gray-900 text-sm">{quote.contact_name ?? "—"}</p>
        {isUrgent ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full animate-pulse">RELANCE FINALE</span>
        ) : isRelance ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full">Relancer J+{days}</span>
        ) : null}
      </div>
      <p className="text-xs text-gray-500 mb-0.5">{quote.numero}</p>
      <p className="text-sm font-bold text-blue-700 mb-2">{quote.total_ttc ?? 0} € TTC</p>
      <p className="text-[10px] text-gray-400 mb-2">Envoyé il y a {days} jour{days !== 1 ? "s" : ""}</p>
      <div className="flex gap-1">
        <button onClick={handleRelancer} disabled={!!loading} className="flex-1 text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg py-1.5 font-medium disabled:opacity-50">
          {loading === "relance" ? "..." : "Relancer"}
        </button>
        <button onClick={handleAccepte} disabled={!!loading} className="flex-1 text-[10px] bg-green-600 hover:bg-green-700 text-white rounded-lg py-1.5 font-medium disabled:opacity-50">
          {loading === "acc" ? "..." : "✓ Accepté"}
        </button>
        <button onClick={handleRefuse} disabled={!!loading} className="flex-1 text-[10px] bg-red-400 hover:bg-red-500 text-white rounded-lg py-1.5 font-medium disabled:opacity-50">
          {loading === "ref" ? "..." : "✗ Refusé"}
        </button>
      </div>
    </div>
  );
}

// ── Column 4 Card ─────────────────────────────────────────────────────────────
function Col4Card({ client, quotes }: { client: KanbanContact; quotes: Quote[] }) {
  const bestQuote = quotes.find((q) => q.statut === "accepte") ?? quotes[0];
  return (
    <div className="bg-white rounded-xl border border-green-100 p-3 shadow-sm">
      <p className="font-semibold text-gray-900 text-sm mb-1">{client.full_name}</p>
      {client.perso?.date_evenement && <p className="text-xs text-gray-500">📅 {client.perso.date_evenement}</p>}
      {bestQuote && (
        <>
          <p className="text-xs text-gray-500">{bestQuote.forfait ?? bestQuote.titre}</p>
          <p className="text-sm font-bold text-green-700 mt-0.5">{bestQuote.total_ttc ?? 0} € TTC</p>
        </>
      )}
      <span className="inline-block mt-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Confirmé ✓</span>
    </div>
  );
}

// ── Kanban Column wrapper ──────────────────────────────────────────────────────
function KanbanColumn({
  title, count, color, headerBg, children,
}: {
  title: string; count: number; color: string; headerBg: string; children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col rounded-2xl border ${color} overflow-hidden min-h-[300px]`}>
      <div className={`${headerBg} px-3 py-2.5 flex items-center justify-between`}>
        <span className="text-white font-bold text-sm">{title}</span>
        <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-300px)]">
        {count === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6 italic">Aucun contact</p>
        ) : children}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [col1, setCol1] = useState<KanbanContact[]>([]);
  const [col2, setCol2] = useState<KanbanContact[]>([]);
  const [col2Quotes, setCol2Quotes] = useState<Record<string, Quote[]>>({});
  const [col3, setCol3] = useState<Quote[]>([]);
  const [col4, setCol4] = useState<KanbanContact[]>([]);
  const [col4Quotes, setCol4Quotes] = useState<Record<string, Quote[]>>({});
  const [stats, setStats] = useState<KanbanStats>({ total: 0, aAppeler: 0, enAttente: 0, confirmes: 0 });
  const [loading, setLoading] = useState(true);
  const [showAppelModal, setShowAppelModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all client_perso grouped by status
      const persoRes = await fetch("/api/client-perso");
      const allPerso: Perso[] = persoRes.ok ? await persoRes.json() : [];
      const persoById: Record<string, Perso> = {};
      allPerso.forEach((p) => { persoById[p.contact_id] = p; });

      const ids1 = allPerso.filter((p) => p.status === "nouveau" || p.status === "a_appeler").map((p) => p.contact_id);
      const ids2 = allPerso.filter((p) => p.status === "essai1_pas_eu").map((p) => p.contact_id);
      const ids4 = allPerso.filter((p) => p.status === "confirme").map((p) => p.contact_id);

      // Fetch clients + en_attente quotes in parallel
      const [c1Res, c2Res, c4Res, q3Res, totalRes] = await Promise.all([
        ids1.length ? supabase.from("clients").select("*").in("id", ids1).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
        ids2.length ? supabase.from("clients").select("*").in("id", ids2) : Promise.resolve({ data: [] }),
        ids4.length ? supabase.from("clients").select("*").in("id", ids4) : Promise.resolve({ data: [] }),
        supabase.from("quotes").select("*").eq("statut", "en_attente").order("created_at", { ascending: true }),
        supabase.from("clients").select("*", { count: "exact", head: true }),
      ]);

      const clients1 = ((c1Res.data ?? []) as Contact[]).map((c) => ({ ...c, perso: persoById[c.id] }));
      const clients2 = ((c2Res.data ?? []) as Contact[]).map((c) => ({ ...c, perso: persoById[c.id] }));
      const clients4 = ((c4Res.data ?? []) as Contact[]).map((c) => ({ ...c, perso: persoById[c.id] }));
      const quotes3 = (q3Res.data ?? []) as Quote[];

      setCol1(clients1);
      setCol3(quotes3);

      // Fetch quotes for col2 contacts
      if (ids2.length) {
        const { data: q2 } = await supabase.from("quotes").select("*").in("contact_id", ids2);
        const byClient: Record<string, Quote[]> = {};
        ((q2 ?? []) as Quote[]).forEach((q) => {
          if (!byClient[q.contact_id!]) byClient[q.contact_id!] = [];
          byClient[q.contact_id!].push(q);
        });
        setCol2Quotes(byClient);
      }

      // Fetch quotes for col4 contacts (accepte)
      if (ids4.length) {
        const { data: q4 } = await supabase.from("quotes").select("*").in("contact_id", ids4);
        const byClient4: Record<string, Quote[]> = {};
        ((q4 ?? []) as Quote[]).forEach((q) => {
          if (!byClient4[q.contact_id!]) byClient4[q.contact_id!] = [];
          byClient4[q.contact_id!].push(q);
        });
        setCol4Quotes(byClient4);
      }

      setCol2(clients2);
      setCol4(clients4);

      // Stats
      const thisMonth = new Date();
      thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
      const { count: confirmedThisMonth } = await supabase
        .from("clients").select("*", { count: "exact", head: true })
        .in("id", ids4.length ? ids4 : ["__none__"]);

      setStats({
        total: totalRes.count ?? 0,
        aAppeler: ids1.length,
        enAttente: quotes3.length,
        confirmes: confirmedThisMonth ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="mx-[-1rem] px-3">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total contacts", value: stats.total, color: "text-blue-700", bg: "bg-blue-50", icon: "👥" },
          { label: "À appeler", value: stats.aAppeler, color: "text-red-600", bg: "bg-red-50", icon: "📞" },
          { label: "Devis en attente", value: stats.enAttente, color: "text-orange-600", bg: "bg-orange-50", icon: "⏳" },
          { label: "Confirmés", value: stats.confirmes, color: "text-green-700", bg: "bg-green-50", icon: "✅" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-white shadow-sm`}>
            <div className="text-xl mb-1">{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{loading ? "—" : s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-gray-800">Pipeline commercial</h1>
        <div className="flex gap-2">
          <button
            onClick={() => loadData()}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            ↻ Actualiser
          </button>
          <button
            onClick={() => setShowAppelModal(true)}
            className="text-sm bg-blue-700 hover:bg-blue-600 text-white font-semibold px-4 py-1.5 rounded-xl shadow transition-colors"
          >
            📞 Appel entrant
          </button>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-4 gap-3">
        <KanbanColumn title="À appeler" count={col1.length} color="border-red-200 bg-red-50/50" headerBg="bg-red-500">
          {col1.map((c) => <Col1Card key={c.id} client={c} onAction={loadData} />)}
        </KanbanColumn>

        <KanbanColumn title="Devis à envoyer" count={col2.length} color="border-orange-200 bg-orange-50/50" headerBg="bg-orange-500">
          {col2.map((c) => (
            <Col2Card key={c.id} client={c} quotes={col2Quotes[c.id] ?? []} onAction={loadData} />
          ))}
        </KanbanColumn>

        <KanbanColumn title="En attente réponse" count={col3.length} color="border-blue-200 bg-blue-50/50" headerBg="bg-blue-600">
          {col3.map((q) => <Col3Card key={q.id} quote={q} onAction={loadData} />)}
        </KanbanColumn>

        <KanbanColumn title="Confirmés" count={col4.length} color="border-green-200 bg-green-50/50" headerBg="bg-green-600">
          {col4.map((c) => <Col4Card key={c.id} client={c} quotes={col4Quotes[c.id] ?? []} />)}
        </KanbanColumn>
      </div>

      {showAppelModal && (
        <AppelModal
          onClose={() => setShowAppelModal(false)}
          onCreated={() => { setShowAppelModal(false); loadData(); }}
        />
      )}
    </div>
  );
}
