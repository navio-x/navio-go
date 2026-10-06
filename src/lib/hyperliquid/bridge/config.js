// Navio ↔ Hyperliquid custodial bridge — verified mainnet parameters. There is
// no bridge API: everything here is either a HyperEVM contract call or a
// HyperCore action; a watchtower is what actually watches both chains.
export const BRIDGE_CONTRACT_ADDRESS = "0x4d21e561c54302a4e6646fa9051aae68960d10fe";
export const HYPERCORE_TOKEN_INDEX = 1022;
export const HYPERCORE_SPOT_COIN = "@868";
export const HYPERCORE_SYSTEM_ADDRESS = "0x20000000000000000000000000000000000003fe";
export const NAV_DECIMALS = 8; // both HyperCore and HyperEVM — no evmExtraWeiDecimals scaling
export const NAV_TOKEN_ID = "0xa8bfa56c09c99e019950c37721162de2"; // spotSend's "token" field is "NAV:<tokenId>"

// HYPE's HyperCore token and its Core -> HyperEVM system address: a spot
// transfer of HYPE to this address credits the sender's own EVM address with
// native HYPE (gas for register()/burnWithNote()).
export const HYPE_TOKEN = "HYPE:0x0d01dc56dcaaca66ad901c959b4011ec";
export const HYPE_SYSTEM_ADDRESS = "0x2222222222222222222222222222222222222222";

export const HYPEREVM_CHAIN_ID = 999;
export const HYPEREVM_RPC_URL = "https://rpc.hyperliquid.xyz/evm";

// Public keys — never secret, but bind deposit-address derivation (SPEC 1)
// and withdrawal-note encryption (SPEC 2) to the bridge's actual watchtower.
export const BRIDGE_AUDIT_KEY_HEX =
  "34bda030870ca15fece2be37b606de95500a9852ad9f6edc1e5217cd7644fd759200faa05208e323d614e64c12791b18f01818ed0a7010335adc7fb1afb5c8047591812443045568c6fc1f9b2f7acca8";
export const BRIDGE_NOTE_PUBLIC_KEY_HEX =
  "8b3b2099054196ec98daafec1a528532d66e59b120a310378ea7c4578acd4c7f9bf42cdeb4ae81ef38425c67737cf14a";

// Confirmation ladder (Navio blocks, ~120s each) credited on HyperCore by deposit size.
export const CONFIRMATION_LADDER = [
  { belowNav: 1_000, confirmations: 3 },
  { belowNav: 10_000, confirmations: 6 },
  { belowNav: 100_000, confirmations: 24 },
  { belowNav: Infinity, confirmations: 48 },
];

export function confirmationsForAmount(navAmount) {
  const tier = CONFIRMATION_LADDER.find((t) => navAmount < t.belowNav);
  return tier ? tier.confirmations : 48;
}
