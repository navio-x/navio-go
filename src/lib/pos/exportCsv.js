/**
 * CSV builder for merchant/POS exports. Mirrors src/lib/payroll/exportCsv.js's
 * Excel-safety technique exactly (BOM, RFC 4180 quoting, formula-injection
 * guard) — duplicated rather than imported since that module's field list is
 * payroll-specific and not reusable as-is; see merchantCrypto.js for the
 * general reason these small utilities are mirrored rather than shared.
 *
 * Same plaintext caveat as payroll's: these files are handed out for
 * end-of-shift reconciliation by design — see exportWarning.js for the
 * one-time acknowledgement gate the export UI shows first.
 */

const BOM = "\uFEFF";
const FORMULA_TRIGGER_CHARS = ["=", "+", "-", "@"];

/** Fixed field order — must match the order `headers` is given in. */
export const CSV_FIELD_ORDER = [
  "createdAt",
  "settledAt",
  "id",
  "label",
  "address",
  "amountNav",
  "receivedAmountNav",
  "currency",
  "fiatAmount",
  "fiatRate",
  "fiatRateTimestamp",
  "status",
  "transactionId",
];

function formatFieldValue(key, value) {
  if (value == null) return "";
  switch (key) {
    case "amountNav":
    case "receivedAmountNav":
      // Already a canonical decimal string from uriScheme.js/paymentWatch.js
      // in the normal case; Number(...).toFixed(8) covers a plain-number caller.
      return typeof value === "string" ? value : Number(value).toFixed(8);
    case "fiatRate":
      return Number(value).toFixed(8);
    case "fiatAmount":
      return typeof value === "string" ? value : Number(value).toFixed(2);
    case "createdAt":
    case "settledAt":
    case "fiatRateTimestamp":
      return new Date(value).toISOString();
    default:
      return String(value);
  }
}

function guardFormulaInjection(text) {
  return text.length && FORMULA_TRIGGER_CHARS.includes(text[0]) ? "'" + text : text;
}

function quoteCsvField(text) {
  return '"' + guardFormulaInjection(text).replace(/"/g, '""') + '"';
}

/**
 * @param {Array<object>} rows - request records, shaped like requests.js's createRequestRecord()
 * @param {string[]} headers - translated column headers, same length/order as CSV_FIELD_ORDER
 * @returns {string} CSV text, BOM-prefixed, CRLF line endings
 */
export function buildCsvText(rows, headers) {
  if (headers.length !== CSV_FIELD_ORDER.length) {
    throw new Error(`buildCsvText: expected ${CSV_FIELD_ORDER.length} headers, got ${headers.length}`);
  }
  const lines = [headers.map(quoteCsvField).join(",")];
  for (const row of rows) {
    lines.push(CSV_FIELD_ORDER.map((key) => quoteCsvField(formatFieldValue(key, row[key]))).join(","));
  }
  return BOM + lines.join("\r\n") + "\r\n";
}
