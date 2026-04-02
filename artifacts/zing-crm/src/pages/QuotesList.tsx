import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { supabase, type Quote } from "@/lib/supabase";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

type Statut = "all" | "en_attente" | "accepte" | "refuse";

const STATUS_LABELS: Record<string, string> = {
  en_attente: "En attente",
  accepte: "Accepte",
  refuse: "Refuse",
};

const STATUS_COLORS: Record<string, string> = {
  en_attente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  accepte: "bg-green-100 text-green-800 border-green-200",
  refuse: "bg-red-100 text-red-800 border-red-200",
};

export default function QuotesList() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statutFilter, setStatutFilter] = useState<Statut>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("quotes").select("*").order("created_at", { ascending: false });
    if (statutFilter !== "all") q = q.eq("statut", statutFilter);
    const { data } = await q;
    setQuotes((data ?? []) as Quote[]);
    setLoading(false);
  }, [statutFilter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatut(id: string, statut: "en_attente" | "accepte" | "refuse") {
    setUpdating(id);
    await supabase.from("quotes").update({ statut }).eq("id", id);
    setQuotes((prev) => prev.map((q) => q.id === id ? { ...q, statut } : q));
    setUpdating(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce devis ?")) return;
    await supabase.from("quotes").delete().eq("id", id);
    setQuotes((prev) => prev.filter((q) => q.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-blue-700">Devis</h1>
        <Link href="/quotes/create">
          <button className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-5 py-2.5 rounded-xl transition-colors text-sm">
            + Creer un devis
          </button>
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "en_attente", "accepte", "refuse"] as Statut[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatutFilter(s)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium border transition-all",
              statutFilter === s
                ? "bg-blue-700 text-white border-blue-700"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
            )}
          >
            {s === "all" ? "Tous" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📄</div>
          <p className="text-gray-500 mb-4">Aucun devis pour l'instant.</p>
          <Link href="/quotes/create">
            <button className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-6 py-3 rounded-xl text-lg">
              + Creer un devis
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {quotes.map((q) => {
            const isPro = q.contact_type === "Professionnel";
            const displayTotal = isPro ? (q.total_ht ?? 0) : (q.total_ttc ?? 0);
            const displayLabel = isPro ? "HT" : "TTC";
            const statut = q.statut ?? "en_attente";
            return (
              <div key={q.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-blue-200 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {q.numero && (
                        <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{q.numero}</span>
                      )}
                      <h3 className="font-semibold text-gray-900">{q.titre}</h3>
                      <span className={cn("text-xs px-2.5 py-0.5 rounded-full border font-medium", STATUS_COLORS[statut] ?? "bg-gray-100 text-gray-500 border-gray-200")}>
                        {STATUS_LABELS[statut] ?? statut}
                      </span>
                    </div>
                    {q.contact_name && (
                      <p className="text-sm text-blue-600 mt-0.5">{q.contact_name}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(q.created_at)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-blue-700">{formatCurrency(displayTotal)}</p>
                    <p className="text-xs text-gray-400">{displayLabel}</p>
                    {q.total_ht != null && q.total_ttc != null && (
                      <p className="text-xs text-gray-400">
                        {isPro ? `TTC: ${formatCurrency(q.total_ttc)}` : `HT: ${formatCurrency(q.total_ht)}`}
                      </p>
                    )}
                  </div>
                </div>

                {q.items && q.items.length > 0 && (
                  <div className="mt-3 border-t border-gray-100 pt-3 space-y-1">
                    {q.items.map((item, i) => {
                      const lineHT = item.quantity * item.unit_price;
                      const lineTTC = lineHT * (1 + (item.tva_rate ?? 0) / 100);
                      return (
                        <div key={i} className="flex justify-between text-sm text-gray-600">
                          <span>{item.description} × {item.quantity}{item.tva_rate ? ` (TVA ${item.tva_rate}%)` : ""}</span>
                          <span className="text-gray-900 font-medium">{formatCurrency(isPro ? lineHT : lineTTC)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.notes && (
                  <p className="mt-2 text-xs text-gray-400 italic">{q.notes}</p>
                )}

                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500 font-medium mr-1">Changer statut :</span>
                  {(["en_attente", "accepte", "refuse"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatut(q.id, s)}
                      disabled={statut === s || updating === q.id}
                      className={cn(
                        "text-xs px-3 py-1 rounded-full border font-medium transition-all",
                        statut === s
                          ? `${STATUS_COLORS[s]} opacity-60 cursor-default`
                          : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700"
                      )}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="ml-auto text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
