import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { supabase, type Contact } from "@/lib/supabase";
import { formatDate, cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  Professionnel: "bg-blue-100 text-blue-700 border-blue-200",
  Particulier: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

export default function ContactsList() {
  const [, navigate] = useLocation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (search.trim()) {
      q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
    }
    const { data } = await q;
    setContacts(data ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Supprimer ce contact ?")) return;
    setDeleting(id);
    await supabase.from("clients").delete().eq("id", id);
    setContacts((c) => c.filter((x) => x.id !== id));
    setDeleting(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-blue-700">Contacts</h1>
        <Link href="/contacts/add">
          <button className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-5 py-2.5 rounded-xl transition-colors text-sm">
            + Ajouter un contact
          </button>
        </Link>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email, entreprise..."
          className="w-full border border-gray-300 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">👥</div>
          <p className="text-gray-500 mb-4">
            {search ? "Aucun contact ne correspond a votre recherche." : "Aucun contact pour l'instant."}
          </p>
          {!search && (
            <Link href="/contacts/add">
              <button className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-6 py-3 rounded-xl text-lg">
                + Ajouter un contact
              </button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/contacts/${c.id}`)}
              className="bg-white border border-gray-200 rounded-2xl p-4 flex items-start justify-between gap-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">
                  {c.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{c.full_name}</p>
                    {c.type && (
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", TYPE_COLORS[c.type] ?? "bg-gray-100 text-gray-600 border-gray-200")}>
                        {c.type}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                    {c.email && <span className="text-xs text-gray-500">{c.email}</span>}
                    {c.phone && <span className="text-xs text-gray-500">{c.phone}</span>}
                    {c.company && <span className="text-xs text-blue-600 font-medium">{c.company}</span>}
                  </div>
                  {c.address && <p className="text-xs text-gray-400 mt-0.5">{c.address}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400 hidden sm:block">{formatDate(c.created_at)}</span>
                <button
                  onClick={(e) => handleDelete(e, c.id)}
                  disabled={deleting === c.id}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                >
                  {deleting === c.id ? "..." : "Supprimer"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
