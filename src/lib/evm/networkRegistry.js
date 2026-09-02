import { getAddress, isAddress } from "viem";
import rawNetworks from "@/config/evm-networks.json";
import { getCustomTokens } from "./customTokens";

export function getNetworkConfig(chainId) {
  return rawNetworks[String(chainId)] ?? null;
}

export function getAllNetworks() {
  return Object.values(rawNetworks);
}

function validateToken(token, chainId) {
  if (!token?.address || !isAddress(token.address)) {
    console.warn(
      `[evm] Geçersiz token adresi (chain ${chainId}, ${token?.symbol ?? "?"}), atlanıyor:`,
      token?.address
    );
    return null;
  }
  return { ...token, address: getAddress(token.address) };
}

/** Registry token'ları + kullanıcının eklediği özel token'lar, checksum doğrulamasından geçmiş halde. */
export function getNetworkTokens(chainId) {
  const network = getNetworkConfig(chainId);
  if (!network) return [];

  const registryTokens = (network.tokens || [])
    .map((t) => validateToken(t, chainId))
    .filter(Boolean);

  const registryAddrs = new Set(registryTokens.map((t) => t.address.toLowerCase()));

  const customTokens = getCustomTokens(chainId)
    .map((t) => validateToken({ ...t, custom: true }, chainId))
    .filter(Boolean)
    // Registry'de zaten olan bir adres varsa küratörlü kayıt kazanır.
    .filter((t) => !registryAddrs.has(t.address.toLowerCase()));

  return [...registryTokens, ...customTokens];
}

export function getWrappedNative(chainId) {
  const network = getNetworkConfig(chainId);
  if (!network || !isAddress(network.wrappedNative)) return null;
  return getAddress(network.wrappedNative);
}

export function getRouterAddress(chainId) {
  const network = getNetworkConfig(chainId);
  if (!network || !isAddress(network.router)) return null;
  return getAddress(network.router);
}

export function getBaseTokenAddresses(chainId) {
  const network = getNetworkConfig(chainId);
  if (!network) return [];
  const tokens = getNetworkTokens(chainId);
  return (network.baseTokens || [])
    .map((symbol) => tokens.find((t) => t.symbol === symbol))
    .filter(Boolean)
    .map((t) => t.address);
}
