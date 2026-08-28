import { describe, it, expect } from "vitest";
import { buildCsvText, CSV_FIELD_ORDER } from "../exportCsv.js";

const HEADERS = ["Date", "Period", "Recipient", "Address", "Amount (NAV)", "Currency", "Fiat Amount", "Rate", "Rate Timestamp", "Transaction ID", "Status"];

const ROW = {
  date: "2026-08-27",
  periodLabel: "August 2026",
  recipientLabel: "Alice",
  recipientAddress: "tnv1qexampleaddress",
  amountNav: 1.5,
  currency: "USD",
  fiatAmount: 42,
  rate: 0.1234,
  rateTimestamp: 1700000000000,
  transactionId: "deadbeef",
  status: "sent",
};

describe("buildCsvText", () => {
  it("starts with a UTF-8 BOM", () => {
    const csv = buildCsvText([ROW], HEADERS);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("quotes every field, including the header row", () => {
    const csv = buildCsvText([ROW], HEADERS);
    const [headerLine] = csv.slice(1).split("\r\n");
    expect(headerLine).toBe(HEADERS.map((h) => `"${h}"`).join(","));
  });

  it("doubles internal quotes (RFC 4180)", () => {
    const csv = buildCsvText([{ ...ROW, recipientLabel: 'Bob "The Builder"' }], HEADERS);
    expect(csv).toContain('"Bob ""The Builder"""');
  });

  it("preserves non-ASCII recipient labels", () => {
    const csv = buildCsvText([{ ...ROW, recipientLabel: "Şeyhan Akdeniz" }], HEADERS);
    expect(csv).toContain("Şeyhan Akdeniz");
  });

  it.each(["=", "+", "-", "@"])("guards a field starting with '%s' against formula injection", (trigger) => {
    const csv = buildCsvText([{ ...ROW, recipientLabel: `${trigger}cmd|'/c calc'!A1` }], HEADERS);
    expect(csv).toContain(`"'${trigger}cmd|'/c calc'!A1"`);
  });

  it("does not guard a field that merely contains (not starts with) a trigger character", () => {
    const csv = buildCsvText([{ ...ROW, recipientLabel: "Jean-Luc" }], HEADERS);
    expect(csv).toContain('"Jean-Luc"');
  });

  it("formats amountNav and rate to fixed 8 decimals", () => {
    const csv = buildCsvText([ROW], HEADERS);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toContain('"1.50000000"');
    expect(dataLine).toContain('"0.12340000"');
  });

  it("formats fiatAmount to fixed 2 decimals", () => {
    const csv = buildCsvText([ROW], HEADERS);
    expect(csv.split("\r\n")[1]).toContain('"42.00"');
  });

  it("renders null fields as an empty quoted string", () => {
    const csv = buildCsvText([{ ...ROW, currency: null, fiatAmount: null, rate: null, rateTimestamp: null, transactionId: null }], HEADERS);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine.split(",").filter((f) => f === '""').length).toBeGreaterThanOrEqual(4);
  });

  it("ends every line with CRLF", () => {
    const csv = buildCsvText([ROW, ROW], HEADERS);
    expect(csv.match(/\r\n/g).length).toBe(3); // header + 2 rows
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("writes columns in the documented fixed order", () => {
    expect(CSV_FIELD_ORDER).toEqual([
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
    ]);
  });

  it("throws if headers length doesn't match the fixed field order", () => {
    expect(() => buildCsvText([ROW], ["Date"])).toThrow();
  });
});
