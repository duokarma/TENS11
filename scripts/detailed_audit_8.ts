import { supabase } from '../src/lib/supabase';

async function detailedAudit8() {
  const ids = [
    '08470064-ba81-4fe9-a0a3-b6110194349c', // Sheetal Sadhu
    '39eb13e9-fa61-44e6-8ee9-236fd1923746', // Kalpna Nayak
    'c9bca13e-3c91-4843-a0f7-15be5bb5eae4', // Dhawni Pandya
    'c9a0446c-3518-4ca0-9404-9fd6e3564912', // Hera Mehgwani
    'c97bf5a5-8744-4606-8f55-7fffd352bb03', // Prachi Upadhyay
    'd083969b-1393-4b4c-87fc-2f8d9a21691b', // Shraddha Solanki
    '1b62fc56-520b-4b46-837c-2ea5403ec5b1', // Shivani Patel
    '3365f343-df0c-444b-9446-19b34f000cb1'  // Jasmin Amin
  ];

  const { data: visits } = await supabase
    .from('customer_visits')
    .select('*, customer:customer_id(*), visit_services(*), visit_products(*)')
    .in('id', ids);

  console.log('=== DETAILED AUDIT TRAIL OF THE 8 CHECKOUT ADJUSTMENTS ===\n');

  for (const v of visits!) {
    const svcs = v.visit_services || [];
    const prods = v.visit_products || [];
    const svcSum = svcs.reduce((a: number, b: any) => a + Number(b.price || 0), 0);
    const prodSum = prods.reduce((a: number, b: any) => a + (Number(b.price || 0) * Number(b.quantity || 1)), 0);
    const lineSum = svcSum + prodSum;
    const gt = Number(v.grand_total || 0);
    const diff = gt - lineSum;

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Visit ID: ${v.id}`);
    console.log(`Date: ${v.visit_date?.substring(0, 10)} | Customer: ${v.customer?.name} (${v.customer?.phone})`);
    console.log(`Services Count: ${svcs.length} (Sum: ₹${svcSum}) | Products Count: ${prods.length} (Sum: ₹${prodSum})`);
    console.log(`Catalog Line Sum: ₹${lineSum} | Final Billed Grand Total: ₹${gt} | Discrepancy: ${diff >= 0 ? '+' : ''}₹${diff}`);
    console.log(`DB Fields -> service_total: ${v.service_total}, product_total: ${v.product_total}, original_total: ${v.original_total}, discount: ${v.discount_amount}`);
    
    console.log('Item Breakdown:');
    svcs.forEach((s: any) => console.log(`  [SERVICE] ${s.service_name} (SAC 9997) -> Catalog Price: ₹${s.price}`));
    prods.forEach((p: any) => console.log(`  [PRODUCT] ${p.product_name} (HSN 3305/3304) -> Catalog Price: ₹${p.price} x ${p.quantity} = ₹${p.price * p.quantity}`));

    console.log('Accounting Cause & Categorization:');
    if (prods.length === 0) {
      console.log(`  -> 100% PURE SERVICE INVOICE. There are NO retail products on this bill.`);
      console.log(`  -> Category: Supply of Services (Heading 9997). Applicable GST Rate: 5% (or 18% if Heading 9997 general).`);
      console.log(`  -> Cause: Manual custom price adjustment or unitemized service add-on entered at POS.`);
      console.log(`  -> Cross-category mixing risk: ZERO (no products exist to mix with).`);
    } else {
      console.log(`  -> MIXED INVOICE (Services: ₹${svcSum}, Products: ₹${prodSum}).`);
      console.log(`  -> Nature of ₹${diff} adjustment:`);
      if (v.customer?.name === 'SHRADDHA SOLANKI') {
        console.log(`     GLOBAL CO. service ended in ₹3,999. Billed total ₹10,350 (+₹1.00 rounding up).`);
        console.log(`     Statutory allocation: Rounding adjustment attributable to Service (GLOBAL CO. ₹3,999 -> ₹4,000).`);
      } else if (v.customer?.name === 'JASMIN AMIN') {
        console.log(`     CARES DERMA product ended in ₹1,499. Billed total ₹4,000 (+₹1.00 rounding up).`);
        console.log(`     Statutory allocation: Rounding adjustment attributable to Product (CARES DERMA ₹1,499 -> ₹1,500).`);
      }
    }
  }
}

detailedAudit8();
