import { supabase } from '../src/lib/supabase';

async function auditVisits() {
  const ids = [
    '08470064-ba81-4fe9-a0a3-b6110194349c',
    '39eb13e9-fa61-44e6-8ee9-236fd1923746',
    'c9bca13e-3c91-4843-a0f7-15be5bb5eae4',
    'c9a0446c-3518-4ca0-9404-9fd6e3564912',
    'c97bf5a5-8744-4606-8f55-7fffd352bb03',
    'd083969b-1393-4b4c-87fc-2f8d9a21691b',
    '1b62fc56-520b-4b46-837c-2ea5403ec5b1',
    '3365f343-df0c-444b-9446-19b34f000cb1',
    'd08af5b5-bb07-4c5b-b0e1-fc7509565c65',
    '7baa412e-5d5d-43d4-8f19-4057805ee84e',
    '832aa83d-8e28-4808-9dcc-958b464de18a',
    '743139ad-2599-4616-967d-3a791213c729',
    '1fa17a60-8036-4deb-8395-e4b409690783',
    '4775afc2-93fa-4503-a4fa-7e7184ea4810',
    'c31ff8af-6073-4ed4-b4e8-e2552d57e50b',
    '0cc9d4cc-f469-455f-9153-b490ad80a5cf'
  ];

  const { data, error } = await supabase
    .from('customer_visits')
    .select('*, customer:customer_id(*), visit_services(*), visit_products(*)')
    .in('id', ids);

  if (error) {
    console.error('Error:', error);
    return;
  }

  for (const v of data) {
    console.log('----------------------------------------------------');
    console.log(`Visit ID: ${v.id}`);
    console.log(`Customer: ${v.customer?.name} | Phone: ${v.customer?.phone}`);
    console.log(`Date: ${v.visit_date}`);
    console.log(`service_total: ${v.service_total} | product_total: ${v.product_total} | original_total: ${v.original_total}`);
    console.log(`discount_amount: ${v.discount_amount} | grand_total: ${v.grand_total}`);
    console.log(`payment_method: ${v.payment_method} | notes: ${v.notes}`);
    console.log('Services:', JSON.stringify(v.visit_services));
    console.log('Products:', JSON.stringify(v.visit_products));
  }
}

auditVisits();
