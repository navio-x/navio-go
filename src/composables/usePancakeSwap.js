import { ref } from "vue";
import { createWalletClient, http } from "viem";
import { settings } from "@/stores/settings";
import { getActiveClient, activeRpcUrl, buildEvmChain } from "@/stores/evm";
import {
  getNetworkConfig,
  getRouterAddress,
  getWrappedNative,
  getBaseTokenAddresses,
} from "@/lib/evm/networkRegistry";
import { ERC20_READ_ABI } from "@/lib/evm/erc20Abi";
import { PANCAKE_ROUTER_ABI } from "@/lib/evm/pancakeRouterAbi";
import {
  findBestPath,
  estimatePriceImpactBps,
  readAssetBalance,
  hasEnoughNativeForGas,
  mapErrorCode,
} from "@/lib/evm/swapMath";
import { getEvmAccount } from "@/composables/useEvmAccount";

// Faz 1'in ERC20_READ_ABI'si kasıtlı olarak salt okunur tutuldu — approve/
// allowance yalnızca burada, swap'e özel olarak eklenir.
const ERC20_WRITE_ABI = [
  ...ERC20_READ_ABI,
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

const BUSY_STATES = ["approving", "approve_pending", "swapping", "swap_pending"];

// Modül kapsamında (singleton) tutulur — stores/evm.js ile aynı desen.
// DexView.vue her navigasyonda unmount/remount olabildiği (hash router tek
// route'u değiştirir) için bu state bir bileşen içinde yaşarsa, kullanıcı
// sayfadan ayrılıp geri döndüğünde veya uygulama arka plana alınıp
// döndüğünde "bekleyen işlem" durumu kaybolur. Modül kapsamında tutmak,
// swap zincire gönderildikten sonra receipt beklerken sayfa yeniden
// mount edilse bile aynı status/txHash'in görünmeye devam etmesini sağlar.
const status = ref("idle"); // idle | quoting | approving | approve_pending | swapping | swap_pending | success | error
const errorCode = ref("");
const quote = ref(null); // { path, amountOut, amountOutMin }
const priceImpactBps = ref(null);
const needsApproval = ref(false);
const txHash = ref(null);
const approveTxHash = ref(null);
const actualAmountOut = ref(null);

let _quoteTimer = null;

export function usePancakeSwap() {
  function reset() {
    status.value = "idle";
    errorCode.value = "";
    quote.value = null;
    priceImpactBps.value = null;
    needsApproval.value = false;
    txHash.value = null;
    approveTxHash.value = null;
    actualAmountOut.value = null;
  }

  /** Salt okunur önizleme — imzalama yok, sadece fiyat/rota/onay durumu. */
  async function refreshQuote({ chainId, owner, fromAsset, toAsset, amountInRaw }) {
    if (!fromAsset || !toAsset || fromAsset.key === toAsset.key || !amountInRaw || amountInRaw <= 0n) {
      quote.value = null;
      priceImpactBps.value = null;
      needsApproval.value = false;
      return;
    }

    const busy = BUSY_STATES.includes(status.value);
    if (!busy) status.value = "quoting";

    try {
      const network = getNetworkConfig(chainId);
      const client = getActiveClient();
      const routerAddress = getRouterAddress(chainId);
      if (!network || !client) throw new Error("network_unavailable");
      if (!routerAddress) throw new Error("router_unavailable");

      const fromAddr = fromAsset.isNative ? getWrappedNative(chainId) : fromAsset.address;
      const toAddr = toAsset.isNative ? getWrappedNative(chainId) : toAsset.address;
      const baseAddrs = getBaseTokenAddresses(chainId);

      const best = await findBestPath(client, routerAddress, fromAddr, toAddr, amountInRaw, baseAddrs);
      if (!best) throw new Error("no_liquidity");

      const amountOutMin = best.out - (best.out * BigInt(settings.slippageBps)) / 10000n;
      const impactBps = await estimatePriceImpactBps(client, routerAddress, best.path, amountInRaw, best.out);

      quote.value = { path: best.path, amountOut: best.out, amountOutMin };
      priceImpactBps.value = impactBps;

      if (!fromAsset.isNative && owner) {
        try {
          const allowance = await client.readContract({
            address: fromAsset.address,
            abi: ERC20_WRITE_ABI,
            functionName: "allowance",
            args: [owner, routerAddress],
          });
          needsApproval.value = allowance < amountInRaw;
        } catch {
          needsApproval.value = true; // Okunamazsa güvenli taraf: onay gerekli varsayılır.
        }
      } else {
        needsApproval.value = false;
      }

      if (!busy) status.value = "idle";
    } catch (e) {
      console.error("[pancakeswap] quote hatası:", e);
      quote.value = null;
      priceImpactBps.value = null;
      if (!busy) {
        status.value = "error";
        errorCode.value = mapErrorCode(e);
      }
    }
  }

  function startQuotePolling(getParams, intervalMs = 15_000) {
    stopQuotePolling();
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const params = getParams();
      if (params) refreshQuote(params);
    };
    tick();
    _quoteTimer = setInterval(tick, intervalMs);
  }

  function stopQuotePolling() {
    if (_quoteTimer) {
      clearInterval(_quoteTimer);
      _quoteTimer = null;
    }
  }

  /**
   * Tam swap akışı: quote -> (gerekirse) approve -> swap -> receipt bekle.
   * Router istismar edilirse tüm bakiye gitmesin diye approve tam miktar
   * için yapılır, maxUint256 kullanılmaz.
   */
  async function executeSwap({ chainId, fromAsset, toAsset, amountInRaw }) {
    errorCode.value = "";
    txHash.value = null;
    approveTxHash.value = null;
    actualAmountOut.value = null;

    try {
      const network = getNetworkConfig(chainId);
      const client = getActiveClient();
      const routerAddress = getRouterAddress(chainId);
      if (!network || !client) throw new Error("network_unavailable");
      if (!routerAddress) throw new Error("router_unavailable");

      const account = getEvmAccount();
      if (!account) throw new Error("wallet_locked");
      const owner = account.address;

      const fromAddr = fromAsset.isNative ? getWrappedNative(chainId) : fromAsset.address;
      const toAddr = toAsset.isNative ? getWrappedNative(chainId) : toAsset.address;
      const baseAddrs = getBaseTokenAddresses(chainId);

      status.value = "quoting";
      const best = await findBestPath(client, routerAddress, fromAddr, toAddr, amountInRaw, baseAddrs);
      if (!best) throw new Error("no_liquidity");

      const amountOutMin = best.out - (best.out * BigInt(settings.slippageBps)) / 10000n;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + settings.txDeadlineMin * 60);

      const rpcUrl = activeRpcUrl.value || network.rpc[0];
      const walletClient = createWalletClient({
        account,
        chain: buildEvmChain(network, rpcUrl),
        transport: http(rpcUrl),
      });

      // Onay adımı — yalnızca token girişi için. Kullanıcı iki ayrı imza
      // isteği görecek (approve + swap); bunu önceden UI'da bildiriyoruz.
      if (!fromAsset.isNative) {
        const allowance = await client.readContract({
          address: fromAsset.address,
          abi: ERC20_WRITE_ABI,
          functionName: "allowance",
          args: [owner, routerAddress],
        });

        if (allowance < amountInRaw) {
          status.value = "approving";

          const approveGas = await client
            .estimateContractGas({
              address: fromAsset.address,
              abi: ERC20_WRITE_ABI,
              functionName: "approve",
              args: [routerAddress, amountInRaw],
              account: owner,
            })
            .catch(() => null);

          if (approveGas && !(await hasEnoughNativeForGas(client, owner, approveGas, 0n))) {
            throw new Error("insufficient_gas");
          }

          const approveHash = await walletClient.writeContract({
            address: fromAsset.address,
            abi: ERC20_WRITE_ABI,
            functionName: "approve",
            args: [routerAddress, amountInRaw],
          });
          approveTxHash.value = approveHash;
          status.value = "approve_pending";

          const approveReceipt = await client.waitForTransactionReceipt({ hash: approveHash });
          if (approveReceipt.status !== "success") throw new Error("approve_failed");
        }
      }

      const feeOnTransfer = (!fromAsset.isNative && fromAsset.feeOnTransfer) || (!toAsset.isNative && toAsset.feeOnTransfer);

      let functionName;
      let args;
      let value = 0n;

      if (fromAsset.isNative) {
        functionName = feeOnTransfer ? "swapExactETHForTokensSupportingFeeOnTransferTokens" : "swapExactETHForTokens";
        args = [amountOutMin, best.path, owner, deadline];
        value = amountInRaw;
      } else if (toAsset.isNative) {
        functionName = feeOnTransfer ? "swapExactTokensForETHSupportingFeeOnTransferTokens" : "swapExactTokensForETH";
        args = [amountInRaw, amountOutMin, best.path, owner, deadline];
      } else {
        functionName = feeOnTransfer ? "swapExactTokensForTokensSupportingFeeOnTransferTokens" : "swapExactTokensForTokens";
        args = [amountInRaw, amountOutMin, best.path, owner, deadline];
      }

      status.value = "swapping";

      const swapGas = await client.estimateContractGas({
        address: routerAddress,
        abi: PANCAKE_ROUTER_ABI,
        functionName,
        args,
        account: owner,
        value,
      });

      if (!(await hasEnoughNativeForGas(client, owner, swapGas, value))) {
        throw new Error("insufficient_gas");
      }

      // Fee-on-transfer tarafında dönüş değeri olmadığından gerçek çıktıyı
      // işlem öncesi/sonrası bakiye farkından ölçüyoruz.
      const preBalance = feeOnTransfer ? await readAssetBalance(client, toAsset, owner) : null;

      const swapHash = await walletClient.writeContract({
        address: routerAddress,
        abi: PANCAKE_ROUTER_ABI,
        functionName,
        args,
        value,
      });
      txHash.value = swapHash;
      status.value = "swap_pending";

      const receipt = await client.waitForTransactionReceipt({ hash: swapHash });
      if (receipt.status !== "success") throw new Error("swap_reverted");

      actualAmountOut.value = feeOnTransfer
        ? (await readAssetBalance(client, toAsset, owner)) - preBalance
        : best.out;

      status.value = "success";
    } catch (e) {
      console.error("[pancakeswap] swap hatası:", e);
      status.value = "error";
      errorCode.value = mapErrorCode(e);
    }
  }

  return {
    status,
    errorCode,
    quote,
    priceImpactBps,
    needsApproval,
    txHash,
    approveTxHash,
    actualAmountOut,
    refreshQuote,
    startQuotePolling,
    stopQuotePolling,
    executeSwap,
    reset,
  };
}
