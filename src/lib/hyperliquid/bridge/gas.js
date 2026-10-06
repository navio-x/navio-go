import { parseUnits, formatUnits } from "viem";
import { getHyperEvmPublicClient } from "./client";
import { readHypeBalance } from "./contract";
import { fetchSpotClearinghouseState } from "@/lib/hyperliquid/api";
import { spotSendHypeToEvm } from "@/lib/hyperliquid/exchange";

// Most HYPE moved Core -> EVM for gas in one go; anything above stays on Core.
const MAX_HYPE_TO_MOVE = 0.01;
const HYPE_CORE_DECIMALS = 8;
const EVM_CREDIT_TIMEOUT_MS = 60_000;
const EVM_CREDIT_POLL_MS = 3_000;
// burnWithNote() can't be simulated before the NAV is on HyperEVM, so its
// gas is budgeted from a fixed upper bound instead of an estimate.
const BURN_GAS_BOUND = 300_000n;

/** Upper bound on the HYPE (wei) one bridge transaction needs for gas, with headroom. */
export async function estimateBridgeGasCost() {
  const gasPrice = await getHyperEvmPublicClient().getGasPrice();
  return (BURN_GAS_BOUND * gasPrice * 3n) / 2n;
}

/** HYPE available on HyperCore spot, as a number. */
export async function readCoreHype(address) {
  const state = await fetchSpotClearinghouseState(address);
  const bal = state.balances?.find((b) => b.coin === "HYPE");
  return bal ? Number(bal.total) - Number(bal.hold) : 0;
}

/**
 * Bridge contract calls cost HYPE gas on HyperEVM. If the EVM side can't
 * cover `needed` (wei) but HyperCore spot holds HYPE (e.g. from the faucet),
 * move some over first and wait for it to arrive.
 */
export async function ensureEvmGas(account, needed, { onMoving } = {}) {
  const evmHype = await readHypeBalance(account.address);
  if (evmHype >= needed) return;

  const coreHype = await readCoreHype(account.address);
  if (!(coreHype > 0)) throw new Error("no_hype_for_gas");

  const amount = Math.min(coreHype, MAX_HYPE_TO_MOVE);
  const amountStr = formatUnits(parseUnits(amount.toFixed(HYPE_CORE_DECIMALS), HYPE_CORE_DECIMALS), HYPE_CORE_DECIMALS);
  onMoving?.();
  await spotSendHypeToEvm(account, amountStr);

  const deadline = Date.now() + EVM_CREDIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, EVM_CREDIT_POLL_MS));
    if ((await readHypeBalance(account.address)) >= needed) return;
  }
  throw new Error("hype_move_timeout");
}
