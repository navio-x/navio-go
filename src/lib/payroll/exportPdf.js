import { jsPDF } from "jspdf";
import { satToNavString, sumSatToNavString } from "./satAmount.js";

/**
 * Plain payment-report PDF: header, a row table, totals. Deliberately not
 * "designed" — this is an accounting document handed to a third party
 * (see exportWarning.js), so it favours a dense, readable table over any
 * visual styling.
 *
 * @param {Array<object>} rows - export rows, shaped like exportData.js's toRow()
 * @param {object} meta - { employerLabel, scopeLabel, generatedAt }
 * @param {object} labels - translated column/section labels (see PayrollExport.vue)
 * @returns {ArrayBuffer} PDF bytes
 */
export function buildPaymentReportPdf(rows, meta, labels) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const lineHeight = 16;
  let y = 50;

  doc.setFontSize(14);
  doc.text(meta.employerLabel || labels.noEmployerLabel, marginX, y);
  y += 20;
  doc.setFontSize(10);
  doc.text(meta.scopeLabel, marginX, y);
  y += 14;
  doc.text(`${labels.generated}: ${new Date(meta.generatedAt).toLocaleString()}`, marginX, y);
  y += 24;

  const columns = [
    { key: "date", label: labels.date, x: marginX, align: "left" },
    { key: "recipientLabel", label: labels.recipient, x: marginX + 65, align: "left" },
    { key: "amountNav", label: labels.amount, x: marginX + 220, align: "right" },
    { key: "currency", label: labels.currency, x: marginX + 250, align: "left" },
    { key: "fiatAmount", label: labels.fiatAmount, x: marginX + 320, align: "right" },
    { key: "status", label: labels.status, x: marginX + 360, align: "left" },
    { key: "transactionId", label: labels.txId, x: marginX + 410, align: "left" },
  ];
  const rightEdge = pageWidth - marginX;

  function drawRow(cells, { bold = false } = {}) {
    doc.setFont(undefined, bold ? "bold" : "normal");
    doc.setFontSize(8);
    for (const col of columns) {
      const text = cells[col.key] ?? "";
      const x = col.align === "right" ? col.x : col.x;
      doc.text(String(text), x, y, col.align === "right" ? { align: "right" } : undefined);
    }
  }

  function drawHeaderRow() {
    const headerCells = Object.fromEntries(columns.map((c) => [c.key, c.label]));
    drawRow(headerCells, { bold: true });
    y += 6;
    doc.setLineWidth(0.5);
    doc.line(marginX, y, rightEdge, y);
    y += lineHeight - 4;
  }

  drawHeaderRow();

  // BigInt-exact throughout — Number(amountSat)/1e8 would lose precision
  // above Number.MAX_SAFE_INTEGER and could silently disagree with the
  // same payment's signed receipt (see satAmount.js).
  const amountsSat = [];
  let totalFiat = 0;
  let fiatCurrency = null;
  let mixedCurrency = false;

  for (const row of rows) {
    if (y > pageHeight - 70) {
      doc.addPage();
      y = 50;
      drawHeaderRow();
    }
    drawRow({
      date: row.date,
      recipientLabel: truncate(row.recipientLabel, 26),
      amountNav: typeof row.amountNav === "string" ? row.amountNav : satToNavString(row.amountSat),
      currency: row.currency || "-",
      fiatAmount: row.fiatAmount != null ? Number(row.fiatAmount).toFixed(2) : "-",
      status: row.status,
      transactionId: truncate(row.transactionId || "-", 20),
    });
    y += lineHeight;

    amountsSat.push(row.amountSat);
    if (row.fiatAmount != null) {
      if (fiatCurrency && fiatCurrency !== row.currency) mixedCurrency = true;
      fiatCurrency = row.currency;
      totalFiat += Number(row.fiatAmount);
    }
  }

  y += 6;
  doc.setLineWidth(0.5);
  doc.line(marginX, y, rightEdge, y);
  y += lineHeight;

  doc.setFont(undefined, "bold");
  doc.setFontSize(9);
  doc.text(`${labels.total}: ${sumSatToNavString(amountsSat)} NAV`, marginX, y);
  if (fiatCurrency && !mixedCurrency) {
    doc.text(`${totalFiat.toFixed(2)} ${fiatCurrency}`, rightEdge, y, { align: "right" });
  }

  return doc.output("arraybuffer");
}

function truncate(text, maxLen) {
  const s = String(text ?? "");
  return s.length > maxLen ? s.slice(0, maxLen - 1) + "…" : s;
}
