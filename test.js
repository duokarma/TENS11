import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import QRCode from 'qrcode';

const GSTIN = '24ABCDE1234F1Z1'; 
const PLACE_OF_SUPPLY = 'Gujarat (24)';
const GST_RATE = 0.05; 
const CGST_RATE = 0.025; 
const SGST_RATE = 0.025; 

function numberToWords(num) {
  if (num === 0) return 'Zero';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n) {
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

async function run() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  const rightEdge = pageWidth - 14;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TAX INVOICE', pageWidth / 2, 18, { align: 'center' });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, 22, rightEdge, 22);

  let y = 30;

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

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`GSTIN: ${GSTIN}`, rightEdge, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Invoice No:', rightEdge - 45, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text('T11-2026-08-28', rightEdge, y + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', rightEdge - 45, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text('28 Aug 2026', rightEdge, y + 12, { align: 'right' });

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
  doc.text('Walk-in Customer', leftMargin + 28, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Contact: ', leftMargin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('-', leftMargin + 18, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Place of Supply: ', leftMargin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(PLACE_OF_SUPPLY, leftMargin + 32, y);

  y += 8;

  const allItems = [
    { name: 'KENPEKI CLEANUP', sac: '998721', qty: 1, unitPrice: 1500, amount: 1500 },
    { name: 'HEEL PEEL', sac: '998721', qty: 1, unitPrice: 3000, amount: 3000 }
  ];

  const grossTotal = allItems.reduce((sum, item) => sum + item.amount, 0);
  
  const discountAmount = 0;
  const netCustomerTotal = grossTotal - discountAmount;
  
  const taxableValue = Math.round((netCustomerTotal / (1 + GST_RATE)) * 100) / 100;
  
  const totalGST = Math.round((netCustomerTotal - taxableValue) * 100) / 100;
  
  const cgstAmount = Math.round((totalGST / 2) * 100) / 100;
  const sgstAmount = Math.round((totalGST / 2) * 100) / 100;
  
  const grandTotal = netCustomerTotal;

  const itemRows = allItems.map((item, idx) => {
    return [
      (idx + 1).toString(),
      item.name,
      item.sac,
      item.qty.toString(),
      item.unitPrice.toFixed(2),
      item.amount.toFixed(2),
    ];
  });

  itemRows.push([
    { content: 'Taxable Value:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: taxableValue.toFixed(2), styles: { halign: 'right' } }
  ]);
  
  itemRows.push([
    { content: `CGST @ ${(CGST_RATE * 100).toFixed(1)}%:`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: cgstAmount.toFixed(2), styles: { halign: 'right' } }
  ]);
  
  itemRows.push([
    { content: `SGST @ ${(SGST_RATE * 100).toFixed(1)}%:`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: sgstAmount.toFixed(2), styles: { halign: 'right' } }
  ]);
  
  itemRows.push([
    { content: `Total GST (${(GST_RATE * 100).toFixed(0)}%):`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
    { content: totalGST.toFixed(2), styles: { halign: 'right' } }
  ]);
  
  itemRows.push([
    { content: 'Grand Total:', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } },
    { content: grandTotal.toFixed(2), styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } }
  ]);

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

  y = doc.lastAutoTable.finalY + 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Amount in Words: ', leftMargin, y);
  doc.setFont('helvetica', 'normal');
  const wordsText = numberToWords(grandTotal);
  const wordsLines = doc.splitTextToSize(wordsText, rightEdge - leftMargin - 32);
  doc.text(wordsLines, leftMargin + 32, y);
  y += wordsLines.length * 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Payment Method: ', leftMargin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('UPI', leftMargin + 30, y);
  y += 10;

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

  const upiID = 'duokarma54@okicici'; 
  const upiName = 'TEN11 SALON';
  const upiURI = `upi://pay?pa=${upiID}&pn=${encodeURIComponent(upiName)}&am=${grandTotal.toFixed(2)}&cu=INR`;
  
  const dynamicQrBase64 = await QRCode.toDataURL(upiURI, { margin: 1, width: 120 });
  
  const qrSize = 25; 
  const qrX = rightEdge - qrSize;
  const qrY = y - 18;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('SCAN TO PAY', qrX + qrSize / 2, qrY - 2, { align: 'center' });
  doc.addImage(dynamicQrBase64, 'PNG', qrX, qrY, qrSize, qrSize);

  y += 20;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text('Thank you for choosing TEN11 Salon & Skin Care!', pageWidth / 2, y, { align: 'center' });

  const pdfData = doc.output('arraybuffer');
  fs.writeFileSync('C:/Users/Moizd/.gemini/antigravity/brain/a06608ef-6f40-42bf-856e-d0b2fc54b3f1/TEN11_Invoice_TEST.pdf', Buffer.from(pdfData));
  console.log('PDF saved.');
}

run().catch(console.error);
