import { HL_TOKENS } from "./config";
import { fetchSpotMeta } from "./api";

// spotMeta (token list + universe) is near-static — fetched once per session
// and shared across every caller (balances, order book, market resolution)
// rather than each one fetching its own copy.
let metaPromise = null;
export function getSpotMeta() {
  if (!metaPromise) {
    metaPromise = fetchSpotMeta().catch((e) => {
      metaPromise = null;
      throw e;
    });
  }
  return metaPromise;
}

/** Resolves each HL_TOKENS entry to its spotMeta token index + decimals. NAV is matched by tokenId, never by name. */
export function resolveTokens(meta) {
  return HL_TOKENS.map((cfg) => {
    const found = meta.tokens.find((tok) =>
      cfg.match.tokenId
        ? tok.tokenId?.toLowerCase() === cfg.match.tokenId.toLowerCase()
        : tok.name === cfg.match.name
    );
    return {
      symbol: cfg.symbol,
      index: found ? found.index : null,
      // sendAsset's "token" field: "<spotMeta name>:<tokenId>" (e.g. BTC is "UBTC:0x…").
      token: found ? `${found.name}:${found.tokenId}` : null,
      weiDecimals: found ? found.weiDecimals : 8,
      szDecimals: found ? found.szDecimals : 8,
    };
  });
}
