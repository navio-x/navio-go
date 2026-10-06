import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { HYPEREVM_CHAIN_ID, HYPEREVM_RPC_URL } from "./config";

// Same construction pattern as stores/evm.js's buildEvmChain, but for
// HyperEVM specifically — this bridge lives on a different chain than the
// BSC DEX card, so it gets its own client rather than reusing getActiveClient().
const hyperEvmChain = defineChain({
  id: HYPEREVM_CHAIN_ID,
  name: "HyperEVM",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: [HYPEREVM_RPC_URL] } },
});

let _publicClient = null;
export function getHyperEvmPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({ chain: hyperEvmChain, transport: http(HYPEREVM_RPC_URL) });
  }
  return _publicClient;
}

export function getHyperEvmWalletClient(account) {
  return createWalletClient({ account, chain: hyperEvmChain, transport: http(HYPEREVM_RPC_URL) });
}
