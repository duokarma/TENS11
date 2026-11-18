import { supabase } from '../src/lib/supabase';

async function checkKhyati() {
  const { data } = await supabase
    .from('customer_visits')
    .select('*, customer:customer_id(*), visit_services(*), visit_products(*)')
    .eq('id', 'ad4dde7a-e466-4e28-bcaf-aa0a83370d76');
  console.log(JSON.stringify(data, null, 2));
}

checkKhyati();
