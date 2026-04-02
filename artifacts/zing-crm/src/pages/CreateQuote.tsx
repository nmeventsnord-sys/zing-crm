import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { supabase, type Contact, type QuoteItem, type ContactType } from "@/lib/supabase";
import { formatCurrency, cn } from "@/lib/utils";

const TVA_OPTIONS = [0, 5.5, 10, 20];

function newItem(): QuoteItem {
  return { description: "", quantity: 1, unit_price: 0, tva_rate: 20 };
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
    if (parts && parts.length === 3) {
      const n = parseInt(parts[2], 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return `DEV-${year}-${String(maxNum + 1).padStart(3, "0")}`;
}

export default function CreateQuote() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const prefilledContactId = params.get("contact_id") ?? "";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState<string>(prefilledContactId);
  const [contactType, setContactType] = useState<ContactType | null>(null);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<QuoteItem[]>([newItem()]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.from("clients").select("id, full_name, company, type").order("full_name").then(({ data }) => {
      const list = (data ?? []) as Contact[];
      setContacts(list);
      if (prefilledContactId) {
        const c = list.find((x) => x.id === prefilledContactId);
        if (c) setContactType(c.type ?? null);
      }
    });
  }, [prefilledContactId]);

  useEffect(() => {
    if (!contactId) { setContactType(null); return; }
    const c = contacts.find((x) => x.id === contactId);
    setContactType(c?.type ?? null);
  }, [contactId, contacts]);

  const isPro = contactType === "Professionnel";

  const totals = items.reduce(
    (acc, item) => {
      const ht = item.quantity * item.unit_price;
      const tva = ht * (item.tva_rate / 100);
      return { ht: acc.ht + ht, tva: acc.tva + tva, ttc: acc.ttc + ht + tva };
    },
    { ht: 0, tva: 0, ttc: 0 }
  );

  function addItem() { setItems([...items, newItem()]); }
  function removeItem(idx: number) { setItems(items.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, field: keyof QuoteItem, value: string | number) {
    setItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  async function handleSave() {
    if (!title.trim()) { setError("Le titre est obligatoire."); return; }
    if (items.some((i) => !i.description.trim())) { setError("Chaque ligne doit avoir une description."); return; }
    setSaving(true);
    setError(null);

    const quoteNumber = await generateQuoteNumber();
    const selectedContact = contacts.find((c) => c.id === contactId);

    const { error: sbErr } = await supabase.from("quotes").insert([{
      numero: quoteNumber,
      contact_id: contactId || null,
      contact_name: selectedContact?.full_name ?? null,
      contact_type: selectedContact?.type ?? null,
      titre: title,
      items,
      total_ht: totals.ht,
      total_tva: totals.tva,
      total_ttc: totals.ttc,
      statut: "en_attente",
      notes: notes || null,
    }]);
    setSaving(false);
    if (sbErr) { setError(sbErr.message); return; }
    setSuccess(true);
    setTimeout(() => navigate("/quotes"), 1200);
  }

  const inputCls = "border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-blue-700">Creer un devis</h1>
        <p className="text-gray-500 text-sm mt-1">Remplissez les lignes et enregistrez.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-sm font-medium">
          Devis cree ! Redirection...
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Titre du devis *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Refonte site web, Prestation conseil..."
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Client</label>
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">-- Selectionner un client --</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}{c.company ? ` — ${c.company}` : ""}{c.type ? ` (${c.type})` : ""}
              </option>
            ))}
          </select>
          {contactType && (
            <p className="text-xs mt-1 text-gray-500">
              Client {contactType} — prix affiches en <strong>{isPro ? "HT" : "TTC"}</strong> par defaut.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-gray-600">Lignes du devis</label>
            <button onClick={addItem} className="text-xs text-blue-700 hover:text-blue-500 font-semibold">
              + Ajouter une ligne
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 px-1">
              <span className="col-span-5">Description</span>
              <span className="col-span-2 text-center">Qte</span>
              <span className="col-span-2 text-right">Prix HT (€)</span>
              <span className="col-span-2 text-center">TVA %</span>
              <span className="col-span-1" />
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  value={item.description}
                  onChange={(e) => updateItem(idx, "description", e.target.value)}
                  placeholder="Description..."
                  className={cn(inputCls, "col-span-5")}
                />
                <input
                  type="number" min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                  className={cn(inputCls, "col-span-2 text-center")}
                />
                <input
                  type="number" min={0} step={0.01}
                  value={item.unit_price}
                  onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                  className={cn(inputCls, "col-span-2 text-right")}
                />
                <select
                  value={item.tva_rate}
                  onChange={(e) => updateItem(idx, "tva_rate", parseFloat(e.target.value))}
                  className={cn(inputCls, "col-span-2 text-center")}
                >
                  {TVA_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t} %</option>
                  ))}
                </select>
                <button
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  className="col-span-1 text-red-400 hover:text-red-600 disabled:opacity-20 text-center text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4 space-y-2">
            <TotalRow label="Total HT" value={totals.ht} highlight={isPro} />
            <TotalRow label="Total TVA" value={totals.tva} />
            <TotalRow label="Total TTC" value={totals.ttc} highlight={!isPro} large />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optionnel)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Conditions, remarques..."
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-700 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors"
        >
          {saving ? "Enregistrement..." : "Enregistrer le devis"}
        </button>
      </div>
    </div>
  );
}

function TotalRow({ label, value, highlight, large }: { label: string; value: number; highlight?: boolean; large?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between px-1", highlight && "font-bold")}>
      <span className={cn("text-sm", highlight ? "text-gray-800" : "text-gray-500")}>{label}</span>
      <span className={cn(large ? "text-xl font-bold text-blue-700" : highlight ? "text-base font-bold text-blue-600" : "text-sm text-gray-600")}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
