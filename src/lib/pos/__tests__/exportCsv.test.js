import { describe, it, expect } from "vitest";
import { buildCsvText, CSV_FIELD_ORDER } from "../exportCsv.js";

const HEADERS = [
  "Created",
  "Settled",
  "Request ID",
  "Label",
  "Address",
  "Amount (NAV)",
  "Received (NAV)",
  "Currency",
  "Fiat Amount",
  "Rate",
  "Rate Timestamp",
  "Status",
  "Transaction ID",
];

const ROW = {
  createdAt: 1700000000000,
  settledAt: 1700000100000,
  id: "0102030405060708",
  label: "Cafe Luna",
  address: "tnv1qexampleaddress",
  amountNav: "1.50000000",
  receivedAmountNav: "1.50000000",
  currency: "USD",
  fiatAmount: "42.00",
  fiatRate: 0.1234,
  fiatRateTimestamp: 1700000000000,
  status: "paid",
  transactionId: "deadbeef",
};

describe("buildCsvText", () => {
  it("starts with a UTF-8 BOM", () => {
    const csv = buildCsvText([ROW], HEADERS);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("throws if headers length doesn't match CSV_FIELD_ORDER", () => {
    expect(() => buildCsvText([ROW], ["only one"])).toThrow();
    expect(HEADERS.length).toEqual(CSV_FIELD_ORDER.length);
  });

  it("quotes every field, including the header row", () => {
    const csv = buildCsvText([ROW], HEADERS);
    const [headerLine] = csv.slice(1).split("\r\n");
    expect(headerLine).toBe(HEADERS.map((h) => `"${h}"`).join(","));
  });

  it("doubles internal quotes (RFC 4180)", () => {
    const csv = buildCsvText([{ ...ROW, label: 'Bob "The Builder"' }], HEADERS);
    expect(csv).toContain('"Bob ""The Builder"""');
  });

  it("preserves non-ASCII merchant labels", () => {
    const csv = buildCsvText([{ ...ROW, label: "Şeyhan'ın Kafesi" }], HEADERS);
    expect(csv).toContain("Şeyhan'ın Kafesi");
  });

  it.each(["=", "+", "-", "@"])("guards a field starting with '%s' against formula injection", (trigger) => {
    const csv = buildCsvText([{ ...ROW, label: `${trigger}cmd|'/c calc'!A1` }], HEADERS);
    expect(csv).toContain(`"'${trigger}cmd|'/c calc'!A1"`);
  });

  it("does not guard a field that merely contains (not starts with) a trigger character", () => {
    const csv = buildCsvText([{ ...ROW, label: "Jean-Luc" }], HEADERS);
    expect(csv).toContain('"Jean-Luc"');
  });

  it("keeps amountNav/receivedAmountNav as-is when already a canonical string", () => {
    const csv = buildCsvText([ROW], HEADERS);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toContain('"1.50000000"');
  });

  it("formats fiatRate to fixed 8 decimals and fiatAmount to fixed 2", () => {
    const csv = buildCsvText([ROW], HEADERS);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toContain('"0.12340000"');
    expect(dataLine).toContain('"42.00"');
  });

  it("formats timestamps as ISO strings", () => {
    const csv = buildCsvText([ROW], HEADERS);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toContain(`"${new Date(1700000000000).toISOString()}"`);
  });

  it("renders null fields (e.g. an unsettled request) as empty", () => {
    const csv = buildCsvText([{ ...ROW, settledAt: null, transactionId: null }], HEADERS);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toContain('""');
  });
});
