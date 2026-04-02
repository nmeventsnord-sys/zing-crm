import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("Checking Supabase connection...");

  // Try to query the contacts table
  const { error: contactsError } = await supabase.from("contacts").select("id").limit(1);

  if (contactsError && contactsError.code === "42P01") {
    console.log("Tables do not exist yet. Please create them in the Supabase dashboard.");
    console.log("\nRun this SQL in your Supabase SQL Editor:\n");
    console.log(`
CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  address TEXT,
  notes TEXT,
  raw_input TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name TEXT,
  title TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente','accepte','refuse')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
    `);
  } else if (contactsError) {
    console.log("Connection issue:", contactsError.message);
    console.log("\nIf tables don't exist, run this SQL in your Supabase SQL Editor:\n");
    console.log(`
CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  address TEXT,
  notes TEXT,
  raw_input TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name TEXT,
  title TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente','accepte','refuse')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
    `);
  } else {
    console.log("Tables already exist and connection is working!");
  }
}

main().catch(console.error).finally(() => process.exit(0));
