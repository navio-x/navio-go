import { HL_TOKENS } from "./config";
import { HYPERCORE_SYSTEM_ADDRESS, HYPE_SYSTEM_ADDRESS } from "./bridge/config";

const same = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();

/** Display symbol for a spotMeta token: the app's own symbol where it has one (UBTC -> BTC), else the token's name. */
function displaySymbol(token) {
  if (!token) return null;
  const known = HL_TOKENS.find((t) =>
    t.match.tokenId ? same(t.match.tokenId, token.tokenId) : t.match.name === token.name
  );
  return known ? known.symbol : token.name;
}

/** A ledger entry's token ("HYPE", or "NAV:0x…") as a display symbol. */
function ledgerSymbol(raw, meta) {
  const [name, tokenId] = String(raw || "").split(":");
  const token = meta?.tokens?.find((t) => (tokenId ? same(t.tokenId, tokenId) : t.name === name));
  return displaySymbol(token) ?? name;
}

/** { base, quote } for a fill's coin: "@<pair index>" / a pair name for spot, the bare coin for perps. */
function marketOf(coin, meta) {
  const pair = meta?.universe?.find((p) => `@${p.index}` === coin || p.name === coin);
  if (!pair) return { base: coin, quote: "USDC" };
  const token = (index) => meta.tokens.find((t) => t.index === index);
  return { base: displaySymbol(token(pair.tokens[0])) ?? coin, quote: displaySymbol(token(pair.tokens[1])) ?? "USDC" };
}

/**
 * One trade per order: an order that filled in several pieces is one row
 * (total size, average price), not one row per fill.
 */
function tradesFromFills(fills, meta) {
  const byOrder = new Map();
  for (const f of fills || []) {
    const key = f.oid ?? f.tid ?? `${f.hash}:${f.time}`;
    let row = byOrder.get(key);
    if (!row) {
      const { base, quote } = marketOf(f.coin, meta);
      row = { id: `hl-fill-${key}`, source: "hl", kind: "trade", side: f.side === "B" ? "buy" : "sell", base, quote, size: 0, value: 0, time: f.time, hash: f.hash };
      byOrder.set(key, row);
    }
    row.size += Number(f.sz);
    row.value += Number(f.sz) * Number(f.px);
    row.time = Math.max(row.time, f.time);
  }
  return [...byOrder.values()].map((r) => ({ ...r, price: r.size > 0 ? r.value / r.size : 0 }));
}

/** Deposits, withdrawals and transfers. Types this app has no wording for keep their own name as `label`. */
function transfersFromLedger(ledger, meta, address) {
  const rows = [];
  for (const entry of ledger || []) {
    const d = entry.delta || {};
    const base = { id: `hl-ledger-${entry.hash}-${entry.time}`, source: "hl", time: entry.time, hash: entry.hash };

    if (d.type === "deposit") {
      rows.push({ ...base, kind: "in", symbol: "USDC", amount: Number(d.usdc), via: "arbitrum" });
    } else if (d.type === "withdraw") {
      rows.push({ ...base, kind: "out", symbol: "USDC", amount: Number(d.usdc), via: "arbitrum" });
    } else if (d.type === "spotTransfer" || d.type === "send" || d.type === "internalTransfer") {
      const incoming = same(d.destination, address);
      const other = incoming ? d.user : d.destination;
      rows.push({
        ...base,
        kind: incoming ? "in" : "out",
        symbol: d.token ? ledgerSymbol(d.token, meta) : "USDC",
        amount: Number(d.amount ?? d.usdc),
        // The bridge's own addresses read better as what they are than as hex.
        via: same(other, HYPERCORE_SYSTEM_ADDRESS) ? "bridge" : same(other, HYPE_SYSTEM_ADDRESS) ? "gas" : null,
        counterparty: other,
      });
    } else if (d.type === "accountClassTransfer") {
      rows.push({ ...base, kind: "other", label: "accountClassTransfer", symbol: "USDC", amount: Number(d.usdc) });
    } else {
      const amount = Number(d.amount ?? d.usdc ?? d.netWithdrawnUsd);
      rows.push({
        ...base,
        kind: "other",
        label: d.type || "unknown",
        symbol: d.token ? ledgerSymbol(d.token, meta) : Number.isFinite(amount) ? "USDC" : null,
        amount: Number.isFinite(amount) ? amount : null,
      });
    }
  }
  return rows;
}

/**
 * The account's Hyperliquid activity as display rows, newest first:
 *  - { kind: "trade", side, base, quote, size, price, value }
 *  - { kind: "in" | "out", symbol, amount, via, counterparty }
 *  - { kind: "other", label, symbol, amount }
 * all with { id, source: "hl", time (ms), hash }.
 */
export function normalizeHlActivity({ fills, ledger, meta, address, limit = 100 }) {
  return [...tradesFromFills(fills, meta), ...transfersFromLedger(ledger, meta, address)]
    .sort((a, b) => b.time - a.time)
    .slice(0, limit);
}
