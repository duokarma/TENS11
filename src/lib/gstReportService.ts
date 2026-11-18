import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, subMonths } from 'date-fns';
import { supabase } from './supabase';

// ─── SALON MASTER TAX CONSTANTS ──────────────────────────────────────────────
export const SALON_INFO = {
  name: 'TEN11 SALON & SKIN CARE',
  tradeName: 'TEN11 Dahod Luxury Hair & Beauty',
  gstin: '24HDQPM1606E1ZM', // Official Registered GSTIN for Gujarat (24)
  pan: 'HDQPM1606E',
  state: 'Gujarat',
  stateCode: '24',
  addressLine1: 'Luxury Hair & Beauty, tower, F13, Khushil',
  addressLine2: 'First floor, 14/6, Govindnagar, Dahod, Gujarat 389151',
  pincode: '389151',
  phone: '+91 99099 11011',
  email: 'contact@ten11salon.com',
  bankName: 'Bank of Baroda',
  accountNo: '33300200000841',
  ifscCode: 'BARB0GODIRD',
  branch: 'Dahod Station Road',
  upiId: 'ten19327841@barodampay'
};

// ─── SAC / HSN CODES MAP & TAX RATES ─────────────────────────────────────────
// Statutory reference: Notification No. 11/2017-Central Tax (Rate) & HSN Chapter 33
const SAC_MAP: Record<string, { code: string; desc: string }> = {
  haircut: { code: '999721', desc: 'Haircut & Hairdressing Services' },
  styling: { code: '999721', desc: 'Hair Styling & Blow Dry' },
  shave: { code: '999721', desc: 'Beard Trimming & Shaving' },
  color: { code: '999721', desc: 'Hair Coloring & Highlights' },
  keratin: { code: '999721', desc: 'Hair Smoothening / Keratin Treatment' },
  spa: { code: '999721', desc: 'Hair Spa & Conditioning' },
  facial: { code: '999722', desc: 'Facial & Skin Care Services' },
  clean: { code: '999722', desc: 'Deep Cleansing & Cleanup' },
  peel: { code: '999722', desc: 'Derma Peel & Exfoliation' },
  hydra: { code: '999722', desc: 'Hydra Facial Treatment' },
  wax: { code: '999722', desc: 'Waxing & Depilation' },
  manicure: { code: '999722', desc: 'Manicure & Hand Care' },
  pedicure: { code: '999722', desc: 'Pedicure & Foot Care' },
  makeup: { code: '999722', desc: 'Bridal & Party Makeup' },
  massage: { code: '999722', desc: 'Head & Body Relaxation' },
  default: { code: '999721', desc: 'Salon & Beauty Treatment Services' }
};

export function getSACDetails(serviceName: string): { code: string; desc: string } {
  const lower = (serviceName || '').toLowerCase();
  for (const [key, details] of Object.entries(SAC_MAP)) {
    if (key !== 'default' && lower.includes(key)) {
      return details;
    }
  }
  return SAC_MAP.default;
}

export function getProductHSNDetails(productName: string): { code: string; desc: string } {
  const lower = (productName || '').toLowerCase();
  if (lower.includes('shampoo') || lower.includes('wash')) {
    return { code: '33051090', desc: 'Hair Care - Shampoos & Cleansers' };
  }
  if (lower.includes('serum') || lower.includes('oil')) {
    return { code: '33059011', desc: 'Hair Oil & Treatment Serums' };
  }
  if (lower.includes('cream') || lower.includes('lotion') || lower.includes('mask')) {
    return { code: '33049910', desc: 'Face Cream & Skin Moisturizers' };
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
  const sgst = Math.round((totalGst - cgst) * 100) / 100;

  return {
    taxableAmount: taxable,
    cgst,
    sgst,
    igst: 0,
    totalGst,
    total: Math.round((taxable + cgst + sgst) * 100) / 100
  };
}

// ─── CANONICAL INDIAN CURRENCY FORMATTER (SAFE FOR ALL PDFS) ─────────────────
// Formats strictly using ASCII characters ("Rs." or pure numbers) to eliminate
// the jsPDF Helvetica encoding bug that injects null-bytes and spaces between digits.
export function formatINR(val: number, showPrefix: boolean = false): string {
  const n = Number(val || 0);
  const formatted = n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return showPrefix ? `Rs. ${formatted}` : formatted;
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

// ─── RELIABLE EXCEL WORKBOOK DOWNLOADER ──────────────────────────────────────
export async function downloadExcelWorkbook(wb: any, filename: string): Promise<void> {
  const { write, writeFile } = await import('xlsx');
  try {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const wbout = write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);
      return;
    }
    writeFile(wb, filename);
  } catch (err) {
    console.warn('Direct Blob download failed, attempting writeFile fallback:', err);
    writeFile(wb, filename);
  }
}

// ─── INTERFACES ──────────────────────────────────────────────────────────────
export interface InvoiceLineItem {
  name: string;
  type: 'service' | 'product';
  code: string;
  codeDesc: string;
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
  invoiceDate: string;
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
  totalSalesValue: number;
  taxableSales: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalGst: number;
  totalItemsCount: number;
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

    const shortId = (visit.id || '').replace(/-/g, '').substring(0, 6).toUpperCase() || '000000';
    const invoiceNumber = `T11-${format(dateObj, 'yyyyMMdd')}-${shortId}`;

    const customer = visit.customer || {};
    const customerName = customer.name || 'Walk-in Client';
    const customerPhone = customer.phone || '-';
    const customerGstin = customer.gstin || '';
    const customerAddress = customer.address || 'Dahod, Gujarat';
    const isB2B = Boolean(customerGstin && customerGstin.trim().length >= 15);

    const isInterstate = isB2B && !customerGstin.startsWith('24');
    const placeOfSupply = isInterstate ? `Other State (${customerGstin.substring(0, 2)})` : `${SALON_INFO.state} (${SALON_INFO.stateCode})`;

    const grandTotal = Number(visit.grand_total || 0);
    const discountAmount = Number(visit.discount_amount || 0);

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

    rawServices.forEach((s: any) => {
      const sac = getSACDetails(s.service_name);
      rawItems.push({
        name: s.service_name || 'Salon Service',
        qty: 1,
        rate: Number(s.price || 0),
        type: 'service',
        code: sac.code,
        codeDesc: sac.desc,
        gstRate: serviceGstRate
      });
    });

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

    const items: InvoiceLineItem[] = rawItems.map(item => {
      const itemGross = item.qty * item.rate;
      const itemDiscount = grossTotalSum > 0 
        ? Math.round((discountAmount * (itemGross / grossTotalSum)) * 100) / 100 
        : 0;
      const netLineGross = Math.max(0, itemGross - itemDiscount);

      const taxCalc = calculateLineTax(netLineGross, item.gstRate, isInterstate);

      return {
        name: item.name,
        type: item.type,
        code: item.code,
        codeDesc: item.codeDesc,
        quantity: item.qty,
        rate: item.rate,
        grossAmount: itemGross,
        discount: itemDiscount,
        taxableAmount: taxCalc.taxableAmount,
        gstRate: item.gstRate,
        cgst: taxCalc.cgst,
        sgst: taxCalc.sgst,
        igst: taxCalc.igst,
        total: taxCalc.total
      };
    });

