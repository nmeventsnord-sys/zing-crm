import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ContactType = "Particulier" | "Professionnel";

export type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
  raw_input: string | null;
  type: ContactType | null;
  created_at: string;
};

export type QuoteItem = {
  description: string;
  quantity: number;
  unit_price: number;
  tva_rate: number;
};

export type Quote = {
  id: string;
  numero: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_type: ContactType | null;
  titre: string;
  forfait: string | null;
  items: QuoteItem[] | null;
  lignes: unknown[] | null;
  total_ht: number | null;
  total_tva: number | null;
  total_ttc: number | null;
  statut: "en_attente" | "accepte" | "refuse";
  notes: string | null;
  created_at: string;
};

export type SuiviItem = {
  id: string;
  contact_id: string;
  type: string;
  note: string | null;
  date_interaction: string | null;
  photo_url: string | null;
  document_url: string | null;
  document_name: string | null;
  document_type: string | null;
  created_at: string;
};

export type ClientPerso = {
  contact_id: string;
  type_evenement: string | null;
  date_evenement: string | null;
  lieu_evenement: string | null;
  nb_personnes: string | null;
  preferences_photos: string | null;
  code_promo: string | null;
  source_contact: string | null;
  commentaires_perso: string | null;
};
