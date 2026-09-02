import { formatUnits } from "viem";
import { findBestPath } from "./swapMath";

/**
 * BSC/EVM tarafında ayrı bir fiyat oracle'ımız yok. Bir token'ın yaklaşık
 * USD değerini, PancakeSwap router'ından 1 tam birimlik bir "prob" miktarın
 * bilinen bir stablecoin'e (USDT, yoksa BUSD) karşı anlık quote'unu alarak
 * türetiyoruz — estimatePriceImpactBps'teki prob yöntemiyle aynı mantık.
 *
 * Kasıtlı olarak kullanıcının elindeki gerçek bakiyeyi değil, sabit 1 birimi
 * quote ediyoruz: büyük bir bakiyeyi doğrudan quote etmek, o miktarın
 * havuzda yaratacağı fiyat kaymasını da değere karıştırır ve gerçek
 * "piyasa değeri × miktar" olması gereken sonucu düşük gösterir.
 *
 * Bu bir fiyat referansı değildir, yalnızca kaba bir tahmindir.
 */
export async function quoteTokenUsdPrice({
  client,
  routerAddress,
  tokenAddr,
  tokenDecimals,
  stableAddr,
  stableDecimals,
  baseAddrs,
}) {
  if (tokenAddr.toLowerCase() === stableAddr.toLowerCase()) return 1;

  const unitAmount = 10n ** BigInt(tokenDecimals);
  try {
    const best = await findBestPath(client, routerAddress, tokenAddr, stableAddr, unitAmount, baseAddrs);
    if (!best) return null;
    return Number(formatUnits(best.out, stableDecimals));
  } catch {
    return null;
  }
}
