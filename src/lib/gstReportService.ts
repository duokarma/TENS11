import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, subMonths } from 'date-fns';
import { supabase } from './supabase';

// ─── SALON MASTER TAX CONSTANTS ──────────────────────────────────────────────
export const SALON_INFO = {
  name: 'TEN11 SALON & SKIN CARE',
  tradeName: 'TEN11 LUXURY HAIR & BEAUTY',
  addressLine1: 'Luxury Hair & Beauty, tower, F13, Khushil, First floor, 14/6',
  addressLine2: 'Govindnagar, Dahod, Gujarat 389151',
  state: 'Gujarat',
  stateCode: '24',
  gstin: '24AARCIJE1234F1Z1',
  phone: '+91 98785 43210',
  email: 'contact@ten11salon.com',
  bankName: 'Bank of Baroda',
  accountNo: '33300200000841',
  ifscCode: 'BARB0GODIRD',
  upiId: 'ten19327841@barodampay'
};

// ─── SAC / HSN CODES MAP & TAX RATES ─────────────────────────────────────────
// Statutory reference: Notification No. 11/2017-Central Tax (Rate) & HSN Chapter 33
const SAC_MAP: Record<string, { code: string; desc: string }> = {
  haircut: { code: '999721', desc: 'Haircut & Hairdressing Services' },
  styling: { code: '999721', desc: 'Hair Styling & Blow Dry' },
  wash: { code: '999721', desc: 'Hair Wash & Conditioning' },
  color: { code: '999721', desc: 'Hair Coloring & Treatment' },
  spa: { code: '999721', desc: 'Hair Spa & Scalp Therapy' },
  facial: { code: '999722', desc: 'Skin Care & Facial Services' },
  cleanup: { code: '999722', desc: 'Skin Cleanup & Exfoliation' },
  peel: { code: '999722', desc: 'Cosmetic Peel & Skin Treatment' },
  retinol: { code: '999722', desc: 'Advanced Retinol Skin Care' },
  manicure: { code: '999722', desc: 'Manicure & Nail Grooming' },
  pedicure: { code: '999722', desc: 'Pedicure & Foot Care' },
  waxing: { code: '999722', desc: 'Depilatory & Waxing Services' },
  threading: { code: '999722', desc: 'Eyebrow Threading & Shaping' },
  massage: { code: '999729', desc: 'Physical Well-being & Body Massage' },
  makeup: { code: '999722', desc: 'Beauty & Makeup Services' },
  bridal: { code: '999722', desc: 'Bridal Makeover & Styling' },
  default: { code: '999721', desc: 'Salon & Beauty Treatment Services' }
};

export function getSACDetails(serviceName: string): { code: string; desc: string } {
  const lower = (serviceName || '').toLowerCase();
  for (const [key, val] of Object.entries(SAC_MAP)) {
    if (key !== 'default' && lower.includes(key)) {
      return val;
    }
  }
  return SAC_MAP.default;
}

export function getProductHSNDetails(productName: string): { code: string; desc: string } {
  const lower = (productName || '').toLowerCase();
  if (lower.includes('shampoo') || lower.includes('conditioner') || lower.includes('serum') || lower.includes('oil')) {
    return { code: '33051090', desc: 'Hair Care Preparations' };
  }
  return { code: '33049910', desc: 'Beauty & Skin Care Preparations' };
}

// ─── CANONICAL TAX CALCULATION (TAX-INCLUSIVE FORMULA) ───────────────────────
// As per Section 15 of CGST Act / Rule 35:
// Taxable Value = Gross Amount / (1 + Rate / 100)
// Total GST = Gross Amount - Taxable Value
// CGST = Total GST / 2, SGST = Total GST / 2 (for intra-state 24-Gujarat)
// IGST = Total GST (for inter-state)
export function calculateLineTax(
  grossAmount: number,
  ratePercent: number,
  isInterstate: boolean = false
): {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  total: number;
} {
  if (grossAmount <= 0) {
    return { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0, total: 0 };
  }

  const rate = ratePercent || 5;
  const taxable = Math.round((grossAmount / (1 + rate / 100)) * 100) / 100;
  const totalGst = Math.round((grossAmount - taxable) * 100) / 100;

  if (isInterstate) {
    return {
      taxableAmount: taxable,
      cgst: 0,
      sgst: 0,
      igst: totalGst,
      totalGst,
      total: Math.round((taxable + totalGst) * 100) / 100
    };
  }

  const cgst = Math.round((totalGst / 2) * 100) / 100;
  const sgst = Math.round((totalGst - cgst) * 100) / 100; // Exact match to avoid 1-paise split diff

  return {
    taxableAmount: taxable,
    cgst,
    sgst,
    igst: 0,
    totalGst,
    total: Math.round((taxable + cgst + sgst) * 100) / 100
  };
}

// ─── NUMBER TO WORDS ─────────────────────────────────────────────────────────
export function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertChunk(n % 100) : '');
  }

  const intPart = Math.floor(Math.abs(num));
  const decPart = Math.round((Math.abs(num) - intPart) * 100);

  let result = '';
  let remaining = intPart;

  if (remaining >= 10000000) {
    result += convertChunk(Math.floor(remaining / 10000000)) + ' Crore ';
    remaining %= 10000000;
  }
  if (remaining >= 100000) {
    result += convertChunk(Math.floor(remaining / 100000)) + ' Lakh ';
    remaining %= 100000;
  }
  if (remaining >= 1000) {
    result += convertChunk(Math.floor(remaining / 1000)) + ' Thousand ';
    remaining %= 1000;
  }
  if (remaining > 0) {
    result += convertChunk(remaining);
  }

  result = result.trim() + ' Rupees';

  if (decPart > 0) {
    result += ' and ' + convertChunk(decPart) + ' Paise';
  }

  return result + ' Only';
}

