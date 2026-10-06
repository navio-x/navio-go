import { describe, it, expect } from "vitest";
import { normalizeHlActivity } from "../history";

const ME = "0x24acc1e0000000000000000000000000000000aa";
const meta = {
  tokens: [
    { name: "USDC", index: 0, tokenId: "0x6d1e7cde53ba9467b783cb7c530ce054" },
    { name: "HYPE", index: 150, tokenId: "0x0d01dc56dcaaca66ad901c959b4011ec" },
    { name: "NAV", index: 1022, tokenId: "0xa8bfa56c09c99e019950c37721162de2" },
    { name: "UBTC", index: 197, tokenId: "0x8f254b963e8468305d409b33aa137c67" },
  ],
  universe: [
    { name: "@107", index: 107, tokens: [150, 0] },
    { name: "@868", index: 868, tokens: [1022, 0] },
    { name: "@142", index: 142, tokens: [197, 0] },
  ],
};

describe("normalizeHlActivity", () => {
  it("turns the fills of one order into one trade at the average price", () => {
    const fills = [
      { coin: "@868", side: "A", px: "0.05", sz: "100", time: 1000, oid: 7, hash: "0xa" },
      { coin: "@868", side: "A", px: "0.04", sz: "300", time: 1200, oid: 7, hash: "0xa" },
      { coin: "@142", side: "B", px: "60000", sz: "0.001", time: 900, oid: 8, hash: "0xb" },
    ];
    const [nav, btc] = normalizeHlActivity({ fills, ledger: [], meta, address: ME });
    expect(nav).toMatchObject({ kind: "trade", side: "sell", base: "NAV", quote: "USDC", size: 400, time: 1200 });
    expect(nav.value).toBeCloseTo(17, 10);
    expect(nav.price).toBeCloseTo(0.0425, 10);
    // UBTC is shown under the app's own symbol.
    expect(btc).toMatchObject({ side: "buy", base: "BTC", size: 0.001 });
  });

  it("keeps a perp fill's coin as it is", () => {
    const [row] = normalizeHlActivity({ fills: [{ coin: "ETH", side: "B", px: "2700", sz: "1", time: 1, oid: 1 }], ledger: [], meta, address: ME });
    expect(row).toMatchObject({ base: "ETH", quote: "USDC" });
  });

  it("reads transfer direction from the destination", () => {
    const ledger = [
      { time: 1, hash: "0x1", delta: { type: "spotTransfer", token: "HYPE", amount: "1.0", user: "0xother", destination: ME } },
      { time: 2, hash: "0x2", delta: { type: "send", token: "USDC", amount: "8.8", user: ME, destination: "0xother" } },
      { time: 3, hash: "0x3", delta: { type: "internalTransfer", usdc: "9.86", user: "0xother", destination: ME } },
    ];
    const rows = normalizeHlActivity({ fills: [], ledger, meta, address: ME.toUpperCase().replace("0X", "0x") });
    expect(rows.map((r) => [r.kind, r.symbol, r.amount])).toEqual([
      ["in", "USDC", 9.86],
      ["out", "USDC", 8.8],
      ["in", "HYPE", 1],
    ]);
    expect(rows[1].counterparty).toBe("0xother");
  });

  it("names the bridge and gas moves instead of showing their addresses", () => {
    const ledger = [
      { time: 1, hash: "0x1", delta: { type: "send", token: "NAV:0xa8bfa56c09c99e019950c37721162de2", amount: "50", user: ME, destination: "0x20000000000000000000000000000000000003fe" } },
      { time: 2, hash: "0x2", delta: { type: "send", token: "HYPE", amount: "0.01", user: ME, destination: "0x2222222222222222222222222222222222222222" } },
      { time: 3, hash: "0x3", delta: { type: "spotTransfer", token: "NAV", amount: "70", user: "0x20000000000000000000000000000000000003fe", destination: ME } },
    ];
    const rows = normalizeHlActivity({ fills: [], ledger, meta, address: ME });
    expect(rows.map((r) => [r.kind, r.symbol, r.via])).toEqual([
      ["in", "NAV", "bridge"],
      ["out", "HYPE", "gas"],
      ["out", "NAV", "bridge"],
    ]);
  });

  it("covers Arbitrum deposits/withdrawals and keeps unknown types by name", () => {
    const ledger = [
      { time: 1, hash: "0x1", delta: { type: "deposit", usdc: "5.0" } },
      { time: 2, hash: "0x2", delta: { type: "withdraw", usdc: "999.0", fee: "1.0" } },
      { time: 3, hash: "0x3", delta: { type: "accountClassTransfer", usdc: "5.0", toPerp: false } },
      { time: 4, hash: "0x4", delta: { type: "cStakingTransfer", token: "HYPE", amount: "0.7", isDeposit: true } },
      { time: 5, hash: "0x5", delta: { type: "somethingNew" } },
    ];
    const rows = normalizeHlActivity({ fills: [], ledger, meta, address: ME });
    expect(rows.map((r) => [r.kind, r.label ?? r.via, r.symbol, r.amount])).toEqual([
      ["other", "somethingNew", null, null],
      ["other", "cStakingTransfer", "HYPE", 0.7],
      ["other", "accountClassTransfer", "USDC", 5],
      ["out", "arbitrum", "USDC", 999],
      ["in", "arbitrum", "USDC", 5],
    ]);
  });

  it("sorts newest first across both sources and applies the limit", () => {
    const fills = [{ coin: "@107", side: "B", px: "90", sz: "1", time: 50, oid: 1 }];
    const ledger = [
      { time: 10, hash: "0x1", delta: { type: "deposit", usdc: "5" } },
      { time: 90, hash: "0x2", delta: { type: "deposit", usdc: "6" } },
    ];
    const rows = normalizeHlActivity({ fills, ledger, meta, address: ME, limit: 2 });
    expect(rows.map((r) => r.time)).toEqual([90, 50]);
  });
});
