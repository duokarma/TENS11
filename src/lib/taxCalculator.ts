/**
 * Canonical Tax Calculation Utility
 * 
 * Rules:
 * - TOTAL BILL IS GST-INCLUSIVE.
 * - CGST = TotalBill × 2.5 / 105
 * - SGST = TotalBill × 2.5 / 105
 * - CGST must ALWAYS equal SGST
 * - There must be ONE canonical calculation function.
 */

export const calculateGST = (totalBill: number) => {
  const GST_RATE = 0.05;
  const taxableValue = Math.round((totalBill / (1 + GST_RATE)) * 100) / 100;
  
  // Mathematically identical to: totalBill * 2.5 / 105
  const cgst = Math.round((totalBill * (GST_RATE / 2) / (1 + GST_RATE)) * 100) / 100;
  
  // Strictly enforce CGST = SGST rule
  const sgst = cgst; 
  
  const totalGST = cgst + sgst;

  return {
    taxableValue,
    cgst,
    sgst,
    totalGST
  };
};
