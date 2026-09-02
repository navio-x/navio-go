/**
 * Kullanıcının sonradan eklediği EVM token'ları — zincir (chainId) başına
 * ayrı localStorage anahtarında tutulur, evm-networks.json'daki registry'e
 * dokunmaz. networkRegistry.js bu listeyi registry token'larıyla birleştirir.
 */

const STORAGE_PREFIX = "evmCustomTokens_";

function storageKey(chainId) {
  return `${STORAGE_PREFIX}${chainId}`;
}

export function getCustomTokens(chainId) {
  try {
    const raw = localStorage.getItem(storageKey(chainId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addCustomToken(chainId, token) {
  const tokens = getCustomTokens(chainId);
  const exists = tokens.some(
    (t) => t.address.toLowerCase() === token.address.toLowerCase()
  );
  const next = exists ? tokens : [...tokens, token];
  localStorage.setItem(storageKey(chainId), JSON.stringify(next));
  return next;
}

export function removeCustomToken(chainId, address) {
  const next = getCustomTokens(chainId).filter(
    (t) => t.address.toLowerCase() !== address.toLowerCase()
  );
  localStorage.setItem(storageKey(chainId), JSON.stringify(next));
  return next;
}
