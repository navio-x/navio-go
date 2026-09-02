import { PANCAKE_ROUTER_ABI } from "./pancakeRouterAbi";
import { ERC20_READ_ABI } from "./erc20Abi";

/**
 * Saf mantık — Vue store'larına veya tarayıcı globallerine bağımlı değil,
 * bu yüzden usePancakeSwap.js'ten ayrı tutulur ve doğrudan test edilebilir
 * (bkz. __tests__/swapMath.test.js). `client` viem PublicClient'a duck-type
 * uyumlu herhangi bir nesne olabilir (testlerde mock'lanır).
 */

export async function findBestPath(client, routerAddress, fromAddr, toAddr, amountIn, baseAddrs) {
  const candidates = [[fromAddr, toAddr]];
  for (const base of baseAddrs) {
    if (base.toLowerCase() !== fromAddr.toLowerCase() && base.toLowerCase() !== toAddr.toLowerCase()) {
      candidates.push([fromAddr, base, toAddr]);
    }
  }

  let best = null;
  for (const path of candidates) {
    try {
      const amounts = await client.readContract({
        address: routerAddress,
        abi: PANCAKE_ROUTER_ABI,
        functionName: "getAmountsOut",
        args: [amountIn, path],
      });
      const out = amounts[amounts.length - 1];
      if (!best || out > best.out) best = { path, amounts, out };
    } catch {
      // Bu path revert etti (likidite yok) — sıradaki adaya geç.
    }
  }
  return best;
}

// getAmountsOut anlık rezervden hesaplanır, gerçek bir fiyat oracle'ı değildir.
// Fiyat etkisini, çok küçük bir "prob" miktarın (yaklaşık kaymasız marjinal
// fiyat) gerçek işlem miktarıyla karşılaştırarak kabaca tahmin ediyoruz.
export async function estimatePriceImpactBps(client, routerAddress, path, amountIn, amountOut) {
  const probeIn = amountIn / 1000n;
  if (probeIn <= 0n) return null;
  try {
    const probeAmounts = await client.readContract({
      address: routerAddress,
      abi: PANCAKE_ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [probeIn, path],
    });
    const probeOut = probeAmounts[probeAmounts.length - 1];
    if (probeOut <= 0n) return null;

    const SCALE = 10n ** 18n;
    const spotRate = (probeOut * SCALE) / probeIn;
    const execRate = (amountOut * SCALE) / amountIn;
    if (spotRate <= 0n) return null;

    const impactBps = Number(((spotRate - execRate) * 10000n) / spotRate);
    return impactBps < 0 ? 0 : impactBps;
  } catch {
    return null;
  }
}

export async function readAssetBalance(client, asset, owner) {
  if (asset.isNative) return client.getBalance({ address: owner });
  return client.readContract({
    address: asset.address,
    abi: ERC20_READ_ABI,
    functionName: "balanceOf",
    args: [owner],
  });
}

export async function hasEnoughNativeForGas(client, owner, gasUnits, valueSent) {
  try {
    const [balance, gasPrice] = await Promise.all([
      client.getBalance({ address: owner }),
      client.getGasPrice(),
    ]);
    // Tahmini gaz ücretine %20 pay bırakılır — estimateContractGas isabetli
    // olmayabilir.
    const buffer = (gasUnits * gasPrice * 120n) / 100n;
    return balance >= buffer + valueSent;
  } catch {
    return true; // Tahmin başarısızsa engelleme — writeContract zaten hata verecektir.
  }
}

export function mapErrorCode(e) {
  if (e?.message === "network_unavailable") return "network_unavailable";
  if (e?.message === "router_unavailable") return "router_unavailable";
  if (e?.message === "wallet_locked") return "wallet_locked";
  if (e?.message === "no_liquidity") return "no_liquidity";
  if (e?.message === "insufficient_gas") return "insufficient_gas";
  if (e?.message === "insufficient_balance") return "insufficient_balance";
  if (e?.message === "approve_failed") return "approve_failed";
  if (e?.message === "swap_reverted") return "swap_reverted";
  if (e?.name === "UserRejectedRequestError") return "user_rejected";

  const msg = String(e?.shortMessage || e?.details || e?.message || e || "").toUpperCase();
  if (msg.includes("USER REJECTED") || msg.includes("USERREJECTED")) return "user_rejected";
  if (msg.includes("INSUFFICIENT_OUTPUT_AMOUNT") || msg.includes("INSUFFICIENT_INPUT_AMOUNT")) return "insufficient_output";
  if (msg.includes("TRANSFER_FROM_FAILED") || msg.includes("TRANSFERHELPER")) return "transfer_from_failed";
  if (msg.includes("INSUFFICIENT_LIQUIDITY") || msg.includes("INSUFFICIENT_A_AMOUNT") || msg.includes("INSUFFICIENT_B_AMOUNT")) return "insufficient_liquidity";
  if (msg.includes("EXPIRED")) return "expired";
  if (msg.includes("INSUFFICIENT FUNDS")) return "insufficient_gas";
  return "unknown";
}
