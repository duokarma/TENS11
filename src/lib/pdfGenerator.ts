import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';


const GSTIN          = '24AARCIJE1234F1Z1';
const PLACE_OF_SUPPLY = 'Gujarat (24)';
const GST_RATE       = 0.05;
const CGST_RATE      = 0.025;
const SGST_RATE      = 0.025;
const PRODUCT_GST_RATE   = 0.18;
const PRODUCT_CGST_RATE  = 0.09;
const PRODUCT_SGST_RATE  = 0.09;

const SAC_MAP: Record<string, string> = {
  'Haircut & Styling': '999722',
  'Skin Hydration Facial': '999721',
  'KENPEKI CLEANUP': '998721',
  'HEEL PEEL': '998721',
  'RETINOL': '998721',
  'Body massage': '998721',
  default: '998721',
};

function getSACCode(serviceName: string): string {
  for (const [key, value] of Object.entries(SAC_MAP)) {
    if (serviceName.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  return SAC_MAP.default;
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero';

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

// ─── Logo helper: loads the logo image as a data-URL via fetch ────────────────
async function getLogoDataUrl(): Promise<string | null> {
  try {
    const response = await fetch('/logo.png');
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

// ─── Shared header: logo + salon info + GSTIN + invoice no + date ─────────────
function buildPDFHeader(
  doc: jsPDF,
  logoDataUrl: string | null,
  invoiceNo: string,
  dateStr: string,
  customerName: string,
  customerPhone: string
): number {
  const pageWidth  = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  const rightEdge  = pageWidth - 14;

  // ── Logo (top-left, black background box) ─────────────────────────────────
  const logoW = 40;
  const logoH = 25;
  const logoX = leftMargin;
  const logoY = 6;

  doc.setFillColor(0, 0, 0);
  doc.roundedRect(logoX, logoY, logoW, logoH, 2, 2, 'F');

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoW, logoH);
    } catch (_e) { /* fallback below */ }
  }

  // Fallback text if logo fails
  if (!logoDataUrl) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 157, 60);
    doc.text('TEN11', logoX + 8, logoY + 14);
  }

  // ── TAX INVOICE title (centred) ────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TAX INVOICE', pageWidth / 2, 16, { align: 'center' });

  // Decorative line under title
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, 20, rightEdge, 20);

  // ── Salon info (right of logo) ────────────────────────────────────────────
  let y = 28;
  const infoX = logoX + logoW + 5;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TEN11 SALON & SKIN CARE', infoX, y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Luxury Hair & Beauty, tower, F13, Khushil, First floor, 14/6', infoX, y + 5);
  doc.text('Govindnagar, Dahod, Gujarat 389151', infoX, y + 10);
  doc.text('Phone: +91 98785 43210', infoX, y + 15);

  // ── GSTIN / Invoice No / Date (top-right) ─────────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`GSTIN: ${GSTIN}`, rightEdge, y, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('Invoice No:', rightEdge - 45, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(invoiceNo, rightEdge, y + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Date:', rightEdge - 45, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(dateStr, rightEdge, y + 12, { align: 'right' });

  // ── Bill To ───────────────────────────────────────────────────────────────
  y = 54;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, y - 3, rightEdge, y - 3);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Bill To:', leftMargin, y);

  doc.setFontSize(10);
  y += 6;
  doc.text('Client Name: ', leftMargin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(customerName || 'Walk-in Customer', leftMargin + 28, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Contact: ', leftMargin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(customerPhone || '-', leftMargin + 18, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Place of Supply: ', leftMargin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(PLACE_OF_SUPPLY, leftMargin + 32, y);

  return y + 8; // return Y where table should start
}

// ─── Shared footer: amount in words, payment, QR ──────────────────────────────
async function buildPDFFooter(
  doc: jsPDF,
  grandTotal: number,
  paymentMethod: string | undefined,
  finalY: number
): Promise<void> {
  const pageWidth  = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  const rightEdge  = pageWidth - 14;

  let y = finalY + 8;

  // Amount in Words
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Amount in Words: ', leftMargin, y);
  doc.setFont('helvetica', 'normal');
  const wordsText  = numberToWords(grandTotal);
  const wordsLines = doc.splitTextToSize(wordsText, rightEdge - leftMargin - 32);
  doc.text(wordsLines, leftMargin + 32, y);
  y += wordsLines.length * 5;

  // Payment Method
  if (paymentMethod) {
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Method: ', leftMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(paymentMethod, leftMargin + 30, y);
    y += 10;
  } else {
    y += 4;
  }

  // Payment Details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Payment Details', leftMargin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Account No: 33300200000841', leftMargin, y);
  y += 6;
  doc.text('IFSC Code: BARB0GODIRD', leftMargin, y);

  // QR Code
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – qrcode is installed but not picked up by bundler tsconfig
    const QRCode   = await import('qrcode');
    const upiID    = 'ten19327841@barodampay';
    const payeeName = 'TEN11 HAIR STUDIO AND SKIN CARE';
    const upiUrl   = `upi://pay?pa=${encodeURIComponent(upiID)}&pn=${encodeURIComponent(payeeName)}&am=${grandTotal.toFixed(2)}&cu=INR`;
    const dynamicQrBase64 = await QRCode.toDataURL(upiUrl, {
      margin: 2,
      width: 300,
      errorCorrectionLevel: 'H',
    });

    if (dynamicQrBase64) {
      const qrSize = 25;
      const qrX    = rightEdge - qrSize;
      const qrY    = y - 18;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('SCAN TO PAY', qrX + qrSize / 2, qrY - 2, { align: 'center' });
      doc.addImage(dynamicQrBase64, 'PNG', qrX, qrY, qrSize, qrSize);
    }
  } catch (error) {
    console.error('Error generating QR code:', error);
  }

  y += 20;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text('Thank you for choosing TEN11 Salon & Skin Care!', pageWidth / 2, y, { align: 'center' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORIGINAL / SERVICE INVOICE  (kept async, with logo added)
// ═══════════════════════════════════════════════════════════════════════════════
export const generateInvoicePDF = async (data: {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  services: any[];
  products: any[];
  subtotal: number;
  tax: number;
  discount: number;
  grandTotal: number;
  paymentMethod?: string;
}) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const leftMargin = 14;
  const rightEdge  = doc.internal.pageSize.getWidth() - 14;

  // Load logo
  const logoDataUrl = await getLogoDataUrl();

  // Invoice number: T11-YYYY-MM-DD
  const invoiceDate = new Date(data.date);
  const invoiceNo   = `T11-${format(invoiceDate, 'yyyy-MM-dd')}`;
  const dateStr     = format(invoiceDate, 'dd MMM yyyy');

  // Header (with logo)
  let y = buildPDFHeader(doc, logoDataUrl, invoiceNo, dateStr, data.customerName, data.customerPhone);

  // Items
  const allItems: { name: string; sac: string; qty: number; unitPrice: number; amount: number }[] = [];

  data.services.forEach(s => {
    allItems.push({
      name: s.name,
      sac: getSACCode(s.name),
      qty: s.quantity,
      unitPrice: s.price,
      amount: Math.round(s.quantity * s.price * 100) / 100,
    });
  });

  data.products.forEach(p => {
    allItems.push({
      name: `${p.name} (Product)`,
      sac: '998721',
      qty: p.quantity,
      unitPrice: p.price,
      amount: Math.round(p.quantity * p.price * 100) / 100,
    });
  });

  // GST (5% inclusive)
  const grossTotal     = allItems.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = data.discount > 0 ? data.discount : 0;
  const grandTotal     = grossTotal - discountAmount;
  const taxableValue   = Math.round((grandTotal / (1 + GST_RATE)) * 100) / 100;
  const totalGST       = Math.round((grandTotal - taxableValue) * 100) / 100;
  const cgstAmount     = Math.round((totalGST / 2) * 100) / 100;
  const sgstAmount     = Math.round((totalGST - cgstAmount) * 100) / 100;

  const itemRows: any[] = allItems.map((item, idx) => [
    (idx + 1).toString(),
    item.name,
    item.sac,
    item.qty.toString(),
    item.unitPrice.toFixed(2),
    item.amount.toFixed(2),
  ]);

  if (discountAmount > 0) {
    itemRows.push([
      { content: 'Gross Total:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: grossTotal.toFixed(2), styles: { halign: 'right' } },
    ]);
    itemRows.push([
      { content: 'Discount:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: `-${discountAmount.toFixed(2)}`, styles: { halign: 'right', textColor: [200, 0, 0] } },
    ]);
  }

  itemRows.push([
    { content: 'Taxable Value:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: taxableValue.toFixed(2), styles: { halign: 'right' } },
  ]);
  itemRows.push([
    { content: `CGST @ ${(CGST_RATE * 100).toFixed(1)}%:`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: cgstAmount.toFixed(2), styles: { halign: 'right' } },
  ]);
  itemRows.push([
    { content: `SGST @ ${(SGST_RATE * 100).toFixed(1)}%:`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: sgstAmount.toFixed(2), styles: { halign: 'right' } },
  ]);
  itemRows.push([
    { content: `Total GST (${(GST_RATE * 100).toFixed(0)}%):`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: totalGST.toFixed(2), styles: { halign: 'right' } },
  ]);
  itemRows.push([
    { content: 'Grand Total:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } },
    { content: grandTotal.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } },
  ]);

  if (itemRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['S.No.', 'Service Description', 'SAC', 'Qty', 'Unit Price', 'Amount']],
      body: itemRows,
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9, halign: 'center' },
      styles: { fontSize: 9, cellPadding: 3, textColor: [30, 30, 30], lineColor: [0, 0, 0], lineWidth: 0.3 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 14 },
        1: { cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'center', cellWidth: 16 },
        4: { halign: 'right', cellWidth: 28 },
        5: { halign: 'right', cellWidth: 28 },
      },
    });
  }

  const finalY = (doc as any).lastAutoTable.finalY;
  await buildPDFFooter(doc, grandTotal, data.paymentMethod, finalY);

  doc.save(`TEN11_Invoice_${invoiceNo}.pdf`);
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT INVOICE  (new — only offered when visit has products)
// ═══════════════════════════════════════════════════════════════════════════════
export const generateProductInvoicePDF = async (data: {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  products: any[];
  grandTotal: number;
  paymentMethod?: string;
}) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const leftMargin = 14;

  // Load logo
  const logoDataUrl = await getLogoDataUrl();

  const invoiceDate = new Date(data.date);
  const invoiceNo   = `T11-${format(invoiceDate, 'yyyy-MM-dd')}-P`;
  const dateStr     = format(invoiceDate, 'dd MMM yyyy');

  // Header
  let y = buildPDFHeader(doc, logoDataUrl, invoiceNo, dateStr, data.customerName, data.customerPhone);

  // Product rows (HSN 33049910 — cosmetics/beauty products, 18% GST)
  const allItems = data.products.map(p => ({
    name: p.name,
    hsn:  p.hsnCode || '33049910',
    qty:  p.quantity,
    unitPrice: p.price,
    amount: Math.round(p.quantity * p.price * 100) / 100,
  }));

  // GST (18% inclusive)
  const grossTotal   = allItems.reduce((sum, item) => sum + item.amount, 0);
  const grandTotal   = data.grandTotal || grossTotal;
  const taxableValue = Math.round((grandTotal / (1 + PRODUCT_GST_RATE)) * 100) / 100;
  const totalGST     = Math.round((grandTotal - taxableValue) * 100) / 100;
  const cgstAmount   = Math.round((totalGST / 2) * 100) / 100;
  const sgstAmount   = Math.round((totalGST - cgstAmount) * 100) / 100;

  const itemRows: any[] = allItems.map((item, idx) => [
    (idx + 1).toString(),
    item.name,
    item.hsn,
    item.qty.toString(),
    item.unitPrice.toFixed(2),
    item.amount.toFixed(2),
  ]);

  itemRows.push([
    { content: 'Taxable Value:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: taxableValue.toFixed(2), styles: { halign: 'right' } },
  ]);
  itemRows.push([
    { content: `CGST @ ${(PRODUCT_CGST_RATE * 100).toFixed(0)}%:`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: cgstAmount.toFixed(2), styles: { halign: 'right' } },
  ]);
  itemRows.push([
    { content: `SGST @ ${(PRODUCT_SGST_RATE * 100).toFixed(0)}%:`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: sgstAmount.toFixed(2), styles: { halign: 'right' } },
  ]);
  itemRows.push([
    { content: `Total GST (${(PRODUCT_GST_RATE * 100).toFixed(0)}%):`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: totalGST.toFixed(2), styles: { halign: 'right' } },
  ]);
  itemRows.push([
    { content: 'Grand Total:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } },
    { content: grandTotal.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } },
  ]);

  autoTable(doc, {
    startY: y,
    head: [['S.No.', 'Product Description', 'HSN', 'Qty', 'Unit Price', 'Amount']],
    body: itemRows,
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9, halign: 'center' },
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 30, 30], lineColor: [0, 0, 0], lineWidth: 0.3 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 24 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 28 },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY;
  await buildPDFFooter(doc, grandTotal, data.paymentMethod, finalY);

  doc.save(`TEN11_Product_Invoice_${invoiceNo}.pdf`);
};
