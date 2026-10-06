export const HL_API_URL = "https://api.hyperliquid.xyz/info";
export const HL_WS_URL = "wss://api.hyperliquid.xyz/ws";
export const HL_APP_URL = "https://app.hyperliquid.xyz";

// Every entry must resolve to a token index via spotMeta.tokens before it
// can be matched against a balances/universe response — see
// resolveTokens() in useHyperliquidBalances.js. NAV/BTC are matched by
// tokenId, never by name/symbol: symbols on Hyperliquid's permissionless
// spot market aren't unique, so anyone can list a token called "NAV" or
// "BTC". BTC's real spotMeta name is "UBTC" (Unit Bitcoin) — the tokenId is
// what pins it to the genuine one, not the display symbol here.
export const HL_TOKENS = [
  { symbol: "USDC", match: { name: "USDC" } },
  { symbol: "HYPE", match: { name: "HYPE" } },
  { symbol: "NAV", match: { tokenId: "0xa8bfa56c09c99e019950c37721162de2" } },
  { symbol: "BTC", match: { tokenId: "0x8f254b963e8468305d409b33aa137c67" } },
  // Unit-bridged majors (same issuer as UBTC; spotMeta names UETH/USOL/
  // UZEC/UAVAX). `optional`: only listed on balance screens when non-zero.
  { symbol: "ETH", match: { tokenId: "0xe1edd30daaf5caac3fe63569e24748da" }, optional: true },
  { symbol: "SOL", match: { tokenId: "0x49b67c39f5566535de22b29b0e51e685" }, optional: true },
  { symbol: "ZEC", match: { tokenId: "0x1c994ad3381d31c86c8c2d74ed89a365" }, optional: true },
  { symbol: "AVAX", match: { tokenId: "0x730fc3855fb77d2aa5a19dd7891dbe80" }, optional: true },
];

/** Hides optional HL_TOKENS rows with a zero balance. */
export function visibleHlBalances(rows) {
  return rows.filter((r) => !HL_TOKENS.find((t) => t.symbol === r.symbol)?.optional || Number(r.total) > 0);
}

/** Icon file (src/assets/tokens) per HL_TOKENS symbol. */
export const HL_LOGOS = {
  USDC: "usdc.png", HYPE: "hype.jpg", NAV: "wnav-light.svg", BTC: "btc.png",
  ETH: "eth.png", SOL: "sol.png", ZEC: "zec.png", AVAX: "avax.png",
};

/** Display name per HL_TOKENS symbol. NAV is just "Navio": where it is held is a detail, not a different asset. */
export const HL_NAMES = {
  NAV: "Navio", USDC: "USD Coin", HYPE: "Hyperliquid", BTC: "Bitcoin",
  ETH: "Ethereum", SOL: "Solana", ZEC: "Zcash", AVAX: "Avalanche",
};
