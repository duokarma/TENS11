import { supabase } from '../src/lib/supabase';

async function listTables() {
  const tables = ['expenses', 'salon_expenses', 'purchases', 'inventory', 'products'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(3);
    console.log(`Table ${t}:`, error ? error.message : `Found ${data?.length} rows`);
  }
}

listTables();