// ─── INTERFACES ──────────────────────────────────────────────────────────────
export interface InvoiceLineItem {
  name: string;
  code: string; // SAC or HSN
  codeDesc: string;
  type: 'service' | 'product';
  quantity: number;
  rate: number;
  grossAmount: number;
  discount: number;
  taxableAmount: number;
  gstRate: number; // e.g. 5 or 18
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface ProcessedInvoice {
  visitId: string;
  invoiceNumber: string;
  invoiceDate: string; // ISO
  formattedDate: string;
  customerName: string;
  customerPhone: string;
  customerGstin: string;
  customerAddress: string;
  placeOfSupply: string;
  isB2B: boolean;
  paymentMethod: string;
  items: InvoiceLineItem[];
  totalQty: number;
  grossTotal: number;
  discountAmount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  grandTotal: number;
}

export interface HSNBreakdown {
  code: string;
  desc: string;
  type: 'service' | 'product';
  gstRate: number;
  quantity: number;
  totalValue: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface GSTReportSummary {
  invoiceCount: number;
  totalItemsCount: number;
  taxableSales: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalGst: number;
  totalSalesValue: number;
  b2bCount: number;
  b2cCount: number;
  b2bTaxable: number;
  b2cTaxable: number;
  rateBuckets: Record<number, { taxable: number; cgst: number; sgst: number; igst: number; total: number }>;
  paymentBreakdown: Record<string, number>;
  hsnSummary: HSNBreakdown[];
}

// ─── 1. FETCH DATA (SAFE QUERY — NO UNKNOWN COLUMNS) ──────────────────────────
export async function fetchInvoicesForPeriod(options: {
  month?: string; // 'YYYY-MM'
  startDate?: string; // 'YYYY-MM-DD'
  endDate?: string; // 'YYYY-MM-DD'
}): Promise<any[]> {
  // CRITICAL FIX: Only select columns that genuinely exist on the customers table!
  // 'address' and 'gstin' do NOT exist in the Supabase customers table schema.
  let query = supabase
    .from('customer_visits')
    .select(`
      id,
      visit_date,
      created_at,
      service_total,
      product_total,
      original_total,
      grand_total,
      discount_amount,
      payment_method,
      is_deleted,
      customer:customer_id (id, name, phone, is_deleted),
      visit_services (id, service_name, price),
      visit_products (id, product_name, quantity, price)
    `)
    .eq('is_deleted', false)
    .order('visit_date', { ascending: true });

  if (options.month && options.month !== 'all') {
    const [y, m] = options.month.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    query = query
      .gte('visit_date', start.toISOString())
      .lt('visit_date', end.toISOString());
  } else if (options.startDate && options.endDate) {
    const s = new Date(options.startDate);
    s.setHours(0, 0, 0, 0);
    const e = new Date(options.endDate);
    e.setHours(23, 59, 59, 999);
    query = query
      .gte('visit_date', s.toISOString())
      .lte('visit_date', e.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching invoices from Supabase:', error);
    throw error;
  }

  // Filter out any soft-deleted customer visits
  return (data || []).filter((v: any) => !v.customer || !v.customer.is_deleted);
}

// ─── 2. PROCESS INVOICES WITH LINE-ITEM GST RATE AUDIT ───────────────────────
export function processInvoices(
  rawVisits: any[],
  serviceGstRate: number = 5 // Configurable: 5% (salon standard inclusive) or 18% (SAC 9997)
): ProcessedInvoice[] {
  return rawVisits.map((visit: any) => {
    const rawDate = visit.visit_date || visit.created_at || new Date().toISOString();
    const dateObj = new Date(rawDate);
    const displayDate = format(dateObj, 'dd MMM yyyy');

    // Deterministic GST-compliant invoice numbering
    const shortId = (visit.id || '').replace(/-/g, '').substring(0, 6).toUpperCase() || '000000';
    const invoiceNumber = `T11-${format(dateObj, 'yyyyMMdd')}-${shortId}`;

    const customer = visit.customer || {};
    const customerName = customer.name || 'Walk-in Client';
    const customerPhone = customer.phone || '-';
    // Address & GSTIN fallbacks (handled gracefully since not in db schema)
    const customerGstin = customer.gstin || '';
    const customerAddress = customer.address || 'Dahod, Gujarat';
    const isB2B = Boolean(customerGstin && customerGstin.trim().length >= 15);

    const isInterstate = isB2B && !customerGstin.startsWith('24');
    const placeOfSupply = isInterstate ? `Other State (${customerGstin.substring(0, 2)})` : `${SALON_INFO.state} (${SALON_INFO.stateCode})`;

    const grandTotal = Number(visit.grand_total || 0);
    const discountAmount = Number(visit.discount_amount || 0);

    // Extract raw lines
    const rawServices = visit.visit_services || [];
    const rawProducts = visit.visit_products || [];

    const rawItems: {
      name: string;
      qty: number;
      rate: number;
      type: 'service' | 'product';
      code: string;
      codeDesc: string;
      gstRate: number;
    }[] = [];

    // Hair & Salon Services (SAC 999721 / 999722)
    rawServices.forEach((s: any) => {
      const sac = getSACDetails(s.service_name);
      rawItems.push({
        name: s.service_name || 'Salon Service',
        qty: 1,
        rate: Number(s.price || 0),
        type: 'service',
        code: sac.code,
        codeDesc: sac.desc,
        gstRate: serviceGstRate // 5% approved salon inclusive, or 18%
      });
    });

    // Cosmetic / Retail Products (HSN 33049910 / 33051090) -> Statutory 18% GST
    rawProducts.forEach((p: any) => {
      const hsn = getProductHSNDetails(p.product_name);
      rawItems.push({
        name: p.product_name || 'Hair & Beauty Product',
        qty: Number(p.quantity || 1),
        rate: Number(p.price || 0),
        type: 'product',
        code: hsn.code,
        codeDesc: hsn.desc,
        gstRate: 18 // Products strictly attract 18% under HSN Chapter 33
      });
    });

    // Fallback if visit has no child lines recorded
    if (rawItems.length === 0) {
      const sac = SAC_MAP.default;
      rawItems.push({
        name: 'Salon Service',
        qty: 1,
        rate: grandTotal,
        type: 'service',
        code: sac.code,
        codeDesc: sac.desc,
        gstRate: serviceGstRate
      });
    }

    const grossTotalSum = rawItems.reduce((acc, it) => acc + (it.qty * it.rate), 0);
    const effectiveGross = grossTotalSum > 0 ? grossTotalSum : grandTotal;

    // Line-item tax calculations
    const items: InvoiceLineItem[] = rawItems.map((it) => {
      const lineGross = it.qty * it.rate;
      const proportion = effectiveGross > 0 ? lineGross / effectiveGross : (1 / rawItems.length);
      const lineDiscount = Math.round(discountAmount * proportion * 100) / 100;
      const lineNet = Math.max(0, lineGross - lineDiscount);

      const tax = calculateLineTax(lineNet, it.gstRate, isInterstate);

      return {
        name: it.name,
        code: it.code,
        codeDesc: it.codeDesc,
        type: it.type,
        quantity: it.qty,
        rate: it.rate,
        grossAmount: lineGross,
        discount: lineDiscount,
        taxableAmount: tax.taxableAmount,
        gstRate: it.gstRate,
        cgst: tax.cgst,
        sgst: tax.sgst,
        igst: tax.igst,
        total: lineNet
      };
    });

    // Sum up items
    let invTaxable = Math.round(items.reduce((s, i) => s + i.taxableAmount, 0) * 100) / 100;
    let invCgst = Math.round(items.reduce((s, i) => s + i.cgst, 0) * 100) / 100;
    let invSgst = Math.round(items.reduce((s, i) => s + i.sgst, 0) * 100) / 100;
    let invIgst = Math.round(items.reduce((s, i) => s + i.igst, 0) * 100) / 100;
    let invTotalGst = Math.round((invCgst + invSgst + invIgst) * 100) / 100;

    // Reconcile line totals with grand_total down to the last paisa
    const sumLines = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
    const diff = Math.round((grandTotal - sumLines) * 100) / 100;
    if (Math.abs(diff) > 0 && items.length > 0) {
      // Adjust on largest item
      const largestItem = items.reduce((max, it) => it.total > max.total ? it : max, items[0]);
      largestItem.total = Math.round((largestItem.total + diff) * 100) / 100;
    }

    const totalQty = items.reduce((acc, it) => acc + it.quantity, 0);

    return {
      visitId: visit.id,
      invoiceNumber,
      invoiceDate: rawDate,
      formattedDate: displayDate,
      customerName,
      customerPhone,
      customerGstin,
      customerAddress,
      placeOfSupply,
      isB2B,
      paymentMethod: visit.payment_method || 'Cash',
      items,
      totalQty,
      grossTotal: effectiveGross,
      discountAmount,
      taxableAmount: invTaxable,
      cgst: invCgst,
      sgst: invSgst,
      igst: invIgst,
      totalGst: invTotalGst,
      grandTotal
    };
  }).sort((a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime());
}

// ─── 3. CALCULATE SUMMARY METRICS & RATE BUCKETS ──────────────────────────────
export function calculateReportSummary(invoices: ProcessedInvoice[]): GSTReportSummary {
  let taxableSales = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let totalGst = 0;
  let totalSalesValue = 0;
  let totalItemsCount = 0;
  let b2bCount = 0;
  let b2cCount = 0;
  let b2bTaxable = 0;
  let b2cTaxable = 0;

  const paymentBreakdown: Record<string, number> = {};
  const hsnMap: Record<string, HSNBreakdown> = {};
  const rateBuckets: Record<number, { taxable: number; cgst: number; sgst: number; igst: number; total: number }> = {};

  for (const inv of invoices) {
    taxableSales += inv.taxableAmount;
    cgstTotal += inv.cgst;
    sgstTotal += inv.sgst;
    igstTotal += inv.igst;
    totalGst += inv.totalGst;
    totalSalesValue += inv.grandTotal;
    totalItemsCount += inv.totalQty;

    if (inv.isB2B) {
      b2bCount++;
      b2bTaxable += inv.taxableAmount;
    } else {
      b2cCount++;
      b2cTaxable += inv.taxableAmount;
    }

    const pMethod = inv.paymentMethod || 'Cash';
    paymentBreakdown[pMethod] = (paymentBreakdown[pMethod] || 0) + inv.grandTotal;

    for (const it of inv.items) {
      // HSN summary
      const hKey = `${it.code}-${it.gstRate}`;
      if (!hsnMap[hKey]) {
        hsnMap[hKey] = {
          code: it.code,
          desc: it.codeDesc,
          type: it.type,
          gstRate: it.gstRate,
          quantity: 0,
          totalValue: 0,
          taxableValue: 0,
          cgst: 0,
          sgst: 0,
          igst: 0
        };
      }
      hsnMap[hKey].quantity += it.quantity;
      hsnMap[hKey].totalValue += it.total;
      hsnMap[hKey].taxableValue += it.taxableAmount;
      hsnMap[hKey].cgst += it.cgst;
      hsnMap[hKey].sgst += it.sgst;
      hsnMap[hKey].igst += it.igst;

      // Rate buckets
      if (!rateBuckets[it.gstRate]) {
        rateBuckets[it.gstRate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      }
      rateBuckets[it.gstRate].taxable += it.taxableAmount;
      rateBuckets[it.gstRate].cgst += it.cgst;
      rateBuckets[it.gstRate].sgst += it.sgst;
      rateBuckets[it.gstRate].igst += it.igst;
      rateBuckets[it.gstRate].total += it.total;
    }
  }

  return {
    invoiceCount: invoices.length,
    totalItemsCount,
    taxableSales: Math.round(taxableSales * 100) / 100,
    cgstTotal: Math.round(cgstTotal * 100) / 100,
    sgstTotal: Math.round(sgstTotal * 100) / 100,
    igstTotal: Math.round(igstTotal * 100) / 100,
    totalGst: Math.round(totalGst * 100) / 100,
    totalSalesValue: Math.round(totalSalesValue * 100) / 100,
    b2bCount,
    b2cCount,
    b2bTaxable: Math.round(b2bTaxable * 100) / 100,
    b2cTaxable: Math.round(b2cTaxable * 100) / 100,
    paymentBreakdown,
    rateBuckets,
    hsnSummary: Object.values(hsnMap).map(h => ({
      ...h,
      totalValue: Math.round(h.totalValue * 100) / 100,
      taxableValue: Math.round(h.taxableValue * 100) / 100,
      cgst: Math.round(h.cgst * 100) / 100,
      sgst: Math.round(h.sgst * 100) / 100,
      igst: Math.round(h.igst * 100) / 100
    }))
  };
}

// ─── 4. LOGO HELPER ──────────────────────────────────────────────────────────
async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const response = await fetch('/logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── 5. ALL SALES INVOICES — ONE COMBINED PDF (HIGHEST PRIORITY) ─────────────
export async function generateAllInvoicesCombinedPDF(options: {
  invoices: ProcessedInvoice[];
  summary: GSTReportSummary;
  periodLabel: string;
}): Promise<void> {
  const { invoices, summary, periodLabel } = options;
  if (invoices.length === 0) {
    throw new Error('No invoices available for the selected period.');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 14;
  const rightEdge = pageWidth - 14;
  const printableWidth = rightEdge - leftMargin;

  const logoDataUrl = await loadLogoDataUrl();
  const generationTimestamp = format(new Date(), 'dd MMM yyyy, hh:mm a');

  for (let idx = 0; idx < invoices.length; idx++) {
    const inv = invoices[idx];

    // Page break between invoices
    if (idx > 0) doc.addPage();

    let y = 14;

    // Header Banner
    doc.setFillColor(18, 18, 18);
    doc.rect(leftMargin, y, printableWidth, 18, 'F');

    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', leftMargin + 2, y + 2, 22, 14);
      } catch (_e) { /* fallback */ }
    }

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(212, 175, 55);
    doc.text(SALON_INFO.name, leftMargin + 27, y + 7);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text(`${SALON_INFO.addressLine1}, ${SALON_INFO.addressLine2} | GSTIN: ${SALON_INFO.gstin}`, leftMargin + 27, y + 13);

    doc.setFillColor(212, 175, 55);
    doc.rect(rightEdge - 32, y + 4, 30, 9, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('TAX INVOICE', rightEdge - 17, y + 10, { align: 'center' });

    y += 24;

    // Two-Column Party & Invoice Details Box
    doc.setDrawColor(210, 210, 210);
    doc.setFillColor(250, 250, 250);
    doc.rect(leftMargin, y, printableWidth, 26, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('BILL TO / RECIPIENT:', leftMargin + 4, y + 5);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(inv.customerName, leftMargin + 4, y + 11);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`Phone: ${inv.customerPhone}`, leftMargin + 4, y + 16);
    doc.text(`GSTIN: ${inv.customerGstin || 'URP (Unregistered Person)'} | ${inv.isB2B ? 'B2B Client' : 'B2C Supply'}`, leftMargin + 4, y + 21);

    const col2X = leftMargin + (printableWidth / 2) + 10;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('INVOICE DETAILS:', col2X, y + 5);

    doc.setFontSize(8.5);
    doc.setTextColor(20, 20, 20);
    doc.text('Invoice No:', col2X, y + 11);
    doc.setFont('helvetica', 'bold');
    doc.text(inv.invoiceNumber, rightEdge - 4, y + 11, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text('Invoice Date:', col2X, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.text(inv.formattedDate, rightEdge - 4, y + 16, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text('Place of Supply:', col2X, y + 21);
    doc.setFont('helvetica', 'bold');
    doc.text(inv.placeOfSupply, rightEdge - 4, y + 21, { align: 'right' });

    y += 30;

    // Line items table
    const tableBody: any[] = inv.items.map((it, itemIndex) => [
      (itemIndex + 1).toString(),
      it.name,
      it.code,
      it.quantity.toString(),
      it.rate.toFixed(2),
      it.discount > 0 ? it.discount.toFixed(2) : '-',
      it.taxableAmount.toFixed(2),
      `${it.gstRate}%`,
      it.cgst > 0 ? it.cgst.toFixed(2) : '-',
      it.sgst > 0 ? it.sgst.toFixed(2) : '-',
      it.igst > 0 ? it.igst.toFixed(2) : '-',
      it.total.toFixed(2)
    ]);

    tableBody.push([
      { content: 'Invoice Totals:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [242, 242, 242] } },
      { content: inv.totalQty.toString(), styles: { halign: 'center', fontStyle: 'bold', fillColor: [242, 242, 242] } },
      { content: '-', styles: { halign: 'center', fillColor: [242, 242, 242] } },
      { content: inv.discountAmount > 0 ? inv.discountAmount.toFixed(2) : '-', styles: { halign: 'right', fillColor: [242, 242, 242] } },
      { content: inv.taxableAmount.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [242, 242, 242] } },
      { content: '-', styles: { halign: 'center', fillColor: [242, 242, 242] } },
      { content: inv.cgst.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [242, 242, 242] } },
      { content: inv.sgst.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [242, 242, 242] } },
      { content: inv.igst > 0 ? inv.igst.toFixed(2) : '-', styles: { halign: 'right', fontStyle: 'bold', fillColor: [242, 242, 242] } },
      { content: `₹${inv.grandTotal.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [230, 242, 255], textColor: [0, 51, 153] } }
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Product / Service Description', 'HSN/SAC', 'Qty', 'Rate', 'Disc', 'Taxable', 'GST%', 'CGST', 'SGST', 'IGST', 'Total']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2 },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 30, 30], lineColor: [210, 210, 210], lineWidth: 0.2 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 16 },
        3: { halign: 'center', cellWidth: 10 },
        4: { halign: 'right', cellWidth: 15 },
        5: { halign: 'right', cellWidth: 12 },
        6: { halign: 'right', cellWidth: 17 },
        7: { halign: 'center', cellWidth: 12 },
        8: { halign: 'right', cellWidth: 14 },
        9: { halign: 'right', cellWidth: 14 },
        10: { halign: 'right', cellWidth: 14 },
        11: { halign: 'right', cellWidth: 18 }
      }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 6;

    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(248, 248, 248);
    doc.setDrawColor(210, 210, 210);
    doc.roundedRect(leftMargin, currentY, printableWidth, 24, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Amount in Words: ', leftMargin + 4, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 20);
    doc.text(numberToWords(inv.grandTotal), leftMargin + 32, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Payment Method: ', leftMargin + 4, currentY + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(inv.paymentMethod, leftMargin + 32, currentY + 12);

    doc.text('Tax Rates: Services 5% / 18% | Cosmetics 18% (GST Inclusive under Section 9 CGST Act)', leftMargin + 4, currentY + 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text('NET AMOUNT PAYABLE:', rightEdge - 55, currentY + 9);
    doc.setFontSize(14);
    doc.setTextColor(0, 102, 51);
    doc.text(`₹${inv.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightEdge - 4, currentY + 18, { align: 'right' });
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // CONSOLIDATED SUMMARY PAGE
  // ═════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  let sumY = 16;

  doc.setFillColor(18, 18, 18);
  doc.rect(leftMargin, sumY, printableWidth, 22, 'F');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(212, 175, 55);
  doc.text('CONSOLIDATED MONTHLY SALES & GST SUMMARY', leftMargin + 6, sumY + 9);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 220, 220);
  doc.text(`Reporting Period: ${periodLabel} | Total Invoices Included: ${summary.invoiceCount} | Generated: ${generationTimestamp}`, leftMargin + 6, sumY + 16);

  sumY += 28;

  // 4 KPI Cards
  const cardW = (printableWidth - 9) / 4;
  const cards = [
    { title: 'TOTAL INVOICES', value: summary.invoiceCount.toString(), sub: `${summary.totalItemsCount} items sold` },
    { title: 'TAXABLE SALES', value: `₹${summary.taxableSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, sub: 'Outward taxable supply' },
    { title: 'TOTAL GST (CGST+SGST)', value: `₹${summary.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, sub: `CGST: ₹${summary.cgstTotal.toFixed(2)} | SGST: ₹${summary.sgstTotal.toFixed(2)}` },
    { title: 'TOTAL INVOICE VALUE', value: `₹${summary.totalSalesValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, sub: 'Authoritative gross revenue' }
  ];

  cards.forEach((c, i) => {
    const cardX = leftMargin + i * (cardW + 3);
    doc.setFillColor(248, 248, 248);
    doc.setDrawColor(210, 210, 210);
    doc.roundedRect(cardX, sumY, cardW, 20, 1.5, 1.5, 'FD');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(110, 110, 110);
    doc.text(c.title, cardX + 3, sumY + 5);

    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text(c.value, cardX + 3, sumY + 12);

    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(c.sub, cardX + 3, sumY + 17);
  });

  sumY += 26;

  // Table 1: HSN/SAC Outward Supplies
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('1. HSN / SAC Outward Supplies Summary (GSTR-1 Table 12 Reconciled)', leftMargin, sumY);
  sumY += 3;

  const hsnRows: any[] = summary.hsnSummary.map((h, i) => [
    (i + 1).toString(),
    h.code,
    h.desc,
    h.type.toUpperCase(),
    h.quantity.toString(),
    `₹${h.taxableValue.toFixed(2)}`,
    `${h.gstRate}%`,
    `₹${h.cgst.toFixed(2)}`,
    `₹${h.sgst.toFixed(2)}`,
    `₹${h.igst.toFixed(2)}`,
    `₹${h.totalValue.toFixed(2)}`
  ]);

  hsnRows.push([
    { content: 'Total HSN Aggregates:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
    { content: summary.totalItemsCount.toString(), styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } },
    { content: `₹${summary.taxableSales.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
    { content: '-', styles: { halign: 'center', fillColor: [240, 240, 240] } },
    { content: `₹${summary.cgstTotal.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
    { content: `₹${summary.sgstTotal.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
    { content: `₹${summary.igstTotal.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
    { content: `₹${summary.totalSalesValue.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [230, 242, 255] } }
  ]);

  autoTable(doc, {
    startY: sumY,
    head: [['#', 'HSN/SAC', 'Description', 'Type', 'Qty', 'Taxable Value', 'Rate', 'CGST', 'SGST', 'IGST', 'Total Value']],
    body: hsnRows,
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 16 },
      2: { cellWidth: 'auto' },
      3: { halign: 'center', cellWidth: 15 },
      4: { halign: 'center', cellWidth: 10 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'center', cellWidth: 12 },
      7: { halign: 'right', cellWidth: 18 },
      8: { halign: 'right', cellWidth: 18 },
      9: { halign: 'right', cellWidth: 14 },
      10: { halign: 'right', cellWidth: 22 }
    }
  });

  sumY = (doc as any).lastAutoTable.finalY + 8;

  // Table 2: Channel & Payment Breakdown
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Payment Method & Channel Summary', leftMargin, sumY);
  sumY += 3;

  const paymentRows = Object.entries(summary.paymentBreakdown).map(([mode, amt]) => [
    mode,
    `₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    summary.totalSalesValue > 0 ? `${((amt / summary.totalSalesValue) * 100).toFixed(1)}%` : '0%'
  ]);

  autoTable(doc, {
    startY: sumY,
    head: [['Payment Method', 'Collected Amount', 'Share %']],
    body: paymentRows,
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { halign: 'right', cellWidth: 40 },
      2: { halign: 'center', cellWidth: 30 }
    }
  });

  sumY = (doc as any).lastAutoTable.finalY + 8;

  // CA Declaration
  doc.setDrawColor(200, 200, 200);
  doc.rect(leftMargin, sumY, printableWidth, 22);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('AUDIT & TAX DECLARATION:', leftMargin + 4, sumY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(
    'Certified that this report is extracted from the authoritative billing database records. All supplies are inclusive of applicable GST (CGST/SGST/IGST) under Section 9 of the CGST Act 2017.',
    leftMargin + 4,
    sumY + 10,
    { maxWidth: printableWidth - 60 }
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('For TEN11 SALON & SKIN CARE', rightEdge - 50, sumY + 11);
  doc.setFont('helvetica', 'normal');
  doc.text('Authorized Signatory / CA', rightEdge - 50, sumY + 18);

  // Running header and footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140, 140, 140);
    doc.text(`${SALON_INFO.name} | Complete Sales Invoices PDF | Period: ${periodLabel}`, leftMargin, 8);
    doc.text(`Generated: ${generationTimestamp}`, rightEdge, 8, { align: 'right' });
    doc.setDrawColor(220, 220, 220);
    doc.line(leftMargin, 9.5, rightEdge, 9.5);

    doc.line(leftMargin, pageHeight - 10, rightEdge, pageHeight - 10);
    doc.text(`GSTIN: ${SALON_INFO.gstin} | State: 24-Gujarat | Statutory CA Report`, leftMargin, pageHeight - 6);
    doc.text(`Page ${p} of ${totalPages}`, rightEdge, pageHeight - 6, { align: 'right' });
  }

  const safeFilename = `TEN11_All_Invoices_${periodLabel.replace(/[\s,]+/g, '_')}.pdf`;
  doc.save(safeFilename);
}

// ─── 6. INDIVIDUAL INVOICE PDF ───────────────────────────────────────────────
export async function generateSingleInvoicePDF(invoice: ProcessedInvoice): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 14;
  const rightEdge = pageWidth - 14;
  const printableWidth = rightEdge - leftMargin;

  const logoDataUrl = await loadLogoDataUrl();

  let y = 14;

  // Header Banner
  doc.setFillColor(18, 18, 18);
  doc.rect(leftMargin, y, printableWidth, 20, 'F');

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', leftMargin + 3, y + 2.5, 24, 15);
    } catch (_e) { /* fallback */ }
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(212, 175, 55);
  doc.text(SALON_INFO.name, leftMargin + 30, y + 8);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 220, 220);
  doc.text(`${SALON_INFO.addressLine1}, ${SALON_INFO.addressLine2}`, leftMargin + 30, y + 13);
  doc.text(`GSTIN: ${SALON_INFO.gstin} | Phone: ${SALON_INFO.phone}`, leftMargin + 30, y + 17.5);

  doc.setFillColor(212, 175, 55);
  doc.rect(rightEdge - 34, y + 4.5, 32, 11, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TAX INVOICE', rightEdge - 18, y + 11.5, { align: 'center' });

  y += 26;

  // Bill To Box
  doc.setDrawColor(210, 210, 210);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(leftMargin, y, printableWidth, 28, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(110, 110, 110);
  doc.text('CLIENT DETAILS (BILL TO):', leftMargin + 4, y + 6);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(invoice.customerName, leftMargin + 4, y + 13);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`Phone: ${invoice.customerPhone}`, leftMargin + 4, y + 19);
  doc.text(`GSTIN: ${invoice.customerGstin || 'URP (Unregistered Person)'} | ${invoice.isB2B ? 'B2B Client' : 'B2C Supply'}`, leftMargin + 4, y + 24);

  const col2X = leftMargin + (printableWidth / 2) + 10;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(110, 110, 110);
  doc.text('INVOICE IDENTIFICATION:', col2X, y + 6);

  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text('Invoice Number:', col2X, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.invoiceNumber, rightEdge - 4, y + 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Invoice Date:', col2X, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.formattedDate, rightEdge - 4, y + 19, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Place of Supply:', col2X, y + 24);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.placeOfSupply, rightEdge - 4, y + 24, { align: 'right' });

  y += 34;

  const tableBody: any[] = invoice.items.map((it, idx) => [
    (idx + 1).toString(),
    it.name,
    it.code,
    it.quantity.toString(),
    it.rate.toFixed(2),
    it.discount > 0 ? it.discount.toFixed(2) : '-',
    it.taxableAmount.toFixed(2),
    `${it.gstRate}%`,
    it.cgst > 0 ? it.cgst.toFixed(2) : '-',
    it.sgst > 0 ? it.sgst.toFixed(2) : '-',
    it.total.toFixed(2)
  ]);

  tableBody.push([
    { content: 'Invoice Totals:', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
    { content: invoice.totalQty.toString(), styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } },
    { content: '-', styles: { halign: 'center', fillColor: [240, 240, 240] } },
    { content: invoice.discountAmount > 0 ? invoice.discountAmount.toFixed(2) : '-', styles: { halign: 'right', fillColor: [240, 240, 240] } },
    { content: invoice.taxableAmount.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
    { content: '-', styles: { halign: 'center', fillColor: [240, 240, 240] } },
    { content: invoice.cgst.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
    { content: invoice.sgst.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
    { content: `₹${invoice.grandTotal.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [230, 242, 255], textColor: [0, 51, 153] } }
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'HSN/SAC', 'Qty', 'Rate', 'Disc', 'Taxable', 'GST%', 'CGST', 'SGST', 'Total']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center' },
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [210, 210, 210] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 14 },
      6: { halign: 'right', cellWidth: 20 },
      7: { halign: 'center', cellWidth: 14 },
      8: { halign: 'right', cellWidth: 18 },
      9: { halign: 'right', cellWidth: 18 },
      10: { halign: 'right', cellWidth: 22 }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;

  doc.setFillColor(248, 248, 248);
  doc.roundedRect(leftMargin, finalY, printableWidth, 32, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Amount in Words:', leftMargin + 4, finalY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(numberToWords(invoice.grandTotal), leftMargin + 34, finalY + 7);

  doc.setFont('helvetica', 'bold');
  doc.text('Payment Method:', leftMargin + 4, finalY + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.paymentMethod, leftMargin + 34, finalY + 14);

  doc.setFont('helvetica', 'bold');
  doc.text('Bank Account:', leftMargin + 4, finalY + 21);
  doc.setFont('helvetica', 'normal');
  doc.text(`${SALON_INFO.bankName} | A/C: ${SALON_INFO.accountNo} | IFSC: ${SALON_INFO.ifscCode}`, leftMargin + 34, finalY + 21);

  doc.text('Tax Rates: Services 5% / 18% | Cosmetics 18% (GST Inclusive under Section 9 CGST Act)', leftMargin + 4, finalY + 27);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('TOTAL AMOUNT PAYABLE:', rightEdge - 55, finalY + 12);
  doc.setFontSize(16);
  doc.setTextColor(0, 102, 51);
  doc.text(`₹${invoice.grandTotal.toFixed(2)}`, rightEdge - 4, finalY + 24, { align: 'right' });

  doc.line(leftMargin, pageHeight - 12, rightEdge, pageHeight - 12);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text('Thank you for choosing TEN11 Salon & Skin Care! Computer-generated tax invoice.', pageWidth / 2, pageHeight - 7, { align: 'center' });

  doc.save(`TEN11_Invoice_${invoice.invoiceNumber}.pdf`);
}

// ─── 7. EXPORT INVOICE REGISTER (EXCEL) ───────────────────────────────────────
export async function exportInvoiceRegisterExcel(options: {
  invoices: ProcessedInvoice[];
  summary: GSTReportSummary;
  periodLabel: string;
}): Promise<void> {
  const { invoices, summary, periodLabel } = options;
  const { utils, writeFile } = await import('xlsx');

  const registerRows = invoices.map(inv => ({
    'Invoice Number': inv.invoiceNumber,
    'Invoice Date': format(new Date(inv.invoiceDate), 'dd-MM-yyyy'),
    'Customer Name': inv.customerName,
    'Phone': inv.customerPhone,
    'Customer GSTIN': inv.customerGstin || 'URP',
    'Customer Type': inv.isB2B ? 'B2B' : 'B2C',
    'Place of Supply': inv.placeOfSupply,
    'Item Summary': inv.items.map(i => `${i.name} (x${i.quantity})`).join(', '),
    'Total Items': inv.totalQty,
    'Gross Amount (₹)': inv.grossTotal,
    'Discount (₹)': inv.discountAmount,
    'Taxable Value (₹)': inv.taxableAmount,
    'CGST (₹)': inv.cgst,
    'SGST (₹)': inv.sgst,
    'IGST (₹)': inv.igst,
    'Total GST (₹)': inv.totalGst,
    'Grand Total (₹)': inv.grandTotal,
    'Payment Method': inv.paymentMethod
  }));

  registerRows.push({
    'Invoice Number': 'TOTAL SUMMARY',
    'Invoice Date': '',
    'Customer Name': `${summary.invoiceCount} Invoices`,
    'Phone': '',
    'Customer GSTIN': '',
    'Customer Type': '',
    'Place of Supply': '',
    'Item Summary': '',
    'Total Items': summary.totalItemsCount,
    'Gross Amount (₹)': Math.round((summary.totalSalesValue + invoices.reduce((s, i) => s + i.discountAmount, 0)) * 100) / 100,
    'Discount (₹)': Math.round(invoices.reduce((s, i) => s + i.discountAmount, 0) * 100) / 100,
    'Taxable Value (₹)': summary.taxableSales,
    'CGST (₹)': summary.cgstTotal,
    'SGST (₹)': summary.sgstTotal,
    'IGST (₹)': summary.igstTotal,
    'Total GST (₹)': summary.totalGst,
    'Grand Total (₹)': summary.totalSalesValue,
    'Payment Method': ''
  });

  const itemRows: any[] = [];
  invoices.forEach(inv => {
    inv.items.forEach(it => {
      itemRows.push({
        'Invoice Number': inv.invoiceNumber,
        'Invoice Date': format(new Date(inv.invoiceDate), 'dd-MM-yyyy'),
        'Customer Name': inv.customerName,
        'Item Description': it.name,
        'Category': it.type.toUpperCase(),
        'HSN / SAC Code': it.code,
        'Quantity': it.quantity,
        'Rate (₹)': it.rate,
        'Gross (₹)': it.grossAmount,
        'Discount (₹)': it.discount,
        'Taxable Amount (₹)': it.taxableAmount,
        'GST Rate': `${it.gstRate}%`,
        'CGST (₹)': it.cgst,
        'SGST (₹)': it.sgst,
        'IGST (₹)': it.igst,
        'Line Total (₹)': it.total
      });
    });
  });

  const hsnRows = summary.hsnSummary.map(h => ({
    'HSN / SAC': h.code,
    'Description': h.desc,
    'Type': h.type.toUpperCase(),
    'Total Quantity': h.quantity,
    'GST Rate': `${h.gstRate}%`,
    'Taxable Value (₹)': h.taxableValue,
    'CGST (₹)': h.cgst,
    'SGST (₹)': h.sgst,
    'IGST (₹)': h.igst,
    'Total Value (₹)': h.totalValue
  }));

  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.json_to_sheet(registerRows), 'Invoice Register');
  utils.book_append_sheet(wb, utils.json_to_sheet(itemRows), 'Itemized Register');
  utils.book_append_sheet(wb, utils.json_to_sheet(hsnRows), 'HSN SAC Summary');

  writeFile(wb, `TEN11_Sales_Register_${periodLabel.replace(/[\s,]+/g, '_')}.xlsx`);
}

// ─── 8. GENERATE GSTR-1 SUMMARY PDF ──────────────────────────────────────────
export async function generateGSTR1PDF(options: {
  invoices: ProcessedInvoice[];
  summary: GSTReportSummary;
  periodLabel: string;
}): Promise<void> {
  const { invoices, summary, periodLabel } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  const printableWidth = pageWidth - 28;

  let y = 14;

  // Header Banner
  doc.setFillColor(20, 20, 20);
  doc.rect(leftMargin, y, printableWidth, 22, 'F');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(212, 175, 55);
  doc.text('FORM GSTR-1: DETAILS OF OUTWARD SUPPLIES', leftMargin + 6, y + 9);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 220, 220);
  doc.text(`Legal Name: ${SALON_INFO.name} | GSTIN: ${SALON_INFO.gstin} | Period: ${periodLabel}`, leftMargin + 6, y + 16);

  y += 28;

  // Table 4: B2B Invoices
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(`4. Taxable Outward Supplies to Registered Persons (B2B) — Total: ${summary.b2bCount}`, leftMargin, y);
  y += 4;

  const b2bInvoices = invoices.filter(i => i.isB2B);
  const b2bRows = b2bInvoices.length > 0 ? b2bInvoices.map((inv, idx) => [
    (idx + 1).toString(),
    inv.customerGstin,
    inv.customerName,
    inv.invoiceNumber,
    format(new Date(inv.invoiceDate), 'dd-MM-yyyy'),
    `₹${inv.grandTotal.toFixed(2)}`,
    inv.placeOfSupply,
    '5%',
    `₹${inv.taxableAmount.toFixed(2)}`,
    `₹${inv.cgst.toFixed(2)}`,
    `₹${inv.sgst.toFixed(2)}`
  ]) : [['-', 'No B2B Supplies during this period (All supplies were B2C Unregistered)', '-', '-', '-', '-', '-', '-', '-', '-', '-']];

  autoTable(doc, {
    startY: y,
    head: [['#', 'GSTIN', 'Party Name', 'Invoice #', 'Date', 'Inv Value', 'POS', 'Rate', 'Taxable', 'CGST', 'SGST']],
    body: b2bRows,
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2 }
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Table 7: B2C (Small) Supplies (Rate-wise grouping: 5% & 18%)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`7. Taxable Supplies to Unregistered Persons (B2C Small) — Total Invoices: ${summary.b2cCount}`, leftMargin, y);
  y += 4;

  const b2cRows: any[] = Object.entries(summary.rateBuckets).map(([rate, vals]) => [
    'Intra-State (Gujarat - 24)',
    'OE (Other than E-Commerce)',
    `${rate}.0%`,
    `₹${vals.taxable.toFixed(2)}`,
    `₹${vals.igst.toFixed(2)}`,
    `₹${vals.cgst.toFixed(2)}`,
    `₹${vals.sgst.toFixed(2)}`,
    '₹0.00'
  ]);

  if (b2cRows.length === 0) {
    b2cRows.push(['Intra-State (Gujarat - 24)', 'OE', '5.0%', '₹0.00', '₹0.00', '₹0.00', '₹0.00', '₹0.00']);
  }

  autoTable(doc, {
    startY: y,
    head: [['Supply Type & POS', 'Type', 'Rate', 'Taxable Value', 'Integrated Tax', 'Central Tax', 'State/UT Tax', 'Cess']],
    body: b2cRows,
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    styles: { fontSize: 7.5, cellPadding: 2.5, halign: 'center' },
    columnStyles: {
      0: { halign: 'left', cellWidth: 45 },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Table 12: HSN Summary
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('12. HSN / SAC-wise Summary of Outward Supplies', leftMargin, y);
  y += 4;

  const hsnTableData = summary.hsnSummary.map((h, idx) => [
    (idx + 1).toString(),
    h.code,
    h.desc,
    'OTH',
    h.quantity.toString(),
    `₹${h.totalValue.toFixed(2)}`,
    `₹${h.taxableValue.toFixed(2)}`,
    `${h.gstRate}%`,
    `₹${h.cgst.toFixed(2)}`,
    `₹${h.sgst.toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'HSN/SAC', 'Description', 'UQC', 'Total Qty', 'Total Value', 'Taxable Value', 'Rate', 'CGST', 'SGST']],
    body: hsnTableData.length > 0 ? hsnTableData : [['-', 'No Records', '-', '-', '0', '₹0.00', '₹0.00', '-', '₹0.00', '₹0.00']],
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2 }
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Table 13: Documents Issued
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('13. Documents Issued During the Tax Period', leftMargin, y);
  y += 4;

  const firstInv = invoices[0]?.invoiceNumber || '-';
  const lastInv = invoices[invoices.length - 1]?.invoiceNumber || '-';

  const docRows = [
    [
      '1',
      'Invoices for Outward Supply (Tax Invoice)',
      firstInv,
      lastInv,
      summary.invoiceCount.toString(),
      '0',
      summary.invoiceCount.toString()
    ]
  ];

  autoTable(doc, {
    startY: y,
    head: [['#', 'Nature of Document', 'From Serial #', 'To Serial #', 'Total Number', 'Cancelled', 'Net Issued']],
    body: docRows,
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    styles: { fontSize: 7.5, cellPadding: 2.5, halign: 'center' }
  });

  doc.save(`GSTR1_Summary_${periodLabel.replace(/[\s,]+/g, '_')}.pdf`);
}

// ─── 9. EXPORT GSTR-1 EXCEL (GOVT OFFLINE TOOL TEMPLATE) ─────────────────────
export async function exportGSTR1Excel(options: {
  invoices: ProcessedInvoice[];
  summary: GSTReportSummary;
  periodLabel: string;
}): Promise<void> {
  const { invoices, summary, periodLabel } = options;
  const { utils, writeFile } = await import('xlsx');

  const b2bData = invoices.filter(i => i.isB2B).map(inv => ({
    'GSTIN/UIN of Recipient': inv.customerGstin,
    'Receiver Name': inv.customerName,
    'Invoice Number': inv.invoiceNumber,
    'Invoice date': format(new Date(inv.invoiceDate), 'dd-MMM-yyyy'),
    'Invoice Value': inv.grandTotal,
    'Place Of Supply': inv.placeOfSupply,
    'Reverse Charge': 'N',
    'Applicable % of Tax Rate': '',
    'Invoice Type': 'Regular',
    'E-Commerce GSTIN': '',
    'Rate': 5,
    'Taxable Value': inv.taxableAmount,
    'Cess Amount': 0
  }));

  const b2csData = Object.entries(summary.rateBuckets).map(([rate, vals]) => ({
    'Type': 'OE',
    'Place Of Supply': `${SALON_INFO.stateCode}-${SALON_INFO.state}`,
    'Applicable % of Tax Rate': '',
    'Rate': Number(rate),
    'Taxable Value': vals.taxable,
    'Cess Amount': 0,
    'E-Commerce GSTIN': ''
  }));

  if (b2csData.length === 0) {
    b2csData.push({
      'Type': 'OE',
      'Place Of Supply': `${SALON_INFO.stateCode}-${SALON_INFO.state}`,
      'Applicable % of Tax Rate': '',
      'Rate': 5,
      'Taxable Value': 0,
      'Cess Amount': 0,
      'E-Commerce GSTIN': ''
    });
  }

  const hsnData = summary.hsnSummary.map(h => ({
    'HSN': h.code,
    'Description': h.desc,
    'UQC': 'OTH',
    'Total Quantity': h.quantity,
    'Total Value': h.totalValue,
    'Taxable Value': h.taxableValue,
    'Integrated Tax Amount': h.igst,
    'Central Tax Amount': h.cgst,
    'State/UT Tax Amount': h.sgst,
    'Cess Amount': 0
  }));

  const docsData = [
    {
      'Nature of Document': 'Invoices for outward supply',
      'Sr. No. From': invoices[0]?.invoiceNumber || 'N/A',
      'Sr. No. To': invoices[invoices.length - 1]?.invoiceNumber || 'N/A',
      'Total Number': summary.invoiceCount,
      'Cancelled': 0
    }
  ];

  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.json_to_sheet(b2bData.length > 0 ? b2bData : [{ 'Message': 'No B2B Invoices' }]), 'b2b');
  utils.book_append_sheet(wb, utils.json_to_sheet(b2csData), 'b2cs');
  utils.book_append_sheet(wb, utils.json_to_sheet(hsnData), 'hsn');
  utils.book_append_sheet(wb, utils.json_to_sheet(docsData), 'docs');

  writeFile(wb, `GSTR1_Offline_${periodLabel.replace(/[\s,]+/g, '_')}.xlsx`);
}

// ─── 10. GENERATE GSTR-3B PDF (STATUTORY COMPLIANT TABLE MAPPING) ────────────
export async function generateGSTR3BPDF(options: {
  summary: GSTReportSummary;
  expenses: any[];
  periodLabel: string;
}): Promise<void> {
  const { summary, expenses, periodLabel } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  const printableWidth = pageWidth - 28;

  let y = 14;

  // Header Banner
  doc.setFillColor(20, 20, 20);
  doc.rect(leftMargin, y, printableWidth, 22, 'F');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(212, 175, 55);
  doc.text('FORM GSTR-3B: STATUTORY MONTHLY RETURN', leftMargin + 6, y + 9);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 220, 220);
  doc.text(`Legal Name: ${SALON_INFO.name} | GSTIN: ${SALON_INFO.gstin} | Period: ${periodLabel}`, leftMargin + 6, y + 16);

  y += 28;

  // ── Table 3.1: Tax on Outward and Reverse-Charge Inward Supplies ──
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('3.1 Details of Outward Supplies and inward supplies liable to reverse charge', leftMargin, y);
  y += 4;

  const table31Rows = [
    [
      '(a) Outward taxable supplies (other than zero rated, nil rated and exempted)',
      `₹${summary.taxableSales.toFixed(2)}`,
      `₹${summary.igstTotal.toFixed(2)}`,
      `₹${summary.cgstTotal.toFixed(2)}`,
      `₹${summary.sgstTotal.toFixed(2)}`,
      '₹0.00'
    ],
    ['(b) Outward taxable supplies (zero rated)', '₹0.00', '₹0.00', '-', '-', '₹0.00'],
    ['(c) Other outward supplies (Nil rated, exempted)', '₹0.00', '-', '-', '-', '-'],
    ['(d) Inward supplies (liable to reverse charge)', '₹0.00', '₹0.00', '₹0.00', '₹0.00', '₹0.00'],
    ['(e) Non-GST outward supplies', '₹0.00', '-', '-', '-', '-']
  ];

  autoTable(doc, {
    startY: y,
    head: [['Nature of Supplies', 'Total Taxable Value', 'Integrated Tax', 'Central Tax', 'State/UT Tax', 'Cess']],
    body: table31Rows,
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Table 4: Eligible ITC (Verified Purchase Records Only) ──
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Eligible Input Tax Credit (ITC)', leftMargin, y);
  y += 4;

  const itcRows = [
    ['(A) ITC Available (whether in full or part)', '', '', '', ''],
    ['   (1) Import of goods', '₹0.00', '₹0.00', '₹0.00', '₹0.00'],
    ['   (2) Import of services', '₹0.00', '₹0.00', '₹0.00', '₹0.00'],
    ['   (3) Inward supplies liable to reverse charge', '₹0.00', '₹0.00', '₹0.00', '₹0.00'],
    ['   (4) Inward supplies from ISD', '₹0.00', '₹0.00', '₹0.00', '₹0.00'],
    ['   (5) All other ITC (Source purchase records verification)', '₹0.00', '₹0.00', '₹0.00', '₹0.00'],
    ['(B) ITC Reversed (as per rules 42 & 43 & Section 17(5))', '₹0.00', '₹0.00', '₹0.00', '₹0.00'],
    ['(C) Net ITC Available (A) - (B)', '₹0.00', '₹0.00', '₹0.00', '₹0.00']
  ];

  autoTable(doc, {
    startY: y,
    head: [['Details', 'Integrated Tax', 'Central Tax', 'State/UT Tax', 'Cess']],
    body: itcRows,
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 1.8 }
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Table 5: Values of Exempt, Nil-Rated and Non-GST Inward Supplies ──
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('5. Values of exempt, nil-rated and non-GST inward supplies', leftMargin, y);
  y += 4;

  const table5Rows = [
    ['From a supplier under composition scheme, exempt and nil rated supply', '₹0.00', '₹0.00'],
    ['Non GST supply', '₹0.00', '₹0.00']
  ];

  autoTable(doc, {
    startY: y,
    head: [['Nature of Supplies', 'Inter-State Supplies', 'Intra-State Supplies']],
    body: table5Rows,
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
    columnStyles: { 0: { halign: 'left', cellWidth: 100 } }
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Table 5.1: Interest & Late Fee Payable ──
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('5.1 Interest & Late Fee Payable', leftMargin, y);
  y += 4;

  const table51Rows = [
    ['Integrated Tax', '₹0.00', '₹0.00'],
    ['Central Tax', '₹0.00', '₹0.00'],
    ['State/UT Tax', '₹0.00', '₹0.00'],
    ['Cess', '₹0.00', '₹0.00']
  ];

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Interest Payable', 'Late Fee Payable']],
    body: table51Rows,
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2, halign: 'center' }
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Table 6.1: Payment of Tax ──
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('6.1 Payment of Tax (Actual Cash & ITC Settlement)', leftMargin, y);
  y += 4;

  const table61Rows = [
    ['Integrated Tax', `₹${summary.igstTotal.toFixed(2)}`, '₹0.00', `₹${summary.igstTotal.toFixed(2)}`, '₹0.00', '₹0.00'],
    ['Central Tax', `₹${summary.cgstTotal.toFixed(2)}`, '₹0.00', `₹${summary.cgstTotal.toFixed(2)}`, '₹0.00', '₹0.00'],
    ['State/UT Tax', `₹${summary.sgstTotal.toFixed(2)}`, '₹0.00', `₹${summary.sgstTotal.toFixed(2)}`, '₹0.00', '₹0.00'],
    ['Total Net Liability', `₹${summary.totalGst.toFixed(2)}`, '₹0.00', `₹${summary.totalGst.toFixed(2)}`, '₹0.00', '₹0.00']
  ];

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Tax Payable (3.1)', 'Paid through ITC (4)', 'Tax Paid in Cash', 'Interest Paid', 'Late Fee Paid']],
    body: table61Rows,
    theme: 'grid',
    headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
    columnStyles: {
      0: { halign: 'left', cellWidth: 42 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    }
  });

  doc.save(`GSTR3B_Summary_${periodLabel.replace(/[\s,]+/g, '_')}.pdf`);
}

// ─── 11. EXPORT GSTR-3B EXCEL (STATUTORY COMPLIANT SHEETS) ───────────────────
export async function exportGSTR3BExcel(options: {
  summary: GSTReportSummary;
  expenses: any[];
  periodLabel: string;
}): Promise<void> {
  const { summary, periodLabel } = options;
  const { utils, writeFile } = await import('xlsx');

  // Sheet 1: Table 3.1
  const sheet31Data = [
    {
      'Table 3.1 Nature of Supplies': '(a) Outward taxable supplies (other than zero rated, nil rated and exempted)',
      'Total Taxable Value (₹)': summary.taxableSales,
      'Integrated Tax (₹)': summary.igstTotal,
      'Central Tax (₹)': summary.cgstTotal,
      'State/UT Tax (₹)': summary.sgstTotal,
      'Cess (₹)': 0
    },
    {
      'Table 3.1 Nature of Supplies': '(b) Outward taxable supplies (zero rated)',
      'Total Taxable Value (₹)': 0,
      'Integrated Tax (₹)': 0,
      'Central Tax (₹)': 0,
      'State/UT Tax (₹)': 0,
      'Cess (₹)': 0
    },
    {
      'Table 3.1 Nature of Supplies': '(c) Other outward supplies (Nil rated, exempted)',
      'Total Taxable Value (₹)': 0,
      'Integrated Tax (₹)': 0,
      'Central Tax (₹)': 0,
      'State/UT Tax (₹)': 0,
      'Cess (₹)': 0
    },
    {
      'Table 3.1 Nature of Supplies': '(d) Inward supplies (liable to reverse charge)',
      'Total Taxable Value (₹)': 0,
      'Integrated Tax (₹)': 0,
      'Central Tax (₹)': 0,
      'State/UT Tax (₹)': 0,
      'Cess (₹)': 0
    },
    {
      'Table 3.1 Nature of Supplies': '(e) Non-GST outward supplies',
      'Total Taxable Value (₹)': 0,
      'Integrated Tax (₹)': 0,
      'Central Tax (₹)': 0,
      'State/UT Tax (₹)': 0,
      'Cess (₹)': 0
    }
  ];

  // Sheet 2: Table 4 Eligible ITC
  const sheet4Data = [
    {
      'Table 4 Eligible ITC Details': '(A) (5) All other ITC (Source purchase records)',
      'Integrated Tax (₹)': 0,
      'Central Tax (₹)': 0,
      'State/UT Tax (₹)': 0,
      'Cess (₹)': 0
    },
    {
      'Table 4 Eligible ITC Details': '(B) ITC Reversed',
      'Integrated Tax (₹)': 0,
      'Central Tax (₹)': 0,
      'State/UT Tax (₹)': 0,
      'Cess (₹)': 0
    },
    {
      'Table 4 Eligible ITC Details': '(C) Net ITC Available',
      'Integrated Tax (₹)': 0,
      'Central Tax (₹)': 0,
      'State/UT Tax (₹)': 0,
      'Cess (₹)': 0
    }
  ];

  // Sheet 3: Table 5 Exempt Inward
  const sheet5Data = [
    {
      'Table 5 Inward Supplies': 'From a supplier under composition scheme, exempt and nil rated',
      'Inter-State Supplies (₹)': 0,
      'Intra-State Supplies (₹)': 0
    },
    {
      'Table 5 Inward Supplies': 'Non GST supply',
      'Inter-State Supplies (₹)': 0,
      'Intra-State Supplies (₹)': 0
    }
  ];

  // Sheet 4: Table 5.1 Interest & Late Fee
  const sheet51Data = [
    { 'Table 5.1 Description': 'Integrated Tax', 'Interest Payable (₹)': 0, 'Late Fee Payable (₹)': 0 },
    { 'Table 5.1 Description': 'Central Tax', 'Interest Payable (₹)': 0, 'Late Fee Payable (₹)': 0 },
    { 'Table 5.1 Description': 'State/UT Tax', 'Interest Payable (₹)': 0, 'Late Fee Payable (₹)': 0 },
    { 'Table 5.1 Description': 'Cess', 'Interest Payable (₹)': 0, 'Late Fee Payable (₹)': 0 }
  ];

  // Sheet 5: Table 6.1 Payment of Tax
  const sheet61Data = [
    {
      'Table 6.1 Description': 'Integrated Tax (IGST)',
      'Total Tax Payable (₹)': summary.igstTotal,
      'Paid through ITC (₹)': 0,
      'Tax Paid in Cash (₹)': summary.igstTotal,
      'Interest Paid in Cash (₹)': 0,
      'Late Fee Paid in Cash (₹)': 0
    },
    {
      'Table 6.1 Description': 'Central Tax (CGST)',
      'Total Tax Payable (₹)': summary.cgstTotal,
      'Paid through ITC (₹)': 0,
      'Tax Paid in Cash (₹)': summary.cgstTotal,
      'Interest Paid in Cash (₹)': 0,
      'Late Fee Paid in Cash (₹)': 0
    },
    {
      'Table 6.1 Description': 'State/UT Tax (SGST)',
      'Total Tax Payable (₹)': summary.sgstTotal,
      'Paid through ITC (₹)': 0,
      'Tax Paid in Cash (₹)': summary.sgstTotal,
      'Interest Paid in Cash (₹)': 0,
      'Late Fee Paid in Cash (₹)': 0
    },
    {
      'Table 6.1 Description': 'Total Net Tax Settlement',
      'Total Tax Payable (₹)': summary.totalGst,
      'Paid through ITC (₹)': 0,
      'Tax Paid in Cash (₹)': summary.totalGst,
      'Interest Paid in Cash (₹)': 0,
      'Late Fee Paid in Cash (₹)': 0
    }
  ];

  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.json_to_sheet(sheet31Data), 'Table 3.1 Outward');
  utils.book_append_sheet(wb, utils.json_to_sheet(sheet4Data), 'Table 4 ITC');
  utils.book_append_sheet(wb, utils.json_to_sheet(sheet5Data), 'Table 5 Inward Exempt');
  utils.book_append_sheet(wb, utils.json_to_sheet(sheet51Data), 'Table 5.1 Interest');
  utils.book_append_sheet(wb, utils.json_to_sheet(sheet61Data), 'Table 6.1 Payment of Tax');

  writeFile(wb, `GSTR3B_Tables_${periodLabel.replace(/[\s,]+/g, '_')}.xlsx`);
}
