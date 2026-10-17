import { ref, computed } from "vue";
import { settings } from "@/stores/settings";

// The Navio network of the open wallet ("mainnet", "testnet", …), or "" while
// none is open. Seeded from the session so a reload keeps it; navio.js sets
// it whenever a wallet is created, loaded or restored.
export const walletNetwork = ref(sessionStorage.getItem("network") || "");

export function setWalletNetwork(network) {
  walletNetwork.value = network || "";
}

export const isMainnet = computed(() => walletNetwork.value === "mainnet");

/**
 * Hyperliquid — the NAV bridge (deposit/withdraw), the exchange balances,
 * swaps and NAV trading — exists only for Navio mainnet. Every Hyperliquid
 * screen and request is gated on this rather than on `settings.dexMode`
 * alone. The BSC DEX is unaffected: it has its own testnet.
 */
export const hlEnabled = computed(() => settings.dexMode && isMainnet.value);
