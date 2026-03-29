import jsPDF from 'jspdf';
import { Sale } from './types';

function openPdfPreview(doc: jsPDF, fileName: string) {
  if (typeof window === 'undefined') {
    doc.save(fileName);
    return;
  }

  const blobUrl = doc.output('bloburl');
  const previewWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');

  // Fallback if popup is blocked by the browser.
  if (!previewWindow) {
    doc.save(fileName);
  }
}

export function generateReceipt(sale: Sale) {
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
  const w = 80;
  let y = 10;

  // Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('GOVI SEWANA', w / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Agro Solution', w / 2, y, { align: 'center' });
  y += 4;
  doc.text('Sri Lanka', w / 2, y, { align: 'center' });
  y += 6;

  // Divider
  doc.setLineWidth(0.3);
  doc.line(5, y, w - 5, y);
  y += 4;

  // Invoice info
  doc.setFontSize(8);
  doc.text(`Invoice: ${sale.invoiceNo}`, 5, y);
  y += 4;
  doc.text(`Date: ${new Date(sale.date).toLocaleDateString('en-LK')}`, 5, y);
  y += 4;
  doc.text(`Time: ${new Date(sale.date).toLocaleTimeString('en-LK')}`, 5, y);
  y += 4;
  if (sale.customerName) {
    doc.text(`Customer: ${sale.customerName}`, 5, y);
    y += 4;
  }
  doc.text(`Type: ${sale.saleType.toUpperCase()}`, 5, y);
  y += 4;
  doc.text(`Payment: ${sale.paymentMethod.toUpperCase()}`, 5, y);
  y += 5;

  // Divider
  doc.line(5, y, w - 5, y);
  y += 4;

  // Column headers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Item', 5, y);
  doc.text('Qty', 40, y, { align: 'center' });
  doc.text('Price', 55, y, { align: 'right' });
  doc.text('Total', w - 5, y, { align: 'right' });
  y += 4;
  doc.line(5, y, w - 5, y);
  y += 4;

  // Items
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  for (const item of sale.items) {
    const name = item.productName.length > 18
      ? item.productName.substring(0, 18) + '..'
      : item.productName;
    doc.text(name, 5, y);
    doc.text(String(item.qty), 40, y, { align: 'center' });
    doc.text(item.unitPrice.toFixed(2), 55, y, { align: 'right' });
    doc.text(item.total.toFixed(2), w - 5, y, { align: 'right' });
    y += 4;
  }

  y += 2;
  doc.line(5, y, w - 5, y);
  y += 4;

  // Summary
  doc.setFontSize(8);
  doc.text('Subtotal:', 5, y);
  doc.text(`LKR ${sale.subtotal.toFixed(2)}`, w - 5, y, { align: 'right' });
  y += 4;

  if (sale.discount > 0) {
    doc.text('Discount:', 5, y);
    doc.text(`-LKR ${sale.discount.toFixed(2)}`, w - 5, y, { align: 'right' });
    y += 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL:', 5, y);
  doc.text(`LKR ${sale.total.toFixed(2)}`, w - 5, y, { align: 'right' });
  y += 6;

  doc.line(5, y, w - 5, y);
  y += 5;

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Thank you for your purchase!', w / 2, y, { align: 'center' });
  y += 4;
  doc.text('Govi Sewana Agro Solution', w / 2, y, { align: 'center' });

  openPdfPreview(doc, `receipt-${sale.invoiceNo}.pdf`);
}

export function generateReport(data: {
  title: string;
  period: string;
  revenue: number;
  cost: number;
  profit: number;
  salesCount: number;
  adminSales: number;
  adminProfit: number;
  adminPerformance: Array<{ name: string; salesCount: number; profit: number }>;
}) {
  const doc = new jsPDF();
  let y = 20;

  const ensureSpace = (needed = 20) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 20;
    }
  };

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('GOVI SEWANA', 105, y, { align: 'center' });
  y += 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Agro Solution - Business Report', 105, y, { align: 'center' });
  y += 10;

  // Period
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.title, 105, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${data.period}`, 105, y, { align: 'center' });
  y += 12;

  // Divider
  doc.setLineWidth(0.5);
  doc.line(20, y, 190, y);
  y += 10;

  // Summary
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Financial Summary', 20, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Revenue:', 20, y);
  doc.text(`LKR ${data.revenue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 190, y, { align: 'right' });
  y += 7;
  doc.text('Total Cost:', 20, y);
  doc.text(`LKR ${data.cost.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 190, y, { align: 'right' });
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Net Profit:', 20, y);
  doc.text(`LKR ${data.profit.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 190, y, { align: 'right' });
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.text('Total Sales:', 20, y);
  doc.text(String(data.salesCount), 190, y, { align: 'right' });
  y += 7;
  doc.text('Admin Sales:', 20, y);
  doc.text(String(data.adminSales), 190, y, { align: 'right' });
  y += 7;
  doc.text('Admin Profit:', 20, y);
  doc.text(`LKR ${data.adminProfit.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`, 190, y, { align: 'right' });

  if (data.adminPerformance.length > 0) {
    y += 10;
    doc.setLineWidth(0.3);
    doc.line(20, y, 190, y);
    y += 8;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Admin Sales and Profit', 20, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Admin', 20, y);
    doc.text('Sales', 130, y, { align: 'right' });
    doc.text('Profit (LKR)', 190, y, { align: 'right' });
    y += 2;
    doc.line(20, y, 190, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    for (const admin of data.adminPerformance) {
      ensureSpace(8);
      doc.text(admin.name, 20, y);
      doc.text(String(admin.salesCount), 130, y, { align: 'right' });
      doc.text(admin.profit.toLocaleString('en-LK', { minimumFractionDigits: 2 }), 190, y, { align: 'right' });
      y += 6;
    }
  }

  y += 10;
  doc.setLineWidth(0.5);
  doc.line(20, y, 190, y);
  y += 8;

  // Footer
  doc.setFontSize(8);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-LK')} at ${new Date().toLocaleTimeString('en-LK')}`, 105, y, { align: 'center' });
  y += 5;
  doc.text('Govi Sewana Agro Solution - Confidential', 105, y, { align: 'center' });

  openPdfPreview(doc, `report-${data.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}
