import { supabase } from '../src/lib/supabase';

async function checkExpensesTable() {
  const { data, error } = await supabase.from('expenses').select('*');
  console.log('Total expenses:', data?.length);
  if (data) {
    const novExp = data.filter((e: any) => (e.expense_date || e.date || '').startsWith('2026-11'));
    console.log('Nov 2026 expenses:', novExp.length);
    for (const e of novExp) {
      console.log(e);
    }
  }
}

checkExpensesTable();