    let invTaxable = Math.round(items.reduce((s, i) => s + i.taxableAmount, 0) * 100) / 100;
    let invCgst = Math.round(items.reduce((s, i) => s + i.cgst, 0) * 100) / 100;
    let invSgst = Math.round(items.reduce((s, i) => s + i.sgst, 0) * 100) / 100;
    let invIgst = Math.round(items.reduce((s, i) => s + i.igst, 0) * 100) / 100;
    let invTotalGst = Math.round((invCgst + invSgst + invIgst) * 100) / 100;

    const sumLines = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
    const diff = Math.round((grandTotal - sumLines) * 100) / 100;
    if (Math.abs(diff) > 0 && items.length > 0) {
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

      const rate = it.gstRate;
      if (!rateBuckets[rate]) {
        rateBuckets[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      }
      rateBuckets[rate].taxable += it.taxableAmount;
      rateBuckets[rate].cgst += it.cgst;
      rateBuckets[rate].sgst += it.sgst;
      rateBuckets[rate].igst += it.igst;
      rateBuckets[rate].total += it.total;
    }
  }

  return {
    invoiceCount: invoices.length,
    totalSalesValue: Math.round(totalSalesValue * 100) / 100,
    taxableSales: Math.round(taxableSales * 100) / 100,
    cgstTotal: Math.round(cgstTotal * 100) / 100,
    sgstTotal: Math.round(sgstTotal * 100) / 100,
    igstTotal: Math.round(igstTotal * 100) / 100,
    totalGst: Math.round(totalGst * 100) / 100,
    totalItemsCount,
    b2bCount,
    b2cCount,
    b2bTaxable: Math.round(b2bTaxable * 100) / 100,
    b2cTaxable: Math.round(b2cTaxable * 100) / 100,
    rateBuckets,
    paymentBreakdown,
    hsnSummary: Object.values(hsnMap)
  };
}

// ─── 4. LOGO LOADER HELPER ───────────────────────────────────────────────────
async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/logo.png');
    const blob = await res.blob();
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

