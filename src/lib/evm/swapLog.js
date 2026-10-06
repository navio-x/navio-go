// Swaps made from this app on an EVM network, kept on the device so the
// History screen can list them. There is no indexer behind the EVM side, so
// this is the only record the app has: it covers swaps done here, not
// transfers made elsewhere (the explorer link shows those).
const MAX_ENTRIES = 100;
const key = (address) => `evmSwapLog:${address.toLowerCase()}`;

/** [{ hash, chainId, time, from: { symbol, amount }, to: { symbol, amount } }], newest first. */
export function readSwapLog(address) {
  if (!address) return [];
  try {
    const list = JSON.parse(localStorage.getItem(key(address)) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function recordSwap(address, entry) {
  if (!address) return;
  try {
    const list = [entry, ...readSwapLog(address).filter((e) => e.hash !== entry.hash)].slice(0, MAX_ENTRIES);
    localStorage.setItem(key(address), JSON.stringify(list));
  } catch (e) {
    console.error("[evm] swap log write failed:", e);
  }
}
