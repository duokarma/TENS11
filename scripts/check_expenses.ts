import { supabase } from '../src/lib/supabase';

async function checkExpenses() {
  const { data, error } = await supabase
    .from('salon_expenses')
    .select('*')
    .gte('expense_date', '2026-11-01')
    .lte('expense_date', '2026-11-30');

  console.log('Expenses for Nov 2026:', data?.length);
  if (data && data.length > 0) {
    for (const exp of data) {
      console.log(`- ${exp.expense_date} | ${exp.category || exp.description || 'Expense'} | Amount: ₹${exp.amount} | GST: ${exp.gst_amount || exp.tax_amount || 'N/A'}`);
    }
  } else {
    console.log('No expenses recorded for November 2026 in salon_expenses table.');
  }

  // Also check if any other purchase or inventory table exists
  const { data: allExp } = await supabase
    .from('salon_expenses')
    .select('count');
  console.log('Total expenses in salon_expenses:', allExp);
}

checkExpenses();
