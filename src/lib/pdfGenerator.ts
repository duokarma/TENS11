import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

// ── GST Configuration ──────────────────────────────────────────────
const GST_RATE = 0.05;        // 5% total GST
const CGST_RATE = 0.025;      // 2.5% CGST
const SGST_RATE = 0.025;      // 2.5% SGST
const GSTIN = '24ABCDE1234F1Z1';
const PLACE_OF_SUPPLY = 'Gujarat (24)';
const DEFAULT_SAC = '998721';  // Beauty & physical well-being services

// SAC code mapping for common salon service categories
const SAC_CODES: Record<string, string> = {
  'hair':     '998711',
  'haircut':  '998711',
  'styling':  '998711',
  'color':    '998711',
  'colour':   '998711',
  'keratin':  '998711',
  'smoothing':'998711',
  'rebonding':'998711',
  'perm':     '998711',
  'facial':   '998721',
  'cleanup':  '998721',
  'bleach':   '998721',
  'wax':      '998721',
  'threading':'998721',
  'makeup':   '998721',
  'bridal':   '998721',
  'skin':     '998721',
  'manicure': '998722',
  'pedicure': '998722',
  'nail':     '998722',
  'spa':      '998723',
  'massage':  '998723',
  'body':     '998723',
};

// ── Invoice Data Interface ─────────────────────────────────────────
export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  services: { name: string; quantity: number; price: number; amount: number }[];
  products: { name: string; quantity: number; price: number; amount: number }[];
  subtotal: number;
  tax: number;
  discount: number;
  grandTotal: number;
  paymentMethod?: string;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Look up the SAC code for a service by matching keywords in its name */
function getSACCode(serviceName: string): string {
  const lower = serviceName.toLowerCase();
  for (const [keyword, sac] of Object.entries(SAC_CODES)) {
    if (lower.includes(keyword)) return sac;
  }
  return DEFAULT_SAC;
}

/** Convert a number to Indian-English words (e.g. 1500 → "One Thousand Five Hundred") */
function numberToWords(num: number): string {
  if (num === 0) return 'Zero';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertChunk(n % 100) : '');
  }

  const intPart = Math.floor(Math.abs(num));
  const decPart = Math.round((Math.abs(num) - intPart) * 100);

  // Indian numbering: Crore (10^7), Lakh (10^5), Thousand (10^3), Hundred (10^2)
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

  result = result.trim();

  if (decPart > 0) {
    result += ' and ' + convertChunk(decPart) + ' Paise';
  }

  return result + ' Rupees Only';
}

/** Load an image from a URL and return its base64 data URI */
function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Resize QR to a reasonable size for the PDF (150×150 px)
      const size = 150;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Failed to load QR image'));
    img.src = url;
  });
}

