import { getSpotMeta } from "./meta";

/**
 * Resolves a Hyperliquid spot market from spotMeta at runtime — the pair
 * index is assigned by Hyperliquid and must never be hardcoded. The base
 * token is matched by tokenId, never by name (symbols on Hyperliquid's
 * permissionless spot market aren't unique — anyone can list a token called
 * "BTC"). USDC is always spot token index 0.
 */
async function resolveSpotMarket(baseTokenId, quoteIndex = 0) {
  const meta = await getSpotMeta();
  const baseTok = meta.tokens.find((t) => t.tokenId?.toLowerCase() === baseTokenId.toLowerCase());
  if (!baseTok) return null;

  const pair = meta.universe.find(
    (p) => Array.isArray(p.tokens) && p.tokens[0] === baseTok.index && p.tokens[1] === quoteIndex
  );
  if (!pair) return null;

  return {
    coin: `@${pair.index}`,
    pairIndex: pair.index,
    pairName: pair.name,
    // The token's real spotMeta name (e.g. "UBTC" for the market shown as
    // BTC) — what app.hyperliquid.xyz uses in its /trade/<base>/<quote> URLs.
    baseTokenName: baseTok.name,
    baseSzDecimals: baseTok.szDecimals,
  };
}

export async function resolveNavUsdcMarket() {
  // NAV spot token, matched by tokenId — see HL_TOKENS in config.js.
  const m = await resolveSpotMarket("0xa8bfa56c09c99e019950c37721162de2");
  return m && { ...m, baseSymbol: "NAV", quoteSymbol: "USDC" };
}

export async function resolveBtcUsdcMarket() {
  // Hyperliquid's "BTC" spot market is actually UBTC (Unit Bitcoin) under
  // the hood — app.hyperliquid.xyz shows it as BTC/USDC, but the token name
  // in spotMeta is "UBTC". Matched by tokenId, same reasoning as NAV.
  const m = await resolveSpotMarket("0x8f254b963e8468305d409b33aa137c67");
  return m && { ...m, baseSymbol: "BTC", quoteSymbol: "USDC" };
}

export async function resolveHypeUsdcMarket() {
  // HYPE matched by tokenId, same reasoning as NAV/BTC.
  const m = await resolveSpotMarket("0x0d01dc56dcaaca66ad901c959b4011ec");
  return m && { ...m, baseSymbol: "HYPE", quoteSymbol: "USDC" };
}

/** Resolver for a <base>/USDC market whose base is pinned by tokenId. */
function usdcMarket(baseSymbol, baseTokenId) {
  return async () => {
    const m = await resolveSpotMarket(baseTokenId);
    return m && { ...m, baseSymbol, quoteSymbol: "USDC" };
  };
}

/**
 * Every Hyperliquid spot market the app has a screen for, keyed by the
 * /market/hl/:pair route segment. `logo` is a file in src/assets/tokens
 * (see TokenIcon.vue). Only well-known, liquid issuers belong here: the
 * Unit-bridged majors below share UBTC's issuer. Bases must also be in
 * config.js's HL_TOKENS (balances / sell max on the market screen).
 */
export const HL_SPOT_MARKETS = {
  "NAV-USDC": { base: "NAV", quote: "USDC", name: "Wrapped Navio", logo: "wnav-light.svg", resolver: resolveNavUsdcMarket },
  "BTC-USDC": { base: "BTC", quote: "USDC", name: "Bitcoin", logo: "btc.png", resolver: resolveBtcUsdcMarket },
  "HYPE-USDC": { base: "HYPE", quote: "USDC", name: "Hyperliquid", logo: "hype.jpg", resolver: resolveHypeUsdcMarket },
  "ETH-USDC": { base: "ETH", quote: "USDC", name: "Ethereum", logo: "eth.png", resolver: usdcMarket("ETH", "0xe1edd30daaf5caac3fe63569e24748da") },
  "SOL-USDC": { base: "SOL", quote: "USDC", name: "Solana", logo: "sol.png", resolver: usdcMarket("SOL", "0x49b67c39f5566535de22b29b0e51e685") },
  "ZEC-USDC": { base: "ZEC", quote: "USDC", name: "Zcash", logo: "zec.png", resolver: usdcMarket("ZEC", "0x1c994ad3381d31c86c8c2d74ed89a365") },
  "AVAX-USDC": { base: "AVAX", quote: "USDC", name: "Avalanche", logo: "avax.png", resolver: usdcMarket("AVAX", "0x730fc3855fb77d2aa5a19dd7891dbe80") },
};
