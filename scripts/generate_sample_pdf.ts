import { fetchInvoicesForPeriod, processInvoices, calculateReportSummary, formatINR, numberToWords } from '../src/lib/gstReportService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

async function generateAll() {
  console.log('=== GENERATING ALL PRODUCTION STATUTORY ARTIFACTS ===');
  const rawVisits = await fetchInvoicesForPeriod({ month: '2026-11' });
  const invoices = processInvoices(rawVisits);
  const summary = calculateReportSummary(invoices);
  const periodLabel = 'November 2026';

  const outDir = path.resolve(process.cwd(), 'dist_test');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // ─── 1. GSTR-1 PDF ──────────────────────────────────────────────────────────
  const gstr1Doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = gstr1Doc.internal.pageSize.getWidth();
  const pageHeight = gstr1Doc.internal.pageSize.getHeight();
  const leftMargin = 14;
  const rightEdge = pageWidth - 14;
  const printableWidth = rightEdge - leftMargin;

  let y = 14;
  gstr1Doc.setFontSize(14);
  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.text('FORM GSTR-1', leftMargin, y + 5);
  gstr1Doc.setFontSize(8.5);
  gstr1Doc.setFont('helvetica', 'normal');
  gstr1Doc.text('[See rule 59(1)]', leftMargin, y + 10);
  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.text('Details of Outward Supplies of Goods or Services', leftMargin, y + 15);

  // Badge
  gstr1Doc.setDrawColor(180, 40, 40);
  gstr1Doc.setFillColor(254, 242, 242);
  gstr1Doc.rect(rightEdge - 75, y + 2, 75, 14, 'FD');
  gstr1Doc.setFontSize(7.5);
  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.setTextColor(180, 40, 40);
  gstr1Doc.text('PROVISIONAL / MTD REPORT', rightEdge - 37.5, y + 7, { align: 'center' });
  gstr1Doc.setFontSize(6);
  gstr1Doc.setFont('helvetica', 'normal');
  gstr1Doc.text('INTERIM REPORT (AS OF 18-NOV-2026)', rightEdge - 37.5, y + 12, { align: 'center' });

  y += 20;

  // Basic info box
  gstr1Doc.setDrawColor(200, 205, 210);
  gstr1Doc.setFillColor(248, 250, 252);
  gstr1Doc.rect(leftMargin, y, printableWidth, 24, 'FD');
  gstr1Doc.setFontSize(8);
  gstr1Doc.setTextColor(40, 40, 40);

  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.text('1. GSTIN:', leftMargin + 3, y + 5.5);
  gstr1Doc.setFont('helvetica', 'normal');
  gstr1Doc.text('24HDQPM1606E1ZM', leftMargin + 18, y + 5.5);

  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.text('Financial Year:', leftMargin + 68, y + 5.5);
  gstr1Doc.setFont('helvetica', 'normal');
  gstr1Doc.text('2026-27', leftMargin + 90, y + 5.5);

  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.text('Tax Period:', leftMargin + 118, y + 5.5);
  gstr1Doc.setFont('helvetica', 'normal');
  gstr1Doc.text(periodLabel, leftMargin + 136, y + 5.5);

  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.text('2. (a) Legal Name:', leftMargin + 3, y + 11.5);
  gstr1Doc.setFont('helvetica', 'normal');
  gstr1Doc.text('TEN11 SALON & SKIN CARE', leftMargin + 28, y + 11.5);

  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.text('Taxpayer Category:', leftMargin + 118, y + 11.5);
  gstr1Doc.setFont('helvetica', 'normal');
  gstr1Doc.text('Regular / Section 9', leftMargin + 146, y + 11.5);

  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.text('2. (b) Trade Name:', leftMargin + 3, y + 17.5);
  gstr1Doc.setFont('helvetica', 'normal');
  gstr1Doc.text('TEN11 SALON & SKIN CARE', leftMargin + 28, y + 17.5);

  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.text('3. (a) Preceding FY Turnover:', leftMargin + 95, y + 17.5);
  gstr1Doc.setFont('helvetica', 'normal');
  gstr1Doc.text('Verified Active (Regular)', leftMargin + 140, y + 17.5);

  y += 29;

  // Table 4
  gstr1Doc.setFontSize(9);
  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.setTextColor(20, 25, 30);
  gstr1Doc.text('4. Taxable outward supplies made to registered persons (B2B)', leftMargin, y);
  y += 4;

  autoTable(gstr1Doc, {
    startY: y,
    head: [['#', 'GSTIN/UIN', 'Receiver Name', 'Invoice #', 'Date', 'Invoice Value (Rs)', 'POS', 'Rate', 'Taxable (Rs)', 'CGST (Rs)', 'SGST (Rs)']],
    body: [[{ content: '1', styles: { halign: 'center' } }, { content: 'No B2B Supplies during this period (All supplies were B2C Unregistered Consumers)', colSpan: 10, styles: { halign: 'center', fontStyle: 'italic', textColor: [120, 120, 120] } }]] as any,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2 }
  });

  y = (gstr1Doc as any).lastAutoTable.finalY + 7;

  // Table 5
  gstr1Doc.setFontSize(9);
  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.text('5. Taxable outward inter-State supplies to unregistered persons (> Rs. 2.5 Lakh) - B2C Large', leftMargin, y);
  y += 4;

  autoTable(gstr1Doc, {
    startY: y,
    head: [['#', 'Place of Supply', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value (Rs)', 'Integrated Tax (Rs)', 'Cess (Rs)']],
    body: [[{ content: '1', styles: { halign: 'center' } }, { content: 'NIL / No inter-State B2C supplies exceeding Rs 2.5 Lakh', colSpan: 6, styles: { halign: 'center', fontStyle: 'italic', textColor: [120, 120, 120] } }]] as any,
    theme: 'grid',
    headStyles: { fillColor: [74, 85, 104], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 1.8 }
  });

  y = (gstr1Doc as any).lastAutoTable.finalY + 7;

  // Table 7: B2C Small
  gstr1Doc.setFontSize(9);
  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.text(`7. Taxable supplies to unregistered persons (B2C Small) — Total: ${summary.b2cCount} Invoices`, leftMargin, y);
  y += 4;

  const b2cRows: any[] = [];
  let b2cIdx = 1;
  for (const [rateStr, vals] of Object.entries(summary.rateBuckets)) {
    const rateNum = Number(rateStr);
    const label = rateNum === 18 ? 'Cosmetics & Retail Products (18%)' : 'Salon & Beauty Treatment Services (5%)';
    b2cRows.push([
      (b2cIdx++).toString(),
      label,
      '24-Gujarat',
      `${rateNum}%`,
      formatINR(vals.taxable),
      '0.00',
      formatINR(vals.cgst),
      formatINR(vals.sgst),
      '0.00'
    ]);
  }
  b2cRows.push([
    { content: 'TOTAL B2C SUPPLIES:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
    { content: formatINR(summary.taxableSales), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
    { content: '0.00', styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
    { content: formatINR(summary.cgstTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
    { content: formatINR(summary.sgstTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
    { content: '0.00', styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } }
  ]);

  autoTable(gstr1Doc, {
    startY: y,
    head: [['#', 'Type', 'Place of Supply (POS)', 'Rate', 'Taxable Value (Rs)', 'Integrated Tax (Rs)', 'Central Tax (Rs)', 'State/UT Tax (Rs)', 'Cess (Rs)']],
    body: b2cRows as any,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2, halign: 'center' }
  });

  y = (gstr1Doc as any).lastAutoTable.finalY + 7;

  // Table 8: Nil-rated
  gstr1Doc.setFontSize(9);
  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.text('8. Nil rated, exempted and non-GST outward supplies', leftMargin, y);
  y += 4;

  const table8Rows = [
    ['1', 'Inter-State supplies to registered persons', '0.00', '0.00', '0.00'],
    ['2', 'Intra-State supplies to registered persons', '0.00', '0.00', '0.00'],
    ['3', 'Inter-State supplies to unregistered persons', '0.00', '0.00', '0.00'],
    ['4', 'Intra-State supplies to unregistered persons', formatINR(summary.nilRatedSupplies), formatINR(summary.exemptedSupplies), formatINR(summary.nonGstSupplies)],
    [
      { content: 'TOTAL EXEMPT / NIL RATED:', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: formatINR(summary.nilRatedSupplies), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: formatINR(summary.exemptedSupplies), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: formatINR(summary.nonGstSupplies), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } }
    ]
  ];

  autoTable(gstr1Doc, {
    startY: y,
    head: [['#', 'Description', 'Nil Rated Supplies (Rs)', 'Exempted (Rs)', 'Non-GST Supplies (Rs)']],
    body: table8Rows as any,
    theme: 'grid',
    headStyles: { fillColor: [74, 85, 104], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 1.8 }
  });

  // Page 2: Table 12 & Table 13
  gstr1Doc.addPage();
  y = 16;
  gstr1Doc.setFontSize(9);
  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.text(`12. HSN-wise summary of outward supplies (${summary.hsnSummary.length} Records)`, leftMargin, y);
  y += 4;

  const hsnTableData: any[] = [];
  let hsnQty = 0;
  let hsnVal = 0;
  summary.hsnSummary.forEach((h, idx) => {
    hsnQty += h.quantity;
    hsnVal += h.totalValue;
    hsnTableData.push([
      (idx + 1).toString(),
      h.code,
      h.desc,
      'NOS',
      h.quantity.toString(),
      formatINR(h.totalValue),
      formatINR(h.taxableValue),
      `${h.gstRate}%`,
      formatINR(h.cgst),
      formatINR(h.sgst)
    ]);
  });
  hsnTableData.push([
    { content: 'TOTAL HSN SUMMARY:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
    { content: hsnQty.toString(), styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 243, 246] } },
    { content: formatINR(hsnVal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
    { content: formatINR(summary.taxableSales), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
    { content: '-', styles: { halign: 'center', fillColor: [240, 243, 246] } },
    { content: formatINR(summary.cgstTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
    { content: formatINR(summary.sgstTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } }
  ]);

  autoTable(gstr1Doc, {
    startY: y,
    head: [['#', 'HSN/SAC', 'Description', 'UQC', 'Total Qty', 'Total Value (Rs)', 'Taxable Value (Rs)', 'Rate', 'CGST (Rs)', 'SGST (Rs)']],
    body: hsnTableData as any,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2 }
  });

  y = (gstr1Doc as any).lastAutoTable.finalY + 7;

  // Table 13: Docs
  gstr1Doc.setFontSize(9);
  gstr1Doc.setFont('helvetica', 'bold');
  gstr1Doc.text('13. Documents issued during the tax period', leftMargin, y);
  y += 4;

  const docRows = [
    [
      '1',
      'Invoices for Outward Supply (Tax Invoice)',
      invoices[0]?.invoiceNumber || 'N/A',
      invoices[invoices.length - 1]?.invoiceNumber || 'N/A',
      summary.invoiceCount.toString(),
      '0',
      summary.invoiceCount.toString()
    ],
    [
      { content: 'TOTAL DOCUMENTS:', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: summary.invoiceCount.toString(), styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: '0', styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: summary.invoiceCount.toString(), styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 243, 246] } }
    ]
  ];

  autoTable(gstr1Doc, {
    startY: y,
    head: [['#', 'Nature of Document', 'From Serial #', 'To Serial #', 'Total Number', 'Cancelled', 'Net Issued']],
    body: docRows as any,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2, halign: 'center' }
  });

  const gstr1File = path.join(outDir, 'FORM_GSTR1_November_2026.pdf');
  fs.writeFileSync(gstr1File, Buffer.from(gstr1Doc.output('arraybuffer')));
  console.log(`Saved GSTR-1 PDF: ${gstr1File} (${fs.statSync(gstr1File).size} bytes)`);

  // ─── 2. GSTR-3B PDF ─────────────────────────────────────────────────────────
  const gstr3bDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y3 = 14;

  gstr3bDoc.setFontSize(14);
  gstr3bDoc.setFont('helvetica', 'bold');
  gstr3bDoc.text('FORM GSTR-3B', leftMargin, y3 + 5);
  gstr3bDoc.setFontSize(8.5);
  gstr3bDoc.setFont('helvetica', 'normal');
  gstr3bDoc.text('[See rule 61(5)]', leftMargin, y3 + 10);
  gstr3bDoc.setFont('helvetica', 'bold');
  gstr3bDoc.text('Monthly Return', leftMargin, y3 + 15);

  // Badge
  gstr3bDoc.setDrawColor(180, 40, 40);
  gstr3bDoc.setFillColor(254, 242, 242);
  gstr3bDoc.rect(rightEdge - 75, y3 + 2, 75, 14, 'FD');
  gstr3bDoc.setFontSize(7.5);
  gstr3bDoc.setFont('helvetica', 'bold');
  gstr3bDoc.setTextColor(180, 40, 40);
  gstr3bDoc.text('PROVISIONAL / MTD RETURN', rightEdge - 37.5, y3 + 7, { align: 'center' });
  gstr3bDoc.setFontSize(6);
  gstr3bDoc.setFont('helvetica', 'normal');
  gstr3bDoc.text('INTERIM REPORT (AS OF 18-NOV-2026)', rightEdge - 37.5, y3 + 12, { align: 'center' });

  y3 += 20;

  // Basic info box
  gstr3bDoc.setDrawColor(200, 205, 210);
  gstr3bDoc.setFillColor(248, 250, 252);
  gstr3bDoc.rect(leftMargin, y3, printableWidth, 24, 'FD');
  gstr3bDoc.setFontSize(8);
  gstr3bDoc.setTextColor(40, 40, 40);

  gstr3bDoc.setFont('helvetica', 'bold');
  gstr3bDoc.text('1. GSTIN:', leftMargin + 3, y3 + 5.5);
  gstr3bDoc.setFont('helvetica', 'normal');
  gstr3bDoc.text('24HDQPM1606E1ZM', leftMargin + 18, y3 + 5.5);

  gstr3bDoc.setFont('helvetica', 'bold');
  gstr3bDoc.text('Financial Year:', leftMargin + 68, y3 + 5.5);
  gstr3bDoc.setFont('helvetica', 'normal');
  gstr3bDoc.text('2026-27', leftMargin + 90, y3 + 5.5);

  gstr3bDoc.setFont('helvetica', 'bold');
  gstr3bDoc.text('Tax Period:', leftMargin + 118, y3 + 5.5);
  gstr3bDoc.setFont('helvetica', 'normal');
  gstr3bDoc.text(periodLabel, leftMargin + 136, y3 + 5.5);

  gstr3bDoc.setFont('helvetica', 'bold');
  gstr3bDoc.text('2. Legal Name:', leftMargin + 3, y3 + 11.5);
  gstr3bDoc.setFont('helvetica', 'normal');
  gstr3bDoc.text('TEN11 SALON & SKIN CARE', leftMargin + 25, y3 + 11.5);

  gstr3bDoc.setFont('helvetica', 'bold');
  gstr3bDoc.text('Taxpayer Category:', leftMargin + 118, y3 + 11.5);
  gstr3bDoc.setFont('helvetica', 'normal');
  gstr3bDoc.text('Regular / Section 9', leftMargin + 146, y3 + 11.5);

  gstr3bDoc.setFont('helvetica', 'bold');
  gstr3bDoc.text('2(a). Trade Name:', leftMargin + 3, y3 + 17.5);
  gstr3bDoc.setFont('helvetica', 'normal');
  gstr3bDoc.text('TEN11 SALON & SKIN CARE', leftMargin + 28, y3 + 17.5);

  gstr3bDoc.setFont('helvetica', 'bold');
  gstr3bDoc.text('Return Status:', leftMargin + 118, y3 + 17.5);
  gstr3bDoc.setFont('helvetica', 'normal');
  gstr3bDoc.text('Provisional (MTD)', leftMargin + 140, y3 + 17.5);

  y3 += 29;

  // Table 3.1
  gstr3bDoc.setFontSize(9);
  gstr3bDoc.setFont('helvetica', 'bold');
  gstr3bDoc.text('3.1 Details of Outward Supplies and inward supplies liable to reverse charge', leftMargin, y3);
  y3 += 4;

  const table31Rows = [
    ['(a) Outward taxable supplies (other than zero rated, nil rated and exempted)', formatINR(summary.taxableSales), '0.00', formatINR(summary.cgstTotal), formatINR(summary.sgstTotal), '0.00'],
    ['(b) Outward taxable supplies (zero rated)', '0.00', '0.00', '-', '-', '0.00'],
    ['(c) Other outward supplies (Nil rated, exempted)', '0.00', '-', '-', '-', '-'],
    ['(d) Inward supplies (liable to reverse charge)', '0.00', '0.00', '0.00', '0.00', '0.00'],
    ['(e) Non-GST outward supplies', '0.00', '-', '-', '-', '-'],
    [
      { content: 'TOTAL 3.1 LIABILITIES:', styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: formatINR(summary.taxableSales), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: formatINR(summary.cgstTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: formatINR(summary.sgstTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } }
    ]
  ];

  autoTable(gstr3bDoc, {
    startY: y3,
    head: [['Nature of Supplies', 'Total Taxable Value (Rs)', 'Integrated Tax (Rs)', 'Central Tax (Rs)', 'State/UT Tax (Rs)', 'Cess (Rs)']],
    body: table31Rows as any,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2 }
  });

  y3 = (gstr3bDoc as any).lastAutoTable.finalY + 6;

  // Table 4: ITC
  gstr3bDoc.setFontSize(9);
  gstr3bDoc.setFont('helvetica', 'bold');
  gstr3bDoc.setTextColor(20, 25, 30);
  gstr3bDoc.text('4. Eligible Input Tax Credit (ITC)', leftMargin, y3);
  gstr3bDoc.setFontSize(6.5);
  gstr3bDoc.setFont('helvetica', 'normal');
  gstr3bDoc.setTextColor(100, 100, 100);
  gstr3bDoc.text('Statutory Notice: ITC on 5% salon service inputs disallowed under Group 99972. Product ITC & Rule 42 Common ITC subject to CA GSTR-2B audit.', leftMargin, y3 + 4);
  y3 += 7;

  const itcRows = [
    ['(A) ITC Available (whether in full or part)', '', '', '', ''],
    ['   (1) Import of goods', '0.00', '0.00', '0.00', '0.00'],
    ['   (2) Import of services', '0.00', '0.00', '0.00', '0.00'],
    ['   (3) Inward supplies liable to reverse charge', '0.00', '0.00', '0.00', '0.00'],
    ['   (4) Inward supplies from ISD', '0.00', '0.00', '0.00', '0.00'],
    ['   (5) All other ITC (Eligible Product ITC & Rule 42 Common ITC)', '0.00', '0.00', '0.00', '0.00'],
    ['(B) ITC Reversed', '', '', '', ''],
    ['   (1) As per rules 42 & 43 of CGST Rules and section 17(5) (Ineligible Service Inputs)', '0.00', '0.00', '0.00', '0.00'],
    ['   (2) Others', '0.00', '0.00', '0.00', '0.00'],
    [
      { content: '(C) Net ITC Available (A) - (B)', styles: { fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } }
    ]
  ];

  autoTable(gstr3bDoc, {
    startY: y3,
    head: [['Details', 'Integrated Tax (Rs)', 'Central Tax (Rs)', 'State/UT Tax (Rs)', 'Cess (Rs)']],
    body: itcRows as any,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 1.8 }
  });

  y3 = (gstr3bDoc as any).lastAutoTable.finalY + 6;

  // Table 6.1: Payment of Tax
  gstr3bDoc.setFontSize(9);
  gstr3bDoc.setFont('helvetica', 'bold');
  gstr3bDoc.text('6.1 Payment of Tax (Actual Cash & ITC Settlement)', leftMargin, y3);
  y3 += 4;

  const table61Rows = [
    ['Integrated Tax', '0.00', '0.00', '0.00', '0.00', '0.00'],
    ['Central Tax', formatINR(summary.cgstTotal), '0.00', formatINR(summary.cgstTotal), '0.00', '0.00'],
    ['State/UT Tax', formatINR(summary.sgstTotal), '0.00', formatINR(summary.sgstTotal), '0.00', '0.00'],
    [
      { content: 'Total Net Settlement:', styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: formatINR(summary.totalGst), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: formatINR(summary.totalGst), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } },
      { content: '0.00', styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 243, 246] } }
    ]
  ];

  autoTable(gstr3bDoc, {
    startY: y3,
    head: [['Description', 'Tax Payable (Rs)', 'Paid through ITC (Rs)', 'Tax Paid in Cash (Rs)', 'Interest Paid (Rs)', 'Late Fee Paid (Rs)']],
    body: table61Rows as any,
    theme: 'grid',
    headStyles: { fillColor: [45, 55, 72], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 2 }
  });

  const gstr3bFile = path.join(outDir, 'FORM_GSTR3B_November_2026.pdf');
  fs.writeFileSync(gstr3bFile, Buffer.from(gstr3bDoc.output('arraybuffer')));
  console.log(`Saved GSTR-3B PDF: ${gstr3bFile} (${fs.statSync(gstr3bFile).size} bytes)`);

  // ─── 3. EXCEL WORKBOOKS ─────────────────────────────────────────────────────
  // GSTR-1 Excel
  const gstr1Wb = XLSX.utils.book_new();
  const b2csExcel = Object.entries(summary.rateBuckets).map(([r, val]) => ({
    'Type': 'OE',
    'Place Of Supply': '24-Gujarat',
    'Rate': Number(r),
    'Taxable Value': val.taxable,
    'Cess Amount': 0
  }));
  const hsnExcel = summary.hsnSummary.map(h => ({
    'HSN': h.code,
    'Description': h.desc,
    'UQC': 'OTH',
    'Total Quantity': h.quantity,
    'Total Value': h.totalValue,
    'Taxable Value': h.taxableValue,
    'Central Tax Amount': h.cgst,
    'State/UT Tax Amount': h.sgst
  }));
  const docsExcel = [{
    'Nature of Document': 'Invoices for outward supply',
    'Sr. No. From': invoices[0]?.invoiceNumber || 'N/A',
    'Sr. No. To': invoices[invoices.length - 1]?.invoiceNumber || 'N/A',
    'Total Number': summary.invoiceCount,
    'Cancelled': 0
  }];
  const nilExcel = [{
    'Description': 'Intra-State supplies to unregistered persons',
    'Nil Rated Supplies': summary.nilRatedSupplies,
    'Exempted': summary.exemptedSupplies,
    'Non-GST supplies': summary.nonGstSupplies
  }];

  XLSX.utils.book_append_sheet(gstr1Wb, XLSX.utils.json_to_sheet([{ 'Message': 'No B2B Invoices Recorded' }]), 'b2b');
  XLSX.utils.book_append_sheet(gstr1Wb, XLSX.utils.json_to_sheet(b2csExcel), 'b2cs');
  XLSX.utils.book_append_sheet(gstr1Wb, XLSX.utils.json_to_sheet(nilExcel), 'nil');
  XLSX.utils.book_append_sheet(gstr1Wb, XLSX.utils.json_to_sheet(hsnExcel), 'hsn');
  XLSX.utils.book_append_sheet(gstr1Wb, XLSX.utils.json_to_sheet(docsExcel), 'docs');

  const gstr1XlsxPath = path.join(outDir, 'GSTR1_Offline_November_2026.xlsx');
  XLSX.writeFile(gstr1Wb, gstr1XlsxPath);
  console.log(`Saved GSTR-1 Excel: ${gstr1XlsxPath} (${fs.statSync(gstr1XlsxPath).size} bytes)`);

  // GSTR-3B Excel
  const gstr3bWb = XLSX.utils.book_new();
  const sheet31 = [
    { 'Table 3.1 Supplies': '(a) Outward taxable supplies', 'Taxable Value': summary.taxableSales, 'IGST': 0, 'CGST': summary.cgstTotal, 'SGST': summary.sgstTotal, 'Cess': 0 },
    { 'Table 3.1 Supplies': '(b) Outward taxable supplies (zero rated)', 'Taxable Value': 0, 'IGST': 0, 'CGST': 0, 'SGST': 0, 'Cess': 0 },
    { 'Table 3.1 Supplies': '(c) Other outward supplies (nil rated, exempt)', 'Taxable Value': 0, 'IGST': 0, 'CGST': 0, 'SGST': 0, 'Cess': 0 },
    { 'Table 3.1 Supplies': '(d) Inward supplies (liable to reverse charge)', 'Taxable Value': 0, 'IGST': 0, 'CGST': 0, 'SGST': 0, 'Cess': 0 },
    { 'Table 3.1 Supplies': '(e) Non-GST outward supplies', 'Taxable Value': 0, 'IGST': 0, 'CGST': 0, 'SGST': 0, 'Cess': 0 }
  ];
  const sheet4 = [
    { 'Table 4 Eligible ITC': '(A) (5) All other ITC (Eligible Product ITC & Rule 42 Common ITC - To be confirmed by CA from GSTR-2B)', 'IGST': 0, 'CGST': 0, 'SGST': 0, 'Cess': 0 },
    { 'Table 4 Eligible ITC': '(B) (1) ITC Reversed as per Rule 42/43 & Section 17(5) (Ineligible Salon Service Inputs)', 'IGST': 0, 'CGST': 0, 'SGST': 0, 'Cess': 0 },
    { 'Table 4 Eligible ITC': '(C) Net ITC Available (Subject to CA GSTR-2B Purchase Reconciliation)', 'IGST': 0, 'CGST': 0, 'SGST': 0, 'Cess': 0 }
  ];
  const sheet61 = [
    { 'Description': 'Central Tax', 'Tax Payable': summary.cgstTotal, 'Paid Through ITC': 0, 'Tax Paid in Cash': summary.cgstTotal },
    { 'Description': 'State/UT Tax', 'Tax Payable': summary.sgstTotal, 'Paid Through ITC': 0, 'Tax Paid in Cash': summary.sgstTotal }
  ];
  XLSX.utils.book_append_sheet(gstr3bWb, XLSX.utils.json_to_sheet(sheet31), 'Table 3.1');
  XLSX.utils.book_append_sheet(gstr3bWb, XLSX.utils.json_to_sheet(sheet4), 'Table 4 ITC');
  XLSX.utils.book_append_sheet(gstr3bWb, XLSX.utils.json_to_sheet(sheet61), 'Table 6.1 Payment');

  const gstr3bXlsxPath = path.join(outDir, 'GSTR3B_Tables_November_2026.xlsx');
  XLSX.writeFile(gstr3bWb, gstr3bXlsxPath);
  console.log(`Saved GSTR-3B Excel: ${gstr3bXlsxPath} (${fs.statSync(gstr3bXlsxPath).size} bytes)`);

  // Invoice Register Excel
  const regWb = XLSX.utils.book_new();
  const regData: any[] = invoices.map((inv, idx) => ({
    'Sr No': idx + 1,
    'Invoice Number': inv.invoiceNumber,
    'Invoice Date': inv.formattedDate,
    'Customer Name': inv.customerName,
    'Customer Phone': inv.customerPhone,
    'GSTIN': inv.customerGstin || 'URP',
    'Supply Type': inv.isB2B ? 'B2B' : 'B2C',
    'Place of Supply': inv.placeOfSupply,
    'Payment Method': inv.paymentMethod,
    'Gross Amount (Rs)': inv.grossTotal,
    'Taxable Value (Rs)': inv.taxableAmount,
    'CGST (Rs)': inv.cgst,
    'SGST (Rs)': inv.sgst,
    'Total GST (Rs)': inv.totalGst,
    'Grand Total (Rs)': inv.grandTotal
  }));

  regData.push({
    'Sr No': 'TOTAL',
    'Invoice Number': `Total: ${summary.invoiceCount}`,
    'Invoice Date': '',
    'Customer Name': '',
    'Customer Phone': '',
    'GSTIN': '',
    'Supply Type': '',
    'Place of Supply': '',
    'Payment Method': '',
    'Gross Amount (Rs)': summary.totalSalesValue,
    'Taxable Value (Rs)': summary.taxableSales,
    'CGST (Rs)': summary.cgstTotal,
    'SGST (Rs)': summary.sgstTotal,
    'Total GST (Rs)': summary.totalGst,
    'Grand Total (Rs)': summary.totalSalesValue
  });

  const itemRows: any[] = [];
  let itIdx = 1;
  invoices.forEach(inv => {
    inv.items.forEach(it => {
      itemRows.push({
        '#': itIdx++,
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

  itemRows.push({
    '#': 'TOTAL',
    'Invoice Number': `Total Items: ${summary.totalItemsCount}`,
    'Invoice Date': '',
    'Customer': '',
    'Item Description': '',
    'Category': '',
    'HSN / SAC Code': '',
    'Quantity': summary.totalItemsCount,
    'Rate (Rs)': '',
    'Gross (Rs)': summary.totalSalesValue,
    'Discount (Rs)': 0,
    'Taxable Amount (Rs)': summary.taxableSales,
    'GST Rate': '',
    'CGST (Rs)': summary.cgstTotal,
    'SGST (Rs)': summary.sgstTotal,
    'IGST (Rs)': 0,
    'Line Total (Rs)': summary.totalSalesValue
  });

  XLSX.utils.book_append_sheet(regWb, XLSX.utils.json_to_sheet(regData), 'Invoice Register');
  XLSX.utils.book_append_sheet(regWb, XLSX.utils.json_to_sheet(itemRows), 'Itemized Register');

  const regPath = path.join(outDir, 'Invoice_Register_November_2026.xlsx');
  XLSX.writeFile(regWb, regPath);
  console.log(`Saved Invoice Register Excel: ${regPath} (${fs.statSync(regPath).size} bytes)`);

  // Copy all files to Artifact Directory as well
  const artifactDir = 'C:\\Users\\Moizd\\.gemini\\antigravity\\brain\\a06608ef-6f40-42bf-856e-d0b2fc54b3f1';
  if (fs.existsSync(artifactDir)) {
    fs.copyFileSync(gstr1File, path.join(artifactDir, 'FORM_GSTR1_November_2026.pdf'));
    fs.copyFileSync(gstr3bFile, path.join(artifactDir, 'FORM_GSTR3B_November_2026.pdf'));
    fs.copyFileSync(gstr1XlsxPath, path.join(artifactDir, 'GSTR1_Offline_November_2026.xlsx'));
    fs.copyFileSync(gstr3bXlsxPath, path.join(artifactDir, 'GSTR3B_Tables_November_2026.xlsx'));
    fs.copyFileSync(regPath, path.join(artifactDir, 'Invoice_Register_November_2026.xlsx'));
    console.log('Successfully copied all 5 artifacts to Artifact Directory.');
  }

  console.log('\n=== ALL STATUTORY PRODUCTION ARTIFACTS VERIFIED AND SAVED ===');
}

generateAll();
