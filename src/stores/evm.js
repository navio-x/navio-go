import { ref, watch } from "vue";
import { createPublicClient, http, defineChain, formatUnits, getAddress, isAddress } from "viem";
import { settings } from "@/stores/settings";
import { getNetworkConfig, getNetworkTokens } from "@/lib/evm/networkRegistry";
import { ERC20_READ_ABI } from "@/lib/evm/erc20Abi";

// Neredeyse tüm EVM zincirlerinde (BSC mainnet/testnet dahil) aynı
// deterministik adreste deploy edilmiştir — bu, ağa özgü bir yapılandırma
// değil altyapısal bir sabit olduğu için evm-networks.json'a değil buraya
// konur.
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

export const evmAddress = ref("");
export const evmStatus = ref("idle"); // idle | loading | error
export const nativeBalance = ref(null); // { raw: bigint, formatted: string } | null
export const tokenBalanceList = ref([]); // [{ ...token, balance: bigint, formatted: string }]
export const rpcIndex = ref(0);
export const rpcStale = ref(false);
export const activeRpcUrl = ref("");

let _client = null;
let _clientChainId = null;
let _clientRpcUrl = null;

// Okuma client'ı ile Faz 2'nin yazma (wallet) client'ının aynı ağ/RPC
// tanımını paylaşması için dışa açık — usePancakeSwap.js bunu import eder.
export function buildEvmChain(network, rpcUrl) {
  return defineChain({
    id: network.chainId,
    name: network.name,
    nativeCurrency: {
      name: network.nativeSymbol,
      symbol: network.nativeSymbol,
      decimals: network.nativeDecimals,
    },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: network.explorer
      ? { default: { name: network.shortName, url: network.explorer } }
      : undefined,
    contracts: { multicall3: { address: MULTICALL3_ADDRESS } },
  });
}

function buildClient(network, rpcUrl) {
  return createPublicClient({ chain: buildEvmChain(network, rpcUrl), transport: http(rpcUrl) });
}

function getClient(network) {
  const rpcUrl = network.rpc[rpcIndex.value % network.rpc.length];
  if (_client && _clientChainId === network.chainId && _clientRpcUrl === rpcUrl) {
    return _client;
  }
  _client = buildClient(network, rpcUrl);
  _clientChainId = network.chainId;
  _clientRpcUrl = rpcUrl;
  activeRpcUrl.value = rpcUrl;
  return _client;
}

export function setEvmAddress(address) {
  evmAddress.value = address;
}

/** dexMode kapalıyken hiç çağrılmamalı — Settings.vue ve DexView.vue bunu garanti eder. */
export function getActiveClient() {
  if (!settings.dexMode) return null;
  const network = getNetworkConfig(settings.evmNetwork);
  if (!network) return null;
  return getClient(network);
}

export async function readTokenMetadata(address) {
  if (!isAddress(address)) throw new Error("invalid_address");
  const checksummed = getAddress(address);
  const client = getActiveClient();
  if (!client) throw new Error("network_unavailable");

  const [symbol, decimals] = await Promise.all([
    client.readContract({ address: checksummed, abi: ERC20_READ_ABI, functionName: "symbol" }),
    client.readContract({ address: checksummed, abi: ERC20_READ_ABI, functionName: "decimals" }),
  ]);

  let name = symbol;
  try {
    name = await client.readContract({ address: checksummed, abi: ERC20_READ_ABI, functionName: "name" });
  } catch {
    // name() opsiyonel — bazı tokenlarda yok, symbol ile devam edilir.
  }

  return { address: checksummed, symbol, decimals, name };
}

export async function refreshBalances() {
  if (!settings.dexMode || !evmAddress.value) return;
  const network = getNetworkConfig(settings.evmNetwork);
  if (!network) return;

  const tokens = getNetworkTokens(settings.evmNetwork);
  evmStatus.value = evmStatus.value === "idle" ? "loading" : evmStatus.value;

  const attempts = network.rpc.length;
  let lastError = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const client = getClient(network);

      // Token başına ayrı readContract yerine tek RPC turunda multicall;
      // native bakiye ERC20 çağrısı olmadığından ayrı ama eşzamanlı okunur.
      const [native, results] = await Promise.all([
        client.getBalance({ address: evmAddress.value }),
        tokens.length
          ? client.multicall({
              contracts: tokens.map((t) => ({
                address: t.address,
                abi: ERC20_READ_ABI,
                functionName: "balanceOf",
                args: [evmAddress.value],
              })),
            })
          : Promise.resolve([]),
      ]);

      nativeBalance.value = {
        raw: native,
        formatted: formatUnits(native, network.nativeDecimals),
      };

      tokenBalanceList.value = tokens.map((t, idx) => {
        const r = results[idx];
        const raw = r?.status === "success" ? r.result : 0n;
        return { ...t, balance: raw, formatted: formatUnits(raw, t.decimals) };
      });

      evmStatus.value = "idle";
      rpcStale.value = false;
      return;
    } catch (e) {
      lastError = e;
      console.error("[evm] RPC hatası, sıradaki uca geçiliyor:", activeRpcUrl.value, e);
      rpcIndex.value = (rpcIndex.value + 1) % network.rpc.length;
      _client = null; // sıradaki RPC ile yeniden kur
    }
  }

  console.error("[evm] Tüm RPC uçları başarısız oldu:", lastError);
  evmStatus.value = "error";
  rpcStale.value = true;
}

let _pollTimer = null;
let _visibilityHandler = null;

export function startBalancePolling(intervalMs = 30_000) {
  stopBalancePolling();
  refreshBalances();
  _pollTimer = setInterval(() => {
    if (document.visibilityState === "visible") refreshBalances();
  }, intervalMs);
  _visibilityHandler = () => {
    if (document.visibilityState === "visible") refreshBalances();
  };
  document.addEventListener("visibilitychange", _visibilityHandler);
}

export function stopBalancePolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
  if (_visibilityHandler) {
    document.removeEventListener("visibilitychange", _visibilityHandler);
    _visibilityHandler = null;
  }
}

export function resetEvmStore() {
  stopBalancePolling();
  evmAddress.value = "";
  evmStatus.value = "idle";
  nativeBalance.value = null;
  tokenBalanceList.value = [];
  rpcIndex.value = 0;
  rpcStale.value = false;
  activeRpcUrl.value = "";
  _client = null;
  _clientChainId = null;
  _clientRpcUrl = null;
}

// dexMode kapatıldığında hiçbir RPC çağrısı kalmasın diye store tamamen
// sıfırlanır (bakiyeler, cache'lenmiş client).
watch(
  () => settings.dexMode,
  (enabled) => {
    if (!enabled) resetEvmStore();
  }
);

// Ağ (mainnet/testnet) değişince adres aynı kalır ama client ve bakiyeler
// yeniden okunmalı.
watch(
  () => settings.evmNetwork,
  () => {
    _client = null;
    rpcIndex.value = 0;
    if (settings.dexMode && evmAddress.value) refreshBalances();
  }
);
