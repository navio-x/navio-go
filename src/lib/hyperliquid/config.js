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

export const HL_EXPLORER_URL = "https://app.hyperliquid.xyz/explorer";
export const HYPURRSCAN_URL = "https://hypurrscan.io";
export const HYPURRSCAN_API_URL = "https://api.hypurrscan.io";

/**
 * Off-exchange facts per HL_TOKENS symbol for the token details screen:
 * the project's own links, and who issues the token on Hyperliquid. The
 * Unit-bridged majors are minted by Unit (hyperunit.xyz) against the real
 * coin; NAV is minted by the Navio–Hyperliquid bridge. Keep to official
 * sources only — a wrong link here points people at a scam.
 */
export const UNIT_URL = "https://hyperunit.xyz";
export const HL_TOKEN_LINKS = {
  NAV: { website: "https://nav.io", docs: "https://docs.nav.io", github: "https://github.com/nav-io", explorer: "https://blocks.nav.io", issuer: "bridge" },
  HYPE: { website: "https://hyperliquid.xyz", x: "https://x.com/HyperliquidX", docs: "https://hyperliquid.gitbook.io/hyperliquid-docs", github: "https://github.com/hyperliquid-dex" },
  BTC: { website: "https://bitcoin.org", github: "https://github.com/bitcoin/bitcoin", issuer: "unit" },
  ETH: { website: "https://ethereum.org", x: "https://x.com/ethereum", github: "https://github.com/ethereum", issuer: "unit" },
  SOL: { website: "https://solana.com", x: "https://x.com/solana", github: "https://github.com/solana-labs", issuer: "unit" },
  ZEC: { website: "https://z.cash", x: "https://x.com/zcash", github: "https://github.com/zcash/zcash", issuer: "unit" },
  AVAX: { website: "https://avax.network", x: "https://x.com/avax", github: "https://github.com/ava-labs", issuer: "unit" },
};

/**
 * The native chain behind each HL_TOKENS symbol, for the "About" card on
 * the token details screen. Only layer-1 coins get an entry (`layer1`);
 * the intro and feature texts live in the locales under
 * market.token.about.<SYMBOL>, and `features` lists which of them to show,
 * in order. `blockTimeSec` and `supplyCap` are the native chain's own
 * (not the Hyperliquid token's): omit one to hide its row, `supplyCap:
 * null` means uncapped. Facts were checked against each project's docs in
 * November 2026 — recheck after a network upgrade (Zcash's 25 s blocks
 * are NU7's).
 */
export const HL_TOKEN_ABOUT = {
  NAV: { layer1: true, launched: 2026, consensus: "Proof of Private Stake", blockTimeSec: 120, supplyCap: null, features: ["privacy", "staking", "tokens", "burn"] },
  BTC: { layer1: true, launched: 2009, consensus: "Proof of Work · SHA-256", blockTimeSec: 600, supplyCap: 21_000_000, features: ["scarcity", "security", "permissionless", "layers"] },
  ETH: { layer1: true, launched: 2015, consensus: "Proof of Stake", blockTimeSec: 12, supplyCap: null, features: ["contracts", "staking", "burn", "layer2"] },
  SOL: { layer1: true, launched: 2020, consensus: "Proof of Stake", blockTimeSec: 0.4, supplyCap: null, features: ["speed", "fees", "staking", "ecosystem"] },
  ZEC: { layer1: true, launched: 2016, consensus: "Proof of Work · Equihash", blockTimeSec: 25, supplyCap: 21_000_000, features: ["shielded", "disclosure", "scarcity", "mining"] },
  AVAX: { layer1: true, launched: 2020, consensus: "Proof of Stake · Snowman", supplyCap: 720_000_000, features: ["finality", "evm", "l1s", "tokenomics"] },
  HYPE: { layer1: true, launched: 2023, consensus: "Proof of Stake · HyperBFT", features: ["orderbook", "consensus", "evm", "buyback"] },
};