// ── Main PDF Generator ─────────────────────────────────────────────
export const generateInvoicePDF = async (data: InvoiceData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();  // 210mm (A4)
  const leftMargin = 14;
  const rightEdge = pageWidth - 14; // 196

  // ── Load QR code image ──
  let qrBase64: string | null = null;
  try {
    qrBase64 = await loadImageAsBase64('/qr-payment.jpg');
  } catch {
    console.warn('Could not load QR code image');
  }

  // ══════════════════════════════════════════════════════════════════
  //  HEADER — "TAX INVOICE"
  // ══════════════════════════════════════════════════════════════════
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TAX INVOICE', pageWidth / 2, 18, { align: 'center' });

  // Decorative line under title
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, 22, rightEdge, 22);

  // ══════════════════════════════════════════════════════════════════
  //  SALON DETAILS (left)  +  INVOICE META (right)
  // ══════════════════════════════════════════════════════════════════
  let y = 30;

  // Left — Salon info
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TEN11 SALON & SKIN CARE', leftMargin, y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Luxury Hair & Beauty, tower, F13, Khushil, First floor, 14/6', leftMargin, y + 6);
  doc.text('Govindnagar, Dahod, Gujarat 389151', leftMargin, y + 11);
  doc.text('Phone: +91 98765 43210', leftMargin, y + 16);

  // Right — GSTIN, Invoice No, Date
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`GSTIN: ${GSTIN}`, rightEdge, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  // Invoice number format: T11-YYYY-MM-DD
  const invoiceDate = new Date(data.date);
  const invoiceNo = `T11-${format(invoiceDate, 'yyyy-MM-dd')}`;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Invoice No:', rightEdge - 45, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(invoiceNo, rightEdge, y + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', rightEdge - 45, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(format(invoiceDate, 'dd MMM yyyy'), rightEdge, y + 12, { align: 'right' });

  // ══════════════════════════════════════════════════════════════════
  //  BILL TO
  // ══════════════════════════════════════════════════════════════════
  y = 56;
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
  doc.text(data.customerName || 'Walk-in Customer', leftMargin + 28, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Contact: ', leftMargin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.customerPhone || '-', leftMargin + 18, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Place of Supply: ', leftMargin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(PLACE_OF_SUPPLY, leftMargin + 32, y);

  // ══════════════════════════════════════════════════════════════════
  //  ITEMS TABLE
  // ══════════════════════════════════════════════════════════════════
  y += 8;

  // Combine services and products
  const allItems: { name: string; sac: string; qty: number; unitPrice: number; amount: number }[] = [];

  data.services.forEach(s => {
    allItems.push({
      name: s.name,
      sac: getSACCode(s.name),
      qty: s.quantity,
      unitPrice: s.price,
      amount: s.amount,
    });
  });

  data.products.forEach(p => {
    allItems.push({
      name: `${p.name} (Product)`,
      sac: '998721',
      qty: p.quantity,
      unitPrice: p.price,
      amount: p.amount,
    });
  });

  // The grand total is what the customer pays (GST inclusive).
  // Reverse-calculate the pre-GST base from grandTotal.
  const grandTotal = data.grandTotal;
  const preGSTBase = Math.round((grandTotal / (1 + GST_RATE)) * 100) / 100;
  const cgstAmount = Math.round(preGSTBase * CGST_RATE * 100) / 100;
  const sgstAmount = Math.round(preGSTBase * SGST_RATE * 100) / 100;
  const totalGST = Math.round((cgstAmount + sgstAmount) * 100) / 100;

  // Calculate proportional pre-GST unit prices for each item
  const totalItemsAmount = allItems.reduce((sum, it) => sum + it.amount, 0);
  const itemRows = allItems.map((item, idx) => {
    // Proportional pre-GST amount for this item
    const proportion = totalItemsAmount > 0 ? item.amount / totalItemsAmount : 0;
    const itemPreGST = Math.round(preGSTBase * proportion * 100) / 100;
    const itemUnitPreGST = item.qty > 0 ? Math.round((itemPreGST / item.qty) * 100) / 100 : 0;

    return [
      (idx + 1).toString(),
      item.name,
      item.sac,
      item.qty.toString(),
      itemUnitPreGST.toFixed(2),
      itemPreGST.toFixed(2),
    ];
  });

  if (itemRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['S.No.', 'Service Description', 'SAC', 'Qty', 'Unit Price', 'Amount']],
      body: itemRows,
      theme: 'grid',
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [30, 30, 30],
        lineColor: [0, 0, 0],
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 14 },
        1: { cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'center', cellWidth: 16 },
        4: { halign: 'right', cellWidth: 28 },
        5: { halign: 'right', cellWidth: 28 },
      },
    });

    y = (doc as any).lastAutoTable.finalY;
  }

  // ══════════════════════════════════════════════════════════════════
  //  TOTALS & GST BREAKDOWN (right-aligned rows inside table)
  // ══════════════════════════════════════════════════════════════════
  const totalsData = [
    ['Subtotal:', preGSTBase.toFixed(2)],
    [`CGST @ ${(CGST_RATE * 100).toFixed(1)}%:`, cgstAmount.toFixed(2)],
    [`SGST @ ${(SGST_RATE * 100).toFixed(1)}%:`, sgstAmount.toFixed(2)],
    [`Total GST (${(GST_RATE * 100).toFixed(0)}%):`, totalGST.toFixed(2)],
    ['Grand Total', grandTotal.toFixed(2)],
  ];

  autoTable(doc, {
    startY: y,
    body: totalsData,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [30, 30, 30],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { halign: 'right', fontStyle: 'bold', cellWidth: 140 },
      1: { halign: 'right', cellWidth: 28 },
    },
    didParseCell: (hookData: any) => {
      // Make Grand Total row stand out
      if (hookData.row.index === 4) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fontSize = 10;
        hookData.cell.styles.textColor = [0, 0, 0];
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ══════════════════════════════════════════════════════════════════
  //  AMOUNT IN WORDS
  // ══════════════════════════════════════════════════════════════════
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Amount in Words: `, leftMargin, y);
  doc.setFont('helvetica', 'normal');
  const wordsText = numberToWords(grandTotal);
  // Wrap long text
  const wordsLines = doc.splitTextToSize(wordsText, rightEdge - leftMargin - 32);
  doc.text(wordsLines, leftMargin + 32, y);
  y += wordsLines.length * 4 + 4;

  // ══════════════════════════════════════════════════════════════════
  //  PAYMENT METHOD
  // ══════════════════════════════════════════════════════════════════
  if (data.paymentMethod) {
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Method: ', leftMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.paymentMethod, leftMargin + 30, y);
    y += 6;
  }

  // ══════════════════════════════════════════════════════════════════
  //  PAYMENT DETAILS  +  QR CODE
  // ══════════════════════════════════════════════════════════════════
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, y, rightEdge, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Payment Details', leftMargin, y);
  y += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Account No: 33300200000841', leftMargin, y);
  y += 6;
  doc.text('IFSC Code: BARB0GODIRD', leftMargin, y);

  // QR code on the right
  if (qrBase64) {
    const qrSize = 30; // mm
    const qrX = rightEdge - qrSize;
    const qrY = y - 16;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('SCAN TO PAY', qrX + qrSize / 2, qrY - 2, { align: 'center' });
    doc.addImage(qrBase64, 'JPEG', qrX, qrY, qrSize, qrSize);
  }

  y += 10;

  // ══════════════════════════════════════════════════════════════════
  //  FOOTER
  // ══════════════════════════════════════════════════════════════════
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, y + 2, rightEdge, y + 2);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Thank you for choosing TEN11 Salon & Skin Care!', pageWidth / 2, y + 8, { align: 'center' });
  doc.text('This is a computer-generated invoice.', pageWidth / 2, y + 12, { align: 'center' });

  // ── Save PDF ─────────────────────────────────────────────────────
  doc.save(`TEN11_Invoice_${data.invoiceNumber}.pdf`);
};