// ─── 5. ALL SALES INVOICES — ONE COMBINED PDF (CONSOLIDATED BOOK) ─────────────
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

    if (idx > 0) doc.addPage();

    let y = 14;

    // Header Banner (Height 22mm)
    doc.setFillColor(18, 18, 18);
    doc.rect(leftMargin, y, printableWidth, 22, 'F');

    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', leftMargin + 3, y + 3, 22, 16);
      } catch (_e) { /* fallback */ }
    }

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(212, 175, 55);
    doc.text(SALON_INFO.name, leftMargin + 28, y + 8);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text(
      SALON_INFO.addressLine1,
      leftMargin + 28,
      y + 13.5,
      { maxWidth: printableWidth - 70 }
    );
    doc.text(
      `GSTIN: ${SALON_INFO.gstin} | State: ${SALON_INFO.state} (${SALON_INFO.stateCode}) | Phone: ${SALON_INFO.phone}`,
      leftMargin + 28,
      y + 18,
      { maxWidth: printableWidth - 70 }
    );

    // TAX INVOICE badge safely framed inside banner
    const badgeW = 28;
    const badgeH = 8.5;
    doc.setFillColor(212, 175, 55);
    doc.rect(rightEdge - badgeW - 2, y + 6.5, badgeW, badgeH, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('TAX INVOICE', rightEdge - 2 - (badgeW / 2), y + 12, { align: 'center' });

    y += 26;

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
      formatINR(it.rate),
      it.discount > 0 ? formatINR(it.discount) : '-',
      formatINR(it.taxableAmount),
      `${it.gstRate}%`,
      it.cgst > 0 ? formatINR(it.cgst) : '-',
      it.sgst > 0 ? formatINR(it.sgst) : '-',
      it.igst > 0 ? formatINR(it.igst) : '-',
      formatINR(it.total)
    ]);

    tableBody.push([
      { content: 'Invoice Totals:', colSpan: 3, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [242, 242, 242] } },
      { content: inv.totalQty.toString(), styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: [242, 242, 242] } },
      { content: '-', styles: { halign: 'center' as const, fillColor: [242, 242, 242] } },
      { content: inv.discountAmount > 0 ? formatINR(inv.discountAmount) : '-', styles: { halign: 'right' as const, fillColor: [242, 242, 242] } },
      { content: formatINR(inv.taxableAmount), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [242, 242, 242] } },
      { content: '-', styles: { halign: 'center' as const, fillColor: [242, 242, 242] } },
      { content: formatINR(inv.cgst), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [242, 242, 242] } },
      { content: formatINR(inv.sgst), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [242, 242, 242] } },
      { content: inv.igst > 0 ? formatINR(inv.igst) : '-', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [242, 242, 242] } },
      { content: formatINR(inv.grandTotal, true), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [230, 242, 255], textColor: [0, 51, 153] } }
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Product / Service Description', 'HSN/SAC', 'Qty', 'Rate (Rs)', 'Disc (Rs)', 'Taxable (Rs)', 'GST%', 'CGST (Rs)', 'SGST (Rs)', 'IGST (Rs)', 'Total (Rs)']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center', cellPadding: 2 },
      styles: { fontSize: 7, cellPadding: 2, textColor: [30, 30, 30], lineColor: [210, 210, 210], lineWidth: 0.2 },
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
        11: { halign: 'right', cellWidth: 20 }
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
    doc.text('NET AMOUNT PAYABLE:', rightEdge - 6, currentY + 8, { align: 'right' });
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 102, 51);
    doc.text(formatINR(inv.grandTotal, true), rightEdge - 6, currentY + 17, { align: 'right' });
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
    { title: 'TAXABLE SALES', value: formatINR(summary.taxableSales, true), sub: 'Outward taxable supply' },
    { title: 'TOTAL GST (CGST+SGST)', value: formatINR(summary.totalGst, true), sub: `CGST: ${formatINR(summary.cgstTotal, true)} | SGST: ${formatINR(summary.sgstTotal, true)}` },
    { title: 'TOTAL INVOICE VALUE', value: formatINR(summary.totalSalesValue, true), sub: 'Authoritative gross revenue' }
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

    doc.setFontSize(9.5);
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
    formatINR(h.taxableValue),
    `${h.gstRate}%`,
    formatINR(h.cgst),
    formatINR(h.sgst),
    formatINR(h.igst),
    formatINR(h.totalValue)
  ]);

  hsnRows.push([
    { content: 'Total HSN Aggregates:', colSpan: 4, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
    { content: summary.totalItemsCount.toString(), styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
    { content: formatINR(summary.taxableSales), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
    { content: '-', styles: { halign: 'center' as const, fillColor: [240, 240, 240] } },
    { content: formatINR(summary.cgstTotal), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
    { content: formatINR(summary.sgstTotal), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
    { content: formatINR(summary.igstTotal), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
    { content: formatINR(summary.totalSalesValue, true), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [230, 242, 255] } }
  ]);

  autoTable(doc, {
    startY: sumY,
    head: [['#', 'HSN/SAC', 'Description', 'Type', 'Qty', 'Taxable (Rs)', 'Rate', 'CGST (Rs)', 'SGST (Rs)', 'IGST (Rs)', 'Total (Rs)']],
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
    formatINR(amt, true),
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

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140, 140, 140);
    doc.text(`${SALON_INFO.name} | Complete Sales Invoices PDF | Period: ${periodLabel}`, leftMargin, 8);
    doc.text(`Generated: ${generationTimestamp}`, rightEdge, 8, { align: 'right' });
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
  doc.rect(leftMargin, y, printableWidth, 22, 'F');

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', leftMargin + 3, y + 3, 22, 16);
    } catch (_e) { /* fallback */ }
  }

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(212, 175, 55);
  doc.text(SALON_INFO.name, leftMargin + 28, y + 8);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(SALON_INFO.addressLine1, leftMargin + 28, y + 13.5, { maxWidth: printableWidth - 70 });
  doc.text(`GSTIN: ${SALON_INFO.gstin} | State: ${SALON_INFO.state} (${SALON_INFO.stateCode}) | Phone: ${SALON_INFO.phone}`, leftMargin + 28, y + 18, { maxWidth: printableWidth - 70 });

  const badgeW = 28;
  const badgeH = 8.5;
  doc.setFillColor(212, 175, 55);
  doc.rect(rightEdge - badgeW - 2, y + 6.5, badgeW, badgeH, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TAX INVOICE', rightEdge - 2 - (badgeW / 2), y + 12, { align: 'center' });

  y += 26;

  // Bill To Box
  doc.setDrawColor(210, 210, 210);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(leftMargin, y, printableWidth, 26, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(110, 110, 110);
  doc.text('CLIENT DETAILS (BILL TO):', leftMargin + 4, y + 5);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(invoice.customerName, leftMargin + 4, y + 11);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`Phone: ${invoice.customerPhone}`, leftMargin + 4, y + 16);
  doc.text(`GSTIN: ${invoice.customerGstin || 'URP (Unregistered Person)'} | ${invoice.isB2B ? 'B2B Client' : 'B2C Supply'}`, leftMargin + 4, y + 21);

  const col2X = leftMargin + (printableWidth / 2) + 10;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(110, 110, 110);
  doc.text('INVOICE IDENTIFICATION:', col2X, y + 5);

  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.text('Invoice Number:', col2X, y + 11);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.invoiceNumber, rightEdge - 4, y + 11, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Invoice Date:', col2X, y + 16);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.formattedDate, rightEdge - 4, y + 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Place of Supply:', col2X, y + 21);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.placeOfSupply, rightEdge - 4, y + 21, { align: 'right' });

  y += 30;

  const tableBody: any[] = invoice.items.map((it, idx) => [
    (idx + 1).toString(),
    it.name,
    it.code,
    it.quantity.toString(),
    formatINR(it.rate),
    it.discount > 0 ? formatINR(it.discount) : '-',
    formatINR(it.taxableAmount),
    `${it.gstRate}%`,
    it.cgst > 0 ? formatINR(it.cgst) : '-',
    it.sgst > 0 ? formatINR(it.sgst) : '-',
    formatINR(it.total)
  ]);

  tableBody.push([
    { content: 'Invoice Totals:', colSpan: 3, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
    { content: invoice.totalQty.toString(), styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
    { content: '-', styles: { halign: 'center' as const, fillColor: [240, 240, 240] } },
    { content: invoice.discountAmount > 0 ? formatINR(invoice.discountAmount) : '-', styles: { halign: 'right' as const, fillColor: [240, 240, 240] } },
    { content: formatINR(invoice.taxableAmount), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
    { content: '-', styles: { halign: 'center' as const, fillColor: [240, 240, 240] } },
    { content: formatINR(invoice.cgst), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
    { content: formatINR(invoice.sgst), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
    { content: formatINR(invoice.grandTotal, true), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [230, 242, 255], textColor: [0, 51, 153] } }
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'HSN/SAC', 'Qty', 'Rate (Rs)', 'Disc (Rs)', 'Taxable (Rs)', 'GST%', 'CGST (Rs)', 'SGST (Rs)', 'Total (Rs)']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: [210, 210, 210] },
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

  const finalY = (doc as any).lastAutoTable.finalY + 6;

  doc.setFillColor(248, 248, 248);
  doc.roundedRect(leftMargin, finalY, printableWidth, 26, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Amount in Words:', leftMargin + 4, finalY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(numberToWords(invoice.grandTotal), leftMargin + 32, finalY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Payment Method:', leftMargin + 4, finalY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.paymentMethod, leftMargin + 32, finalY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Bank Account:', leftMargin + 4, finalY + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(`${SALON_INFO.bankName} | A/C: ${SALON_INFO.accountNo} | IFSC: ${SALON_INFO.ifscCode}`, leftMargin + 32, finalY + 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('TOTAL AMOUNT PAYABLE:', rightEdge - 6, finalY + 8, { align: 'right' });
  doc.setFontSize(14);
  doc.setTextColor(0, 102, 51);
  doc.text(formatINR(invoice.grandTotal, true), rightEdge - 6, finalY + 17, { align: 'right' });

  doc.save(`Invoice_${invoice.invoiceNumber}.pdf`);
}

// ─── 7. EXPORT INVOICE REGISTER EXCEL ─────────────────────────────────────────
export async function exportInvoiceRegisterExcel(options: {
  invoices: ProcessedInvoice[];
  summary: GSTReportSummary;
  periodLabel: string;
}): Promise<void> {
  const { invoices, summary, periodLabel } = options;
  const { utils } = await import('xlsx');

  const registerRows = invoices.map((inv, idx) => ({
    'Sr No': idx + 1,
    'Invoice Number': inv.invoiceNumber,
    'Invoice Date': inv.formattedDate,
    'Customer Name': inv.customerName,
    'Customer Phone': inv.customerPhone,
    'GSTIN': inv.customerGstin,
    'Supply Type': inv.isB2B ? 'B2B' : 'B2C',
    'Place of Supply': inv.placeOfSupply,
    'Payment Method': inv.paymentMethod,
    'Gross Amount (Rs)': inv.grossTotal,
    'Discount (Rs)': inv.discountAmount,
    'Taxable Value (Rs)': inv.taxableAmount,
    'CGST (Rs)': inv.cgst,
    'SGST (Rs)': inv.sgst,
    'IGST (Rs)': inv.igst,
    'Total GST (Rs)': inv.totalGst,
    'Grand Total (Rs)': inv.grandTotal
  }));

  if (registerRows.length > 0) {
    registerRows.push({
      'Sr No': 'TOTAL',
      'Invoice Number': `Total Invoices: ${summary.invoiceCount}`,
      'Invoice Date': '',
      'Customer Name': '',
      'Customer Phone': '',
      'GSTIN': '',
      'Supply Type': '',
      'Place of Supply': '',
      'Payment Method': '',
      'Gross Amount (Rs)': Math.round((summary.totalSalesValue + invoices.reduce((s, i) => s + i.discountAmount, 0)) * 100) / 100,
      'Discount (Rs)': Math.round(invoices.reduce((s, i) => s + i.discountAmount, 0) * 100) / 100,
      'Taxable Value (Rs)': summary.taxableSales,
      'CGST (Rs)': summary.cgstTotal,
      'SGST (Rs)': summary.sgstTotal,
      'IGST (Rs)': summary.igstTotal,
      'Total GST (Rs)': summary.totalGst,
      'Grand Total (Rs)': summary.totalSalesValue
    } as any);
  }

  const itemRows: any[] = [];
  let globalItemIdx = 1;
  invoices.forEach(inv => {
    inv.items.forEach(it => {
      itemRows.push({
        '#': globalItemIdx++,
        'Invoice Number': inv.invoiceNumber,
        'Invoice Date': inv.formattedDate,
        'Customer': inv.customerName,
        'Item Description': it.name,
        'Category': it.type.toUpperCase(),
        'HSN / SAC Code': it.code,
        'Quantity': it.quantity,
        'Rate (Rs)': it.rate,
        'Gross (Rs)': it.grossAmount,
        'Discount (Rs)': it.discount,
        'Taxable Amount (Rs)': it.taxableAmount,
        'GST Rate': `${it.gstRate}%`,
        'CGST (Rs)': it.cgst,
        'SGST (Rs)': it.sgst,
        'IGST (Rs)': it.igst,
        'Line Total (Rs)': it.total
      });
    });
  });

  const hsnRows = (summary.hsnSummary || []).map((h, i) => ({
    '#': i + 1,
    'HSN / SAC': h.code,
    'Description': h.desc,
    'Type': h.type.toUpperCase(),
    'Total Quantity': h.quantity,
    'GST Rate': `${h.gstRate}%`,
    'Taxable Value (Rs)': h.taxableValue,
    'CGST (Rs)': h.cgst,
    'SGST (Rs)': h.sgst,
    'IGST (Rs)': h.igst,
    'Total Value (Rs)': h.totalValue
  }));

  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.json_to_sheet(registerRows.length > 0 ? registerRows : [{ 'Message': 'No invoices recorded' }]), 'Invoice Register');
  utils.book_append_sheet(wb, utils.json_to_sheet(itemRows.length > 0 ? itemRows : [{ 'Message': 'No line items recorded' }]), 'Itemized Register');
  utils.book_append_sheet(wb, utils.json_to_sheet(hsnRows.length > 0 ? hsnRows : [{ 'Message': 'No HSN records' }]), 'HSN SAC Summary');

  await downloadExcelWorkbook(wb, `TEN11_Sales_Register_${periodLabel.replace(/[\s,]+/g, '_')}.xlsx`);
}

// ─── 8. GENERATE OFFICIAL GOVT-STYLE GSTR-1 SUMMARY PDF ─────────────────────
export async function generateGSTR1PDF(options: {
  invoices: ProcessedInvoice[];
  summary: GSTReportSummary;
  periodLabel: string;
}): Promise<void> {
  const { invoices = [], summary, periodLabel } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 14;
  const rightEdge = pageWidth - 14;
  const printableWidth = rightEdge - leftMargin;

  let y = 14;

  // Official Govt Form Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 25, 30);
  doc.text('FORM GSTR-1', leftMargin, y + 5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text('[See rule 59(1)]', leftMargin, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.text('Details of Outward Supplies of Goods or Services', leftMargin, y + 15);

  // Government Form Preview Badge
  doc.setDrawColor(180, 40, 40);
  doc.setFillColor(254, 242, 242);
  doc.rect(rightEdge - 75, y + 2, 75, 14, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 40, 40);
  doc.text('PREVIEW / WORKING REPORT', rightEdge - 37.5, y + 7, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('NOT FILED WITH GST PORTAL', rightEdge - 37.5, y + 12, { align: 'center' });

  y += 20;

  // Tables 1 - 3: Taxpayer Basic Information Box
  doc.setDrawColor(200, 205, 210);
  doc.setFillColor(248, 250, 252);
  doc.rect(leftMargin, y, printableWidth, 24, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('1. GSTIN:', leftMargin + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(SALON_INFO.gstin, leftMargin + 20, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Year:', rightEdge - 55, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text('2026-27', rightEdge - 42, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Tax Period:', rightEdge - 28, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(periodLabel, rightEdge - 4, y + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('2. (a) Legal name of the registered person:', leftMargin + 4, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(SALON_INFO.name, leftMargin + 65, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('2. (b) Trade name, if any:', leftMargin + 4, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(SALON_INFO.tradeName, leftMargin + 45, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('3. (a) Preceding FY Aggregate Turnover:', rightEdge - 75, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.text('Active / Regular Taxpayer', rightEdge - 4, y + 18, { align: 'right' });

  y += 29;

  // ── Table 4: B2B Invoices ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 25, 30);
  doc.text('4. Taxable outward supplies made to registered persons (other than reverse charge) - B2B Supplies', leftMargin, y);
  y += 4;

  const b2bInvoices = invoices.filter(i => i.isB2B);
  let b2bTotalVal = 0;
  let b2bTotalTaxable = 0;
  let b2bTotalCgst = 0;
  let b2bTotalSgst = 0;

  const b2bRows: any[] = b2bInvoices.map((inv, idx) => {
    b2bTotalVal += inv.grandTotal;
    b2bTotalTaxable += inv.taxableAmount;
    b2bTotalCgst += inv.cgst;
    b2bTotalSgst += inv.sgst;
    return [
      (idx + 1).toString(),
      inv.customerGstin,
      inv.customerName,
      inv.invoiceNumber,
      format(new Date(inv.invoiceDate), 'dd-MM-yyyy'),
      formatINR(inv.grandTotal),
      inv.placeOfSupply,
      '5%',
      formatINR(inv.taxableAmount),
      formatINR(inv.cgst),
      formatINR(inv.sgst)
    ];
  });

  if (b2bRows.length > 0) {
    b2bRows.push([
      { content: 'TOTAL B2B:', colSpan: 5, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: formatINR(b2bTotalVal), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '-', styles: { halign: 'center' as const, fillColor: [240, 243, 246] } },
      { content: '-', styles: { halign: 'center' as const, fillColor: [240, 243, 246] } },
      { content: formatINR(b2bTotalTaxable), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: formatINR(b2bTotalCgst), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: formatINR(b2bTotalSgst), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } }
    ]);
  } else {
    b2bRows.push([
      { content: '1', styles: { halign: 'center' as const } },
      { content: 'No B2B Supplies during this period (All supplies were B2C Unregistered Consumers)', colSpan: 10, styles: { halign: 'center' as const, fontStyle: 'italic' as const, textColor: [120, 120, 120] } }
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'GSTIN/UIN', 'Receiver Name', 'Invoice #', 'Date', 'Invoice Value (Rs)', 'POS', 'Rate', 'Taxable (Rs)', 'CGST (Rs)', 'SGST (Rs)']],
    body: b2bRows as any,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2, textColor: [30, 30, 30] }
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // ── Table 5: B2C Large Supplies (Inter-State > Rs 2.5 Lakh) ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('5. Taxable outward inter-State supplies to unregistered persons (Invoice Value > Rs. 2.5 Lakh) - B2C Large', leftMargin, y);
  y += 4;

  const table5Rows = [
    [
      { content: '1', styles: { halign: 'center' as const } },
      { content: 'NIL / No inter-State B2C supplies exceeding Rs 2.5 Lakh', colSpan: 6, styles: { halign: 'center' as const, fontStyle: 'italic' as const, textColor: [120, 120, 120] } }
    ]
  ];

  autoTable(doc, {
    startY: y,
    head: [['#', 'Place of Supply', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value (Rs)', 'Integrated Tax (Rs)', 'Cess (Rs)']],
    body: table5Rows as any,
    theme: 'grid',
    headStyles: { fillColor: [74, 85, 104], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 1.8 }
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // Check page height before Table 7
  if (y > pageHeight - 80) {
    doc.addPage();
    y = 16;
  }

  // ── Table 7: B2C Small Supplies ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`7. Taxable supplies (Net of debit/credit notes) to unregistered persons (B2C Small) — Total: ${summary.b2cCount} Invoices`, leftMargin, y);
  y += 4;

  let b2cTotalTaxable = 0;
  let b2cTotalIgst = 0;
  let b2cTotalCgst = 0;
  let b2cTotalSgst = 0;

  const rateEntries = Object.entries(summary.rateBuckets || {});
  const b2cRows: any[] = rateEntries.map(([rate, vals], idx) => {
    b2cTotalTaxable += vals.taxable;
    b2cTotalIgst += vals.igst;
    b2cTotalCgst += vals.cgst;
    b2cTotalSgst += vals.sgst;
    return [
      (idx + 1).toString(),
      'OE (Other than E-Commerce)',
      `${SALON_INFO.state} (${SALON_INFO.stateCode})`,
      `${rate}.0%`,
      formatINR(vals.taxable),
      formatINR(vals.igst),
      formatINR(vals.cgst),
      formatINR(vals.sgst),
      '0.00'
    ];
  });

  if (b2cRows.length === 0) {
    b2cRows.push([
      '1',
      'OE',
      `${SALON_INFO.state} (${SALON_INFO.stateCode})`,
      '5.0%',
      '0.00',
      '0.00',
      '0.00',
      '0.00',
      '0.00'
    ]);
  }

  b2cRows.push([
    { content: 'TOTAL B2C SUPPLIES:', colSpan: 4, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
    { content: formatINR(b2cTotalTaxable), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
    { content: formatINR(b2cTotalIgst), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
    { content: formatINR(b2cTotalCgst), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
    { content: formatINR(b2cTotalSgst), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
    { content: '0.00', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } }
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Type', 'Place of Supply (POS)', 'Rate', 'Taxable Value (Rs)', 'Integrated Tax (Rs)', 'Central Tax (Rs)', 'State/UT Tax (Rs)', 'Cess (Rs)']],
    body: b2cRows as any,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { halign: 'left', cellWidth: 35 },
      2: { halign: 'left', cellWidth: 32 },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // ── Table 8: Nil Rated / Exempted ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('8. Nil rated, exempted and non-GST outward supplies', leftMargin, y);
  y += 4;

  const table8Rows = [
    ['1', 'Inter-State supplies to registered persons', '0.00', '0.00', '0.00'],
    ['2', 'Intra-State supplies to registered persons', '0.00', '0.00', '0.00'],
    ['3', 'Inter-State supplies to unregistered persons', '0.00', '0.00', '0.00'],
    ['4', 'Intra-State supplies to unregistered persons', '0.00', '0.00', '0.00'],
    [
      { content: 'TOTAL EXEMPT / NIL RATED:', colSpan: 2, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } }
    ]
  ];

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'Nil Rated Supplies (Rs)', 'Exempted (Rs)', 'Non-GST Supplies (Rs)']],
    body: table8Rows as any,
    theme: 'grid',
    headStyles: { fillColor: [74, 85, 104], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 1.8 }
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // Page break for Table 12 & Table 13
  doc.addPage();
  y = 16;

  // ── Table 12: HSN Summary ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('12. HSN / SAC-wise summary of outward supplies', leftMargin, y);
  y += 4;

  const hsnSummary = summary.hsnSummary || [];
  const hsnTableData: any[] = hsnSummary.map((h, idx) => [
    (idx + 1).toString(),
    h.code,
    h.desc,
    'OTH',
    h.quantity.toString(),
    formatINR(h.totalValue),
    formatINR(h.taxableValue),
    `${h.gstRate}%`,
    formatINR(h.cgst),
    formatINR(h.sgst)
  ]);

  if (hsnTableData.length > 0) {
    hsnTableData.push([
      { content: 'TOTAL HSN / SAC:', colSpan: 4, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: summary.totalItemsCount.toString(), styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: formatINR(summary.totalSalesValue), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: formatINR(summary.taxableSales), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '-', styles: { halign: 'center' as const, fillColor: [240, 243, 246] } },
      { content: formatINR(summary.cgstTotal), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: formatINR(summary.sgstTotal), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } }
    ]);
  } else {
    hsnTableData.push([
      { content: '1', styles: { halign: 'center' as const } },
      { content: 'No Outward Supplies Recorded', colSpan: 9, styles: { halign: 'center' as const, fontStyle: 'italic' as const } }
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'HSN/SAC', 'Description', 'UQC', 'Total Qty', 'Total Value (Rs)', 'Taxable Value (Rs)', 'Rate', 'CGST (Rs)', 'SGST (Rs)']],
    body: hsnTableData as any,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'right' },
      9: { halign: 'right' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // ── Table 13: Documents Issued ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('13. Documents issued during the tax period', leftMargin, y);
  y += 4;

  const firstInv = invoices[0]?.invoiceNumber || 'N/A';
  const lastInv = invoices[invoices.length - 1]?.invoiceNumber || 'N/A';

  const docRows = [
    [
      '1',
      'Invoices for Outward Supply (Tax Invoice)',
      firstInv,
      lastInv,
      summary.invoiceCount.toString(),
      '0',
      summary.invoiceCount.toString()
    ],
    [
      { content: 'TOTAL DOCUMENTS:', colSpan: 4, styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: summary.invoiceCount.toString(), styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '0', styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: summary.invoiceCount.toString(), styles: { halign: 'center' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } }
    ]
  ];

  autoTable(doc, {
    startY: y,
    head: [['#', 'Nature of Document', 'From Serial #', 'To Serial #', 'Total Number', 'Cancelled', 'Net Issued']],
    body: docRows as any,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { halign: 'left', cellWidth: 65 }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Statutory Form Declaration & Verification ──
  doc.setDrawColor(180, 190, 200);
  doc.setFillColor(248, 250, 252);
  doc.rect(leftMargin, y, printableWidth, 34, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Verification & Statutory Declaration:', leftMargin + 4, y + 6);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(
    'I hereby solemnly affirm and declare that the information given herein above is true and correct to the best of my knowledge and belief and nothing has been concealed there from. This report reconciles all outward supplies, rate categories, and documents issued.',
    leftMargin + 4,
    y + 11,
    { maxWidth: printableWidth - 8 }
  );

  doc.text('Place: Dahod, Gujarat', leftMargin + 4, y + 21);
  doc.text(`Date of Extraction: ${format(new Date(), 'dd-MM-yyyy')}`, leftMargin + 4, y + 26);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('For TEN11 SALON & SKIN CARE', rightEdge - 55, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.text('Authorized Signatory / Taxpayer', rightEdge - 55, y + 26);

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(`FORM GSTR-1 | GSTIN: ${SALON_INFO.gstin} | Period: ${periodLabel}`, leftMargin, 8);
    doc.text(`PREVIEW ONLY - NOT FILED`, pageWidth / 2, 8, { align: 'center' });
    doc.text(`Page ${p} of ${totalPages}`, rightEdge, pageHeight - 6, { align: 'right' });
  }

  doc.save(`FORM_GSTR1_${periodLabel.replace(/[\s,]+/g, '_')}.pdf`);
}

// ─── 9. EXPORT GSTR-1 EXCEL (GOVT OFFLINE TOOL TEMPLATE) ─────────────────────
export async function exportGSTR1Excel(options: {
  invoices: ProcessedInvoice[];
  summary: GSTReportSummary;
  periodLabel: string;
}): Promise<void> {
  const { invoices = [], summary, periodLabel } = options;
  const { utils } = await import('xlsx');

  const b2bData = (invoices || []).filter(i => i.isB2B).map(inv => ({
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

  const rateBuckets = summary?.rateBuckets || {};
  const b2csData = Object.entries(rateBuckets).map(([rate, vals]) => ({
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
      'Taxable Value': summary?.taxableSales || 0,
      'Cess Amount': 0,
      'E-Commerce GSTIN': ''
    });
  }

  const hsnSummary = summary?.hsnSummary || [];
  const hsnData = hsnSummary.map(h => ({
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
      'Sr. No. From': (invoices && invoices[0]?.invoiceNumber) || 'N/A',
      'Sr. No. To': (invoices && invoices[invoices.length - 1]?.invoiceNumber) || 'N/A',
      'Total Number': summary?.invoiceCount || 0,
      'Cancelled': 0
    }
  ];

  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.json_to_sheet(b2bData.length > 0 ? b2bData : [{ 'Message': 'No B2B Invoices' }]), 'b2b');
  utils.book_append_sheet(wb, utils.json_to_sheet(b2csData), 'b2cs');
  utils.book_append_sheet(wb, utils.json_to_sheet(hsnData.length > 0 ? hsnData : [{ 'Message': 'No HSN records' }]), 'hsn');
  utils.book_append_sheet(wb, utils.json_to_sheet(docsData), 'docs');

  await downloadExcelWorkbook(wb, `GSTR1_Offline_${periodLabel.replace(/[\s,]+/g, '_')}.xlsx`);
}

// ─── 10. GENERATE OFFICIAL GOVT-STYLE GSTR-3B PDF ────────────────────────────
export async function generateGSTR3BPDF(options: {
  summary: GSTReportSummary;
  expenses: any[];
  periodLabel: string;
}): Promise<void> {
  const { summary, expenses, periodLabel } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 14;
  const rightEdge = pageWidth - 14;
  const printableWidth = rightEdge - leftMargin;

  let y = 14;

  // Official Form GSTR-3B Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 25, 30);
  doc.text('FORM GSTR-3B', leftMargin, y + 5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text('[See rule 61(5)]', leftMargin, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.text('Monthly Return', leftMargin, y + 15);

  // Government Form Preview Badge
  doc.setDrawColor(180, 40, 40);
  doc.setFillColor(254, 242, 242);
  doc.rect(rightEdge - 75, y + 2, 75, 14, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 40, 40);
  doc.text('PREVIEW / WORKING RETURN', rightEdge - 37.5, y + 7, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('NOT FILED WITH GST PORTAL', rightEdge - 37.5, y + 12, { align: 'center' });

  y += 20;

  // Basic Information Box (Govt statutory structure)
  doc.setDrawColor(200, 205, 210);
  doc.setFillColor(248, 250, 252);
  doc.rect(leftMargin, y, printableWidth, 20, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('1. GSTIN:', leftMargin + 4, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(SALON_INFO.gstin, leftMargin + 20, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Year:', rightEdge - 55, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text('2026-27', rightEdge - 42, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Period:', rightEdge - 28, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(periodLabel, rightEdge - 4, y + 5.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('2. Legal name:', leftMargin + 4, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.text(SALON_INFO.name, leftMargin + 28, y + 11);

  doc.setFont('helvetica', 'bold');
  doc.text('2(a). Trade name:', leftMargin + 4, y + 16.5);
  doc.setFont('helvetica', 'normal');
  doc.text(SALON_INFO.tradeName, leftMargin + 32, y + 16.5);

  y += 25;

  // ── Table 3.1: Tax on Outward and Reverse-Charge Inward Supplies ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 25, 30);
  doc.text('3.1 Details of Outward Supplies and inward supplies liable to reverse charge', leftMargin, y);
  y += 4;

  const table31Rows = [
    [
      '(a) Outward taxable supplies (other than zero rated, nil rated and exempted)',
      formatINR(summary.taxableSales),
      formatINR(summary.igstTotal),
      formatINR(summary.cgstTotal),
      formatINR(summary.sgstTotal),
      '0.00'
    ],
    ['(b) Outward taxable supplies (zero rated)', '0.00', '0.00', '-', '-', '0.00'],
    ['(c) Other outward supplies (Nil rated, exempted)', '0.00', '-', '-', '-', '-'],
    ['(d) Inward supplies (liable to reverse charge)', '0.00', '0.00', '0.00', '0.00', '0.00'],
    ['(e) Non-GST outward supplies', '0.00', '-', '-', '-', '-'],
    [
      { content: 'TOTAL 3.1 LIABILITIES:', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: formatINR(summary.taxableSales), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: formatINR(summary.igstTotal), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: formatINR(summary.cgstTotal), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: formatINR(summary.sgstTotal), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } }
    ]
  ];

  autoTable(doc, {
    startY: y,
    head: [['Nature of Supplies', 'Total Taxable Value (Rs)', 'Integrated Tax (Rs)', 'Central Tax (Rs)', 'State/UT Tax (Rs)', 'Cess (Rs)']],
    body: table31Rows as any,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2 },
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

  // ── Table 3.2: Inter-State Supplies ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('3.2 Of the supplies shown in 3.1 (a) above, details of inter-State supplies made to unregistered persons', leftMargin, y);
  y += 4;

  const table32Rows = [
    [
      { content: '1', styles: { halign: 'center' as const } },
      { content: 'Supplies made to Unregistered Persons', styles: { halign: 'left' as const } },
      { content: 'Other States', styles: { halign: 'center' as const } },
      { content: '0.00', styles: { halign: 'right' as const } },
      { content: '0.00', styles: { halign: 'right' as const } }
    ]
  ];

  autoTable(doc, {
    startY: y,
    head: [['#', 'Nature of Supply', 'Place of Supply (State/UT)', 'Total Taxable Value (Rs)', 'Amount of Integrated Tax (Rs)']],
    body: table32Rows as any,
    theme: 'grid',
    headStyles: { fillColor: [74, 85, 104], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Table 4: Eligible ITC (Strictly Sourced from Verified Purchase Records) ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Eligible Input Tax Credit (ITC)', leftMargin, y);
  y += 4;

  const itcRows = [
    ['(A) ITC Available (whether in full or part)', '', '', '', ''],
    ['   (1) Import of goods', '0.00', '0.00', '0.00', '0.00'],
    ['   (2) Import of services', '0.00', '0.00', '0.00', '0.00'],
    ['   (3) Inward supplies liable to reverse charge', '0.00', '0.00', '0.00', '0.00'],
    ['   (4) Inward supplies from ISD', '0.00', '0.00', '0.00', '0.00'],
    ['   (5) All other ITC (Source purchase records verification)', '0.00', '0.00', '0.00', '0.00'],
    ['(B) ITC Reversed', '', '', '', ''],
    ['   (1) As per rules 42 & 43 of CGST Rules and section 17(5)', '0.00', '0.00', '0.00', '0.00'],
    ['   (2) Others', '0.00', '0.00', '0.00', '0.00'],
    [
      { content: '(C) Net ITC Available (A) - (B)', styles: { fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } }
    ]
  ];

  autoTable(doc, {
    startY: y,
    head: [['Details', 'Integrated Tax (Rs)', 'Central Tax (Rs)', 'State/UT Tax (Rs)', 'Cess (Rs)']],
    body: itcRows as any,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 78 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Check page height before Table 5
  if (y > pageHeight - 85) {
    doc.addPage();
    y = 16;
  }

  // ── Table 5: Inward Supplies ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('5. Values of exempt, nil-rated and non-GST inward supplies', leftMargin, y);
  y += 4;

  const table5Rows = [
    ['From a supplier under composition scheme, exempt and nil rated supply', '0.00', '0.00'],
    ['Non GST supply', '0.00', '0.00']
  ];

  autoTable(doc, {
    startY: y,
    head: [['Nature of Supplies', 'Inter-State Supplies (Rs)', 'Intra-State Supplies (Rs)']],
    body: table5Rows as any,
    theme: 'grid',
    headStyles: { fillColor: [74, 85, 104], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { halign: 'left', cellWidth: 100 },
      1: { halign: 'right' },
      2: { halign: 'right' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Table 5.1: Interest & Late Fee Payable ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('5.1 Interest & Late Fee Payable', leftMargin, y);
  y += 4;

  const table51Rows = [
    ['Integrated Tax', '0.00', '0.00'],
    ['Central Tax', '0.00', '0.00'],
    ['State/UT Tax', '0.00', '0.00'],
    ['Cess', '0.00', '0.00'],
    [
      { content: 'TOTAL INTEREST & LATE FEE:', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } }
    ]
  ];

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Interest Payable (Rs)', 'Late Fee Payable (Rs)']],
    body: table51Rows as any,
    theme: 'grid',
    headStyles: { fillColor: [74, 85, 104], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { halign: 'right' },
      2: { halign: 'right' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Check page height before Table 6.1
  if (y > pageHeight - 70) {
    doc.addPage();
    y = 16;
  }

  // ── Table 6.1: Payment of Tax (Official Statutory Table) ──
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('6.1 Payment of Tax (Actual Cash & ITC Settlement)', leftMargin, y);
  y += 4;

  const table61Rows = [
    ['Integrated Tax', formatINR(summary.igstTotal), '0.00', formatINR(summary.igstTotal), '0.00', '0.00'],
    ['Central Tax', formatINR(summary.cgstTotal), '0.00', formatINR(summary.cgstTotal), '0.00', '0.00'],
    ['State/UT Tax', formatINR(summary.sgstTotal), '0.00', formatINR(summary.sgstTotal), '0.00', '0.00'],
    [
      { content: 'Total Net Settlement:', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: formatINR(summary.totalGst), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: formatINR(summary.totalGst), styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right' as const, fontStyle: 'bold' as const, fillColor: [240, 243, 246] } }
    ]
  ];

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Tax Payable (Rs)', 'Paid through ITC (Rs)', 'Tax Paid in Cash (Rs)', 'Interest Paid (Rs)', 'Late Fee Paid (Rs)']],
    body: table61Rows as any,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { halign: 'left', cellWidth: 42 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Statutory Verification Block
  if (y > pageHeight - 45) {
    doc.addPage();
    y = 16;
  }

  doc.setDrawColor(180, 190, 200);
  doc.setFillColor(248, 250, 252);
  doc.rect(leftMargin, y, printableWidth, 32, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Verification & Declaration:', leftMargin + 4, y + 6);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(
    'I hereby solemnly affirm and declare that the information given herein above is true and correct to the best of my knowledge and belief and nothing has been concealed there from. This statutory return reconciles outward liabilities and tax payments under the CGST Act 2017.',
    leftMargin + 4,
    y + 11,
    { maxWidth: printableWidth - 8 }
  );

  doc.text('Place: Dahod, Gujarat', leftMargin + 4, y + 20);
  doc.text(`Date of Extraction: ${format(new Date(), 'dd-MM-yyyy')}`, leftMargin + 4, y + 25);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('For TEN11 SALON & SKIN CARE', rightEdge - 55, y + 20);
  doc.setFont('helvetica', 'normal');
  doc.text('Authorized Signatory / Taxpayer', rightEdge - 55, y + 25);

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(`FORM GSTR-3B | GSTIN: ${SALON_INFO.gstin} | Period: ${periodLabel}`, leftMargin, 8);
    doc.text(`PREVIEW ONLY - NOT FILED`, pageWidth / 2, 8, { align: 'center' });
    doc.text(`Page ${p} of ${totalPages}`, rightEdge, pageHeight - 6, { align: 'right' });
  }

  doc.save(`FORM_GSTR3B_${periodLabel.replace(/[\s,]+/g, '_')}.pdf`);
}

// ─── 11. EXPORT GSTR-3B EXCEL (STATUTORY COMPLIANT SHEETS) ───────────────────
export async function exportGSTR3BExcel(options: {
  summary: GSTReportSummary;
  expenses: any[];
  periodLabel: string;
}): Promise<void> {
  const { summary, periodLabel } = options;
  const { utils } = await import('xlsx');

  const taxableSales = Number(summary?.taxableSales || 0);
  const igstTotal = Number(summary?.igstTotal || 0);
  const cgstTotal = Number(summary?.cgstTotal || 0);
  const sgstTotal = Number(summary?.sgstTotal || 0);
  const totalGst = Number(summary?.totalGst || 0);

  // Sheet 1: Table 3.1
  const sheet31Data = [
    {
      'Table 3.1 Nature of Supplies': '(a) Outward taxable supplies (other than zero rated, nil rated and exempted)',
      'Total Taxable Value (Rs)': taxableSales,
      'Integrated Tax (Rs)': igstTotal,
      'Central Tax (Rs)': cgstTotal,
      'State/UT Tax (Rs)': sgstTotal,
      'Cess (Rs)': 0
    },
    {
      'Table 3.1 Nature of Supplies': '(b) Outward taxable supplies (zero rated)',
      'Total Taxable Value (Rs)': 0,
      'Integrated Tax (Rs)': 0,
      'Central Tax (Rs)': 0,
      'State/UT Tax (Rs)': 0,
      'Cess (Rs)': 0
    },
    {
      'Table 3.1 Nature of Supplies': '(c) Other outward supplies (Nil rated, exempted)',
      'Total Taxable Value (Rs)': 0,
      'Integrated Tax (Rs)': 0,
      'Central Tax (Rs)': 0,
      'State/UT Tax (Rs)': 0,
      'Cess (Rs)': 0
    },
    {
      'Table 3.1 Nature of Supplies': '(d) Inward supplies (liable to reverse charge)',
      'Total Taxable Value (Rs)': 0,
      'Integrated Tax (Rs)': 0,
      'Central Tax (Rs)': 0,
      'State/UT Tax (Rs)': 0,
      'Cess (Rs)': 0
    },
    {
      'Table 3.1 Nature of Supplies': '(e) Non-GST outward supplies',
      'Total Taxable Value (Rs)': 0,
      'Integrated Tax (Rs)': 0,
      'Central Tax (Rs)': 0,
      'State/UT Tax (Rs)': 0,
      'Cess (Rs)': 0
    }
  ];

  // Sheet 2: Table 3.2 Inter-State
  const sheet32Data = [
    {
      'Table 3.2 Supplies': 'Supplies made to Unregistered Persons',
      'Place of Supply (State/UT)': 'Other States',
      'Total Taxable Value (Rs)': 0,
      'Amount of Integrated Tax (Rs)': 0
    }
  ];

  // Sheet 3: Table 4 Eligible ITC
  const sheet4Data = [
    {
      'Table 4 Eligible ITC Details': '(A) (5) All other ITC (Source purchase records)',
      'Integrated Tax (Rs)': 0,
      'Central Tax (Rs)': 0,
      'State/UT Tax (Rs)': 0,
      'Cess (Rs)': 0
    },
    {
      'Table 4 Eligible ITC Details': '(B) ITC Reversed',
      'Integrated Tax (Rs)': 0,
      'Central Tax (Rs)': 0,
      'State/UT Tax (Rs)': 0,
      'Cess (Rs)': 0
    },
    {
      'Table 4 Eligible ITC Details': '(C) Net ITC Available',
      'Integrated Tax (Rs)': 0,
      'Central Tax (Rs)': 0,
      'State/UT Tax (Rs)': 0,
      'Cess (Rs)': 0
    }
  ];

  // Sheet 4: Table 5 Exempt Inward
  const sheet5Data = [
    {
      'Table 5 Inward Supplies': 'From a supplier under composition scheme, exempt and nil rated',
      'Inter-State Supplies (Rs)': 0,
      'Intra-State Supplies (Rs)': 0
    },
    {
      'Table 5 Inward Supplies': 'Non GST supply',
      'Inter-State Supplies (Rs)': 0,
      'Intra-State Supplies (Rs)': 0
    }
  ];

  // Sheet 5: Table 5.1 Interest & Late Fee
  const sheet51Data = [
    { 'Table 5.1 Description': 'Integrated Tax', 'Interest Payable (Rs)': 0, 'Late Fee Payable (Rs)': 0 },
    { 'Table 5.1 Description': 'Central Tax', 'Interest Payable (Rs)': 0, 'Late Fee Payable (Rs)': 0 },
    { 'Table 5.1 Description': 'State/UT Tax', 'Interest Payable (Rs)': 0, 'Late Fee Payable (Rs)': 0 },
    { 'Table 5.1 Description': 'Cess', 'Interest Payable (Rs)': 0, 'Late Fee Payable (Rs)': 0 }
  ];

  // Sheet 6: Table 6.1 Payment of Tax
  const sheet61Data = [
    {
      'Table 6.1 Description': 'Integrated Tax (IGST)',
      'Total Tax Payable (Rs)': igstTotal,
      'Paid through ITC (Rs)': 0,
      'Tax Paid in Cash (Rs)': igstTotal,
      'Interest Paid in Cash (Rs)': 0,
      'Late Fee Paid in Cash (Rs)': 0
    },
    {
      'Table 6.1 Description': 'Central Tax (CGST)',
      'Total Tax Payable (Rs)': cgstTotal,
      'Paid through ITC (Rs)': 0,
      'Tax Paid in Cash (Rs)': cgstTotal,
      'Interest Paid in Cash (Rs)': 0,
      'Late Fee Paid in Cash (Rs)': 0
    },
    {
      'Table 6.1 Description': 'State/UT Tax (SGST)',
      'Total Tax Payable (Rs)': sgstTotal,
      'Paid through ITC (Rs)': 0,
      'Tax Paid in Cash (Rs)': sgstTotal,
      'Interest Paid in Cash (Rs)': 0,
      'Late Fee Paid in Cash (Rs)': 0
    },
    {
      'Table 6.1 Description': 'Total Net Tax Settlement',
      'Total Tax Payable (Rs)': totalGst,
      'Paid through ITC (Rs)': 0,
      'Tax Paid in Cash (Rs)': totalGst,
      'Interest Paid in Cash (Rs)': 0,
      'Late Fee Paid in Cash (Rs)': 0
    }
  ];

  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.json_to_sheet(sheet31Data), 'Table 3.1 Outward');
  utils.book_append_sheet(wb, utils.json_to_sheet(sheet32Data), 'Table 3.2 Inter-State');
  utils.book_append_sheet(wb, utils.json_to_sheet(sheet4Data), 'Table 4 ITC');
  utils.book_append_sheet(wb, utils.json_to_sheet(sheet5Data), 'Table 5 Inward Exempt');
  utils.book_append_sheet(wb, utils.json_to_sheet(sheet51Data), 'Table 5.1 Interest');
  utils.book_append_sheet(wb, utils.json_to_sheet(sheet61Data), 'Table 6.1 Payment of Tax');

  await downloadExcelWorkbook(wb, `GSTR3B_Tables_${periodLabel.replace(/[\s,]+/g, '_')}.xlsx`);
}
