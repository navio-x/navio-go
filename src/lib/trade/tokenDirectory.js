/**
 * Network-wide token directory, sourced from the block explorer API — the
 * wallet has no other way to learn about a token it doesn't hold (see the
 * RFQ token-field: chips only show wallet holdings, but a taker needs to
 * name a buy token it has never touched).
 */
const API_BASE = "https://blocks.nav.io/api";

let cached = null; // { network, promise }

function currentNetwork() {
  return sessionStorage.getItem("network") === "mainnet" ? "mainnet" : "testnet";
}

function metaValue(metadata, key) {
  return metadata?.find((m) => m.key === key)?.value ?? null;
}

/** Fetch every fungible token known to the explorer for the active wallet's
 * network. Cached per network for the life of the page. */
export async function fetchNetworkTokens() {
  const network = currentNetwork();
  if (cached?.network === network) return cached.promise;

  const path = network === "mainnet" ? "/tokens?type=token" : "/testnet/tokens?type=token";
  const promise = fetch(`${API_BASE}${path}`)
    .then((res) => {
      if (!res.ok) throw new Error(`blocks.nav.io responded ${res.status}`);
      return res.json();
    })
    .then((body) =>
      (body?.data ?? []).map((t) => ({
        tokenId: t.token_id,
        name: metaValue(t.metadata, "name"),
        symbol: metaValue(t.metadata, "symbol"),
      }))
    )
    .catch((e) => {
      console.warn("fetchNetworkTokens failed:", e?.message || e);
      cached = null; // allow a retry on next call instead of caching the failure
      return [];
    });

  cached = { network, promise };
  return promise;
}
