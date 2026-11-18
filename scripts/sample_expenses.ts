import { supabase } from '../src/lib/supabase';

async function sampleExpenses() {
  const { data } = await supabase.from('expenses').select('*').limit(3);
  console.log(JSON.stringify(data, null, 2));
}

sampleExpenses();
