import { useState } from "react";
import { useLocation } from "wouter";
import { supabase, type ContactType } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type ParsedContact = {
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
  type: ContactType;
};

type ManualForm = {
  first_name: string;
  last_name: string;
  type: ContactType;
  company: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

const TYPE_OPTIONS: ContactType[] = ["Professionnel", "Particulier"];

const inputCls = "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

export default function AddContact() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"ai" | "manual">("ai");

  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedContact | null>(null);
  const [parsing, setParsing] = useState(false);

  const [manual, setManual] = useState<ManualForm>({
    first_name: "", last_name: "", type: "Professionnel",
    company: "", email: "", phone: "", address: "", notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleParse() {
    if (!rawText.trim()) return;
    setParsing(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/parse-contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur lors de l'analyse");
      setParsed({ ...data, type: data.type ?? "Professionnel" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setParsing(false);
    }
  }

  async function handleSaveAI() {
    if (!parsed || !parsed.type) { setError("Le type est obligatoire."); return; }
    setSaving(true);
    setError(null);
    const { error: sbErr } = await supabase.from("clients").insert([
      { ...parsed, raw_input: rawText },
    ]);
    setSaving(false);
    if (sbErr) { setError(sbErr.message); return; }
    setSuccess(true);
    setTimeout(() => navigate("/contacts"), 1200);
  }

  async function handleSaveManual() {
    if (!manual.last_name.trim()) { setError("Le nom est obligatoire."); return; }
    setSaving(true);
    setError(null);
    const full_name = [manual.first_name.trim(), manual.last_name.trim()].filter(Boolean).join(" ");
    const { error: sbErr } = await supabase.from("clients").insert([{
      full_name,
      type: manual.type,
      company: manual.company || null,
      email: manual.email || null,
      phone: manual.phone || null,
      address: manual.address || null,
      notes: manual.notes || null,
      raw_input: null,
    }]);
    setSaving(false);
    if (sbErr) { setError(sbErr.message); return; }
    setSuccess(true);
    setTimeout(() => navigate("/contacts"), 1200);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-blue-700">Ajouter un contact</h1>
        <p className="text-gray-500 text-sm mt-1">Choisissez la methode de saisie.</p>
      </div>

      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => { setMode("ai"); setError(null); }}
          className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all", mode === "ai" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700")}
        >
          Analyse IA
        </button>
        <button
          onClick={() => { setMode("manual"); setError(null); }}
          className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all", mode === "manual" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700")}
        >
          Saisie manuelle
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-sm font-medium">
          Contact ajoute avec succes ! Redirection...
        </div>
      )}

      {mode === "ai" && (
        <>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-gray-700 mb-1 block">
                Informations libres du contact
              </span>
              <textarea
                value={rawText}
                onChange={(e) => { setRawText(e.target.value); setParsed(null); }}
                rows={5}
                placeholder={`Exemple:\nJean Dupont, directeur chez Acme SAS\nTel: 06 12 34 56 78\nEmail: jean.dupont@acme.fr\n12 rue de la Paix, Paris`}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </label>
            <button
              onClick={handleParse}
              disabled={!rawText.trim() || parsing}
              className="w-full bg-blue-700 hover:bg-blue-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {parsing ? "Analyse en cours..." : "Analyser avec l'IA"}
            </button>
          </div>

          {parsed && !success && (
            <div className="bg-white border border-blue-200 rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-yellow-400 text-lg">✓</span>
                Informations extraites — verifiez et corrigez si besoin
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Type *</label>
                  <div className="flex gap-3">
                    {TYPE_OPTIONS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setParsed({ ...parsed, type: t })}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all",
                          parsed.type === t
                            ? "bg-blue-700 text-white border-blue-700"
                            : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Nom complet *" value={parsed.full_name} onChange={(v) => setParsed({ ...parsed, full_name: v })} />
                <Field label="Email" value={parsed.email ?? ""} onChange={(v) => setParsed({ ...parsed, email: v || null })} />
                <Field label="Telephone" value={parsed.phone ?? ""} onChange={(v) => setParsed({ ...parsed, phone: v || null })} />
                <Field label="Entreprise" value={parsed.company ?? ""} onChange={(v) => setParsed({ ...parsed, company: v || null })} />
                <div className="sm:col-span-2">
                  <Field label="Adresse" value={parsed.address ?? ""} onChange={(v) => setParsed({ ...parsed, address: v || null })} />
                </div>
                <div className="sm:col-span-2">
                  <Field label="Notes" value={parsed.notes ?? ""} onChange={(v) => setParsed({ ...parsed, notes: v || null })} textarea />
                </div>
              </div>
              <button
                onClick={handleSaveAI}
                disabled={!parsed.full_name || saving}
                className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-300 text-blue-900 font-bold py-3 rounded-xl transition-colors"
              >
                {saving ? "Enregistrement..." : "Enregistrer le contact"}
              </button>
            </div>
          )}
        </>
      )}

      {mode === "manual" && !success && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Type *</label>
            <div className="flex gap-3">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setManual({ ...manual, type: t })}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all",
                    manual.type === t
                      ? "bg-blue-700 text-white border-blue-700"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Prenom</label>
              <input value={manual.first_name} onChange={(e) => setManual({ ...manual, first_name: e.target.value })} className={inputCls} placeholder="Jean" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nom *</label>
              <input value={manual.last_name} onChange={(e) => setManual({ ...manual, last_name: e.target.value })} className={inputCls} placeholder="Dupont" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Societe</label>
              <input value={manual.company} onChange={(e) => setManual({ ...manual, company: e.target.value })} className={inputCls} placeholder="Acme SAS" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
              <input type="email" value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} className={inputCls} placeholder="jean@example.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Telephone</label>
              <input value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} className={inputCls} placeholder="06 12 34 56 78" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Adresse</label>
              <input value={manual.address} onChange={(e) => setManual({ ...manual, address: e.target.value })} className={inputCls} placeholder="12 rue de la Paix, Paris" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <textarea value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} rows={2} className={inputCls + " resize-none"} placeholder="Informations supplementaires..." />
            </div>
          </div>

          <button
            onClick={handleSaveManual}
            disabled={!manual.last_name.trim() || saving}
            className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-300 text-blue-900 font-bold py-3 rounded-xl transition-colors"
          >
            {saving ? "Enregistrement..." : "Enregistrer le contact"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, textarea,
}: {
  label: string; value: string; onChange: (v: string) => void; textarea?: boolean;
}) {
  const cls = "w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} className={cls} rows={2} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}
