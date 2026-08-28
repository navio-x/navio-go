/**
 * CSV builder for payroll exports. Unlike the payroll data store, these
 * files are handed to a third party (an accountant) in plain form by
 * design — see exportWarning.js for the one-time plaintext warning that
 * gates the UI before a first export.
 *
 * Excel-safety, per the spec:
 *  - UTF-8 with a leading BOM, so Excel doesn't mis-detect the encoding
 *    for non-ASCII recipient labels.
 *  - Every field quoted, internal quotes doubled (RFC 4180).
 *  - Formula-injection guard: any field whose text begins with =, +, -, or
 *    @ is prefixed with a single quote, so Excel/LibreOffice treat it as
 *    text rather than attempting to evaluate it as a formula. A recipient
 *    label or period label is free text a user typed in — this is the
 *    only realistic way one could start with those characters — but the
 *    guard is applied uniformly to every field, since a formatted numeric
 *    field starting with one of these characters would never legitimately
 *    happen in this domain (all payroll amounts/rates are non-negative).
 */

const BOM = "\uFEFF";
const FORMULA_TRIGGER_CHARS = ["=", "+", "-", "@"];

/** Fixed field order — must match the order `headers` is given in. */
export const CSV_FIELD_ORDER = [
  "date",
  "periodLabel",
  "recipientLabel",
  "recipientAddress",
  "amountNav",
  "currency",
  "fiatAmount",
  "rate",
  "rateTimestamp",
  "transactionId",
  "status",
];

function formatFieldValue(key, value) {
  if (value == null) return "";
  switch (key) {
    case "amountNav":
      // exportData.js already hands this in as a BigInt-exact decimal
      // string (see satAmount.js) — re-parsing it through Number() would
      // reintroduce the precision loss that string was built to avoid.
      // A plain number is still accepted here for direct/test callers.
      return typeof value === "string" ? value : Number(value).toFixed(8);
    case "rate":
      return Number(value).toFixed(8);
    case "fiatAmount":
      return Number(value).toFixed(2);
    case "rateTimestamp":
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
 * @param {Array<object>} rows - export rows, shaped like exportData.js's toRow()
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
