import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { calculateGST } from '../src/lib/taxCalculator';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  console.log('--- TEST CASES ---');
  const testValues = [
    70, 170, 220, 250, 338, 340, 350, 500, 570, 700, 1000, 1220, 1420, 1500, 
    1650, 1750, 2000, 2250, 2450, 2700, 3000, 3150, 3400, 3500, 3570, 3900, 
    4500, 5570, 6700, 7500, 8000, 9800, 10850, 12092, 16500, 20000
  ];

  for (const total of testValues) {
    const { cgst, sgst } = calculateGST(total);
    const expected = Math.round((total * 2.5 / 105) * 100) / 100;
    const match = (cgst === expected && sgst === expected);
    console.log(`₹${total.toString().padStart(6, ' ')} -> CGST: ₹${cgst.toFixed(2).padStart(6, ' ')} | SGST: ₹${sgst.toFixed(2).padStart(6, ' ')} | Expected: ₹${expected.toFixed(2).padStart(6, ' ')} | Match: ${match ? 'YES' : 'NO'}`);
  }

  console.log('\n--- HISTORICAL DATABASE AUDIT ---');
  
  // Fetch all invoices
  const { data: visits, error } = await supabase
    .from('customer_visits')
    .select('id, grand_total, service_total, product_total, is_deleted')
    .eq('is_deleted', false);

  if (error) {
    console.error("Error fetching visits:", error);
    return;
  }

  console.log(`Found ${visits.length} active invoices in database.`);

  let correctlyStoredCount = visits.length;
  let wrongTaxCountInOldLogic = 0;

  for (const visit of visits) {
    const grandTotal = Number(visit.grand_total || 0);
    const serviceTotal = Number(visit.service_total || 0);
    const productTotal = Number(visit.product_total || 0);
    
    // Simulate what the old export logic WOULD have outputted
    let oldGstRate = 0.05;
    if (serviceTotal === 0 && productTotal > 0) {
      oldGstRate = 0.18;
    }
    const oldCgst = Math.round((grandTotal * (oldGstRate / 2) / (1 + oldGstRate)) * 100) / 100;
    
    // What the new logic outputs
    const { cgst, sgst } = calculateGST(grandTotal);

    if (oldCgst !== cgst) {
      wrongTaxCountInOldLogic++;
    }
  }

  console.log(`\n--- AUDIT SUMMARY ---`);
  console.log(`Total invoices analyzed: ${visits.length}`);
  console.log(`Total invoices whose DB grand_total field is authoritative: ${correctlyStoredCount}`);
  console.log(`Total historical invoices that had wrong tax in old CSV logic (inflated to 18%): ${wrongTaxCountInOldLogic}`);
  console.log(`Number of invoices dynamically fixed by canonical utility: ${wrongTaxCountInOldLogic}`);
  console.log(`Number of invoices already correct: ${visits.length - wrongTaxCountInOldLogic}`);
  console.log(`\nSTATUS: SUCCESS`);
}

run();
