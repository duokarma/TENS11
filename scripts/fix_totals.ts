import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Fix __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env in the project root
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching all customer visits to audit...");
  const { data: visits, error: vErr } = await supabase
    .from('customer_visits')
    .select('*, visit_services(*), visit_products(*)')
    .eq('is_deleted', false);

  if (vErr) {
    console.error("Error fetching visits:", vErr);
    return;
  }

  console.log(`Found ${visits.length} visits to audit.`);
  let fixedCount = 0;

  for (const visit of visits) {
    let trueServiceTotal = 0;
    
    // Sum exact prices stored in visit_services (these reflect any customPrice entered at transaction time)
    if (visit.visit_services) {
      for (const vs of visit.visit_services) {
        trueServiceTotal += Number(vs.price || 0);
      }
    }

    let trueProductTotal = 0;
    // Sum exact amounts for products
    if (visit.visit_products) {
      for (const vp of visit.visit_products) {
        trueProductTotal += Number(vp.quantity || 1) * Number(vp.price || 0);
      }
    }

    const trueOriginalTotal = trueServiceTotal + trueProductTotal;
    const oldOriginalTotal = Number(visit.original_total || 0);
    const oldServiceTotal = Number(visit.service_total || 0);
    const oldProductTotal = Number(visit.product_total || 0);
    const oldGrandTotal = Number(visit.grand_total || 0);
    const oldDiscountAmount = Number(visit.discount_amount || 0);

    // Reconstruct what grand_total SHOULD be, based on the assumption that if the UI saved a specific grand_total 
    // it might be because the user typed in visitFinalAmount (which is grand_total), 
    // OR it might have defaulted to originalTotal incorrectly.
    // If discount_amount > 0 in the database, it means they EXPLICITLY set visitFinalAmount = originalTotal - discount.
    // BUT since originalTotal was WRONG, discount_amount might be wrong!
    // We must rebuild it.
    // The safest assumption:
    // The PDF generated 340 because it calculated grossTotal = trueOriginalTotal (340) and subtracted oldDiscountAmount (0) = 340.
    // The DB saved grand_total = 338 because oldOriginalTotal was 338.
    // So the true intended grand_total is trueOriginalTotal - oldDiscountAmount.
    
    // But wait! What if oldDiscountAmount was calculated against the wrong oldOriginalTotal?
    // If they typed 340 in visitFinalAmount, and oldOriginalTotal was 338. discount = max(0, 338 - 340) = 0.
    // So if they typed 340, they WANTED 340. 
    // If they wanted 340, and trueOriginalTotal is 340, discount = 0, grand_total = 340.
    // What if they wanted 300, typed 300, and oldOriginalTotal was 338. discount = 338 - 300 = 38.
    // So oldDiscountAmount = 38. 
    // If trueOriginalTotal is 340, and they wanted 300, new discount = 340 - 300 = 40. grand_total should be 300.
    // So grand_total (what the user typed or intended) is the anchor?
    // NO. If they DID NOT type visitFinalAmount, the UI defaulted finalAmt = oldOriginalTotal (338).
    // And saved grand_total = 338. 
    // But they EXPECTED 340 (since they changed customPrice to 340!).
    // So the authoritative intent is actually trueOriginalTotal - trueDiscount, BUT we don't know the true intended discount if they didn't type it!
    // The only reliable indicator is: The PDF calculates grand_total = trueOriginalTotal - oldDiscountAmount.
    // The user saw the PDF and said "The actual invoice shows TOTAL = 340."
    // So the PDF logic is what the user expects!
    // PDF logic: grandTotal = grossTotal (trueOriginalTotal) - data.discount (oldDiscountAmount).
    
    let expectedGrandTotal = trueOriginalTotal - oldDiscountAmount;

    // Check for mismatch
    if (
      Math.abs(oldServiceTotal - trueServiceTotal) > 0.01 ||
      Math.abs(oldProductTotal - trueProductTotal) > 0.01 ||
      Math.abs(oldOriginalTotal - trueOriginalTotal) > 0.01 ||
      Math.abs(oldGrandTotal - expectedGrandTotal) > 0.01
    ) {
      console.log(`Mismatch found for visit ID: ${visit.id}`);
      console.log(`  Service Total: DB=${oldServiceTotal} | True=${trueServiceTotal}`);
      console.log(`  Product Total: DB=${oldProductTotal} | True=${trueProductTotal}`);
      console.log(`  Original Total: DB=${oldOriginalTotal} | True=${trueOriginalTotal}`);
      console.log(`  Grand Total: DB=${oldGrandTotal} | Expected=${expectedGrandTotal} (Discount: ${oldDiscountAmount})`);

      // Update the visit
      const { error: updateErr } = await supabase
        .from('customer_visits')
        .update({
          service_total: trueServiceTotal,
          product_total: trueProductTotal,
          original_total: trueOriginalTotal,
          grand_total: expectedGrandTotal
        })
        .eq('id', visit.id);

      if (updateErr) {
        console.error(`  -> FAILED to update visit ${visit.id}:`, updateErr);
      } else {
        console.log(`  -> Successfully updated visit ${visit.id}`);
        fixedCount++;
        
        // Also update customer amount_paid if grand_total changed
        const difference = expectedGrandTotal - oldGrandTotal;
        if (difference !== 0) {
          const { data: cust } = await supabase.from('customers').select('amount_paid').eq('id', visit.customer_id).single();
          if (cust) {
            await supabase.from('customers').update({ amount_paid: Number(cust.amount_paid || 0) + difference }).eq('id', visit.customer_id);
            console.log(`  -> Updated customer amount_paid by +${difference}`);
          }
        }
      }
    }
  }

  console.log(`Audit complete. Fixed ${fixedCount} invoices.`);
}

run();
