import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import { HYPERCORE_SYSTEM_ADDRESS, NAV_TOKEN_ID, HYPE_SYSTEM_ADDRESS, HYPE_TOKEN } from "./bridge/config";

// Hand-rolling Hyperliquid's L1 action signing (msgpack action hash + a
// "phantom agent" EIP-712 wrapper) is exactly what their own docs warn
// against — a subtly wrong signature either gets silently rejected or,
// worse, could be misinterpreted. This wraps their SDK instead, which signs
// with the same viem account already used for BSC swaps (getEvmAccount());
// no new key material.
let _client = null;
let _clientAddress = null;

function getExchangeClient(account) {
  if (_client && _clientAddress === account.address) return _client;
  _client = new ExchangeClient({ transport: new HttpTransport(), wallet: account });
  _clientAddress = account.address;
  return _client;
}

/**
 * Places a single spot order. `assetIndex` is the market's pairIndex from
 * lib/hyperliquid/market.js — the SDK/API's own asset id is `10000 + pairIndex`
 * for spot (see resolveOrderAsset below), never the base token's own index.
 */
export async function placeSpotOrder(account, { pairIndex, isBuy, price, size, tif, reduceOnly = false }) {
  const client = getExchangeClient(account);
  return client.order({
    orders: [
      {
        a: resolveOrderAsset(pairIndex),
        b: isBuy,
        p: price,
        s: size,
        r: reduceOnly,
        t: { limit: { tif } },
      },
    ],
    grouping: "na",
  });
}

export async function cancelSpotOrder(account, { pairIndex, oid }) {
  const client = getExchangeClient(account);
  return client.cancel({ cancels: [{ a: resolveOrderAsset(pairIndex), o: oid }] });
}

/**
 * Moves NAV from HyperCore to HyperEVM (as the ERC20) — the bridge's
 * withdrawal flow needs it on EVM before burnWithNote() can be called.
 * `amountDecimalString` is a plain decimal string, not base units.
 *
 * Uses `sendAsset`, not `spotSend`: Hyperliquid rejects `spotSend` (and
 * `usdSend`) on accounts with Unified Trading enabled — "Action disabled
 * when unified account is active" — confirmed against a live account.
 * `sendAsset` with sourceDex/destinationDex both "spot" is the one transfer
 * action that works on both unified and legacy accounts, and is exactly the
 * pattern Circle's own Hyperliquid bridging docs use for a spot -> system
 * address transfer.
 */
export async function spotSendNavToEvm(account, amountDecimalString) {
  const client = getExchangeClient(account);
  return client.sendAsset({
    destination: HYPERCORE_SYSTEM_ADDRESS,
    sourceDex: "spot",
    destinationDex: "spot",
    token: `NAV:${NAV_TOKEN_ID}`,
    amount: amountDecimalString,
  });
}

/**
 * Moves HYPE from HyperCore spot to the same address on HyperEVM (native
 * HYPE, for gas). Same sendAsset pattern as spotSendNavToEvm, for the same
 * unified-account reason.
 */
export async function spotSendHypeToEvm(account, amountDecimalString) {
  const client = getExchangeClient(account);
  return client.sendAsset({
    destination: HYPE_SYSTEM_ADDRESS,
    sourceDex: "spot",
    destinationDex: "spot",
    token: HYPE_TOKEN,
    amount: amountDecimalString,
  });
}

/** Spot order/cancel asset ids are offset by 10000 from the info/WS "@index" coin id. */
function resolveOrderAsset(pairIndex) {
  return 10000 + pairIndex;
}

/**
 * Sends a spot token (USDC/HYPE/UBTC/...) to another Hyperliquid (HyperCore)
 * address. Same sendAsset spot -> spot pattern as spotSendNavToEvm, for the
 * same unified-account reason. `token` is "<spotMeta name>:<tokenId>".
 */
export async function sendSpotToAddress(account, { destination, token, amount }) {
  const client = getExchangeClient(account);
  return client.sendAsset({
    destination,
    sourceDex: "spot",
    destinationDex: "spot",
    token,
    amount,
  });
}

/**
 * Withdraws USDC from Hyperliquid to `destination` on Arbitrum (withdraw3 —
 * Hyperliquid's own bridge; it deducts a flat 1 USDC fee). withdraw3 draws
 * from the perp balance: on a unified/portfolio-margin account spot USDC
 * already backs it, but on a legacy ("default"/"disabled") account the USDC
 * sits in spot and has to be moved to perp first with usdClassTransfer.
 */
export async function withdrawUsdcToArbitrum(account, { destination, amount, abstraction }) {
  const client = getExchangeClient(account);
  if (abstraction === "default" || abstraction === "disabled") {
    await client.usdClassTransfer({ amount, toPerp: true });
  }
  return client.withdraw3({ destination, amount });
}
