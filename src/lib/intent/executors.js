import { parseUnits, formatUnits } from "viem";
import { getNavioClient, balance } from "@/stores/navio";
import { getReservedAmount, getSendableUtxos, loadReservations } from "@/stores/trade";
import { getEvmAccount } from "@/composables/useEvmAccount";
import { fetchSpotClearinghouseState, fetchL2Book, fetchUserFees, fetchOrderStatus } from "@/lib/hyperliquid/api";
import { getSpotMeta, resolveTokens } from "@/lib/hyperliquid/meta";
import { HL_SPOT_MARKETS } from "@/lib/hyperliquid/market";
import { placeSpotOrder, spotSendNavToEvm } from "@/lib/hyperliquid/exchange";
import { fetchFaucetQuote, sendFaucetPayment } from "@/lib/hyperliquid/faucet";
import { NAV_DECIMALS } from "@/lib/hyperliquid/bridge/config";
import {
  readCoreUserExists,
  readIsRegistered,
  readPaused,
  readHypeBalance,
  readNavEvmBalance,
  readMinBurnValue,
  estimateRegisterGasCost,
  registerCoreUser,
  burnWithNote,
  mapBridgeError,
} from "@/lib/hyperliquid/bridge/contract";
import { deriveDepositAddress } from "@/lib/hyperliquid/bridge/depositAddress";
import { encryptWithdrawalNote } from "@/lib/hyperliquid/bridge/noteEncryption";
import { ensureEvmGas, estimateBridgeGasCost } from "@/lib/hyperliquid/bridge/gas";
import { floorTo, toDecimalString, FALLBACK_FEE_RATE } from "./quote";
import { MIN_BRIDGE_NAV } from "./requirements";
import { STEP_TYPES } from "./steps";
import { isMainnet } from "@/stores/network";
import { scenarioEnabled, scenarioAccountState, scenarioExchangeBalances } from "@/dev/scenario";

const POLL_MS = 15_000;
// A credited deposit is accepted as "arrived" within this margin of the
// expected amount, so an operation never waits forever on a rounding
// difference between what was sent and what the bridge credits.
const CREDIT_TOLERANCE = 0.01;
// The setup price is only held for a while; a quote this much above the
// approved amount is not paid without a fresh OK.
const SETUP_PRICE_TOLERANCE = 0.02;
// The bridge only exists on Navio mainnet; an unknown network counts as not.
const onMainnet = () => isMainnet.value;

function fail(code, detail) {
  const err = new Error(code);
  if (detail) err.detail = detail;
  return err;
}

/** Stops the engine for a fresh OK: the cost differs from what was approved. */
function askApproval(code, approval) {
  const err = new Error("needs_approval");
  err.approval = { code, ...approval };
  return err;
}

function requireAccount() {
  const account = getEvmAccount();
  if (!account) throw fail("wallet_locked");
  return account;
}

const walletNav = () => Number(balance.value) || 0;

/** Runs a bridge call, turning contract/RPC errors into this app's error codes. */
async function bridgeCall(fn) {
  try {
    return await fn();
  } catch (e) {
    const code = mapBridgeError(e);
    throw fail(code, code === "unknown" ? e?.shortMessage || e?.message : "");
  }
}

/** Hyperliquid spot balances for `address`: { available: { SYM: n }, total: { SYM: n } }. */
export async function readExchangeBalances(address) {
  if (scenarioEnabled()) return scenarioExchangeBalances();
  const [meta, state] = await Promise.all([getSpotMeta(), fetchSpotClearinghouseState(address)]);
  const available = {};
  const total = {};
  for (const tok of resolveTokens(meta)) {
    const bal = tok.index == null ? null : state.balances?.find((b) => b.token === tok.index);
    total[tok.symbol] = bal ? Number(bal.total) : 0;
    available[tok.symbol] = bal ? Number(bal.total) - Number(bal.hold) : 0;
  }
  return { available, total };
}

/**
 * Everything the router needs to know about the account, in one snapshot.
 * `faucet` is only fetched when the account can't pay for its own setup.
 */
export async function readAccountState(address) {
  if (scenarioEnabled()) return scenarioAccountState();
  const [coreExists, registered, paused, hypeEvm, gasCost, navEvmRaw, exchange] = await Promise.all([
    readCoreUserExists(address),
    readIsRegistered(address),
    readPaused(),
    readHypeBalance(address),
    estimateBridgeGasCost(),
    readNavEvmBalance(address),
    readExchangeBalances(address),
  ]);
  const gasReady = hypeEvm >= gasCost || exchange.available.HYPE > 0;

  let faucet = null;
  let faucetError = null;
  if (!registered && (!coreExists || !gasReady)) {
    try {
      const quote = await fetchFaucetQuote(address);
      faucet = { amountNav: quote.amountNav, usdc: quote.payout?.usdc, hype: quote.payout?.hype, expiresAt: quote.expiresAt };
    } catch (e) {
      faucetError = e.message;
      console.error("[intent] setup quote unavailable:", e.message);
    }
  }

  return {
    navWallet: walletNav(),
    navExchange: exchange.available.NAV ?? 0,
    navEvm: Number(formatUnits(navEvmRaw, NAV_DECIMALS)),
    balances: exchange.available,
    totals: exchange.total,
    registered,
    coreExists,
    paused,
    gasReady,
    hypeEvm: Number(formatUnits(hypeEvm, 18)),
    hypeCore: exchange.available.HYPE ?? 0,
    faucet,
    faucetError,
    bridgeUnavailable: !onMainnet(),
    depositAddress: registered ? deriveDepositAddress(address).bech32mAddress : null,
    readAt: Date.now(),
  };
}

/** Order books for each symbol's USDC market: { SYM: { bids, asks, szDecimals } }. */
export async function readBooks(symbols) {
  const entries = await Promise.all(
    symbols.map(async (symbol) => {
      const market = await HL_SPOT_MARKETS[`${symbol}-USDC`]?.resolver();
      if (!market) return null;
      const book = await fetchL2Book(market.coin);
      return [symbol, { bids: book.levels?.[0] ?? [], asks: book.levels?.[1] ?? [], szDecimals: market.baseSzDecimals }];
    })
  );
  return Object.fromEntries(entries.filter(Boolean));
}

/** This account's spot taker fee as a fraction, or null when it can't be read. */
export async function readTakerFeeRate(address) {
  try {
    const rate = Number((await fetchUserFees(address))?.userSpotCrossRate);
    return Number.isFinite(rate) && rate >= 0 && rate < 0.05 ? rate : null;
  } catch {
    return null;
  }
}

function mapOrderError(message) {
  const msg = String(message || "").toLowerCase();
  if (msg.includes("match")) return "price_moved";
  if (msg.includes("insufficient")) return "insufficient_balance";
  if (msg.includes("minimum")) return "order_too_small";
  return "exchange_rejected";
}

/** A 16-byte client order id, chosen before the order is sent. */
function newCloid() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Was a wallet send of `amount` made since `step.walletBefore` was recorded?
 * The wallet balance is the only thing a light wallet can read about its own
 * sends right away (the recipient output is not ours), so it is compared
 * with what was there before the step started.
 */
function walletSendOutcome(step, amount) {
  if (step.walletBefore == null) return "unknown";
  const now = walletNav();
  if (now <= step.walletBefore - amount * (1 - CREDIT_TOLERANCE)) return "done";
  if (now >= step.walletBefore - 0.001) return "not_sent";
  return "unknown";
}

// One entry per step type in steps.js (which also says which ones move funds).
export const executors = {
  // One-time setup, part 1: buy a small USDC + HYPE package with NAV. Its
  // arrival creates the Hyperliquid account and provides gas.
  faucet: {
    async run(step, op, api) {
      const account = requireAccount();
      const [exists, exchange] = await Promise.all([
        readCoreUserExists(account.address),
        readExchangeBalances(account.address),
      ]);
      if (exists && exchange.available.HYPE > 0) return null; // already set up

      let quote;
      try {
        quote = await fetchFaucetQuote(account.address);
      } catch (e) {
        throw fail("setup_unavailable", e.message);
      }
      // Never pay noticeably more than was approved: ask again instead.
      const approved = Number(step.approved?.amountNav ?? step.amountNav);
      if (Number(quote.amountNav) > approved * (1 + SETUP_PRICE_TOLERANCE)) {
        throw askApproval("setup_price_changed", { amountNav: Number(quote.amountNav), approvedNav: approved, usdc: quote.payout?.usdc, hype: quote.payout?.hype });
      }
      if (Number(quote.amountNav) + 0.01 > walletNav()) throw fail("insufficient_wallet");

      step.amountNav = quote.amountNav;
      step.walletBefore = walletNav();
      step.sentAt = api.now();
      api.save();
      let result;
      try {
        result = await sendFaucetPayment(quote);
      } catch (e) {
        throw fail("send_failed", e?.message);
      }
      step.txId = result?.txId || "";
      return { setupTxId: step.txId };
    },
    async verify(step) {
      const { address } = requireAccount();
      try {
        const [exists, exchange] = await Promise.all([readCoreUserExists(address), readExchangeBalances(address)]);
        if (exists && exchange.available.HYPE > 0) return "done";
      } catch (e) {
        console.error("[intent] faucet verify read failed:", e.message);
      }
      return walletSendOutcome(step, Number(step.amountNav));
    },
  },

  waitAccount: {
    async run(_step, _op, api) {
      const { address } = requireAccount();
      for (;;) {
        try {
          const [exists, exchange] = await Promise.all([readCoreUserExists(address), readExchangeBalances(address)]);
          if (exists && exchange.available.HYPE > 0) return null;
        } catch (e) {
          console.error("[intent] waitAccount poll failed:", e.message);
        }
        await api.sleep(POLL_MS);
      }
    },
  },

  // One-time setup, part 2. Checks first, so running it again is harmless.
  register: {
    async run(step, _op, api) {
      const account = requireAccount();
      return bridgeCall(async () => {
        if (await readIsRegistered(account.address)) return null;
        if (!(await readCoreUserExists(account.address))) throw new Error("SenderNotActivated");
        await ensureEvmGas(account, await estimateRegisterGasCost(account), {
          onMoving: () => {
            step.detail = "moving_gas";
            api.save();
          },
        });
        step.detail = "registering";
        api.save();
        const receipt = await registerCoreUser(account);
        step.hash = receipt?.transactionHash || "";
        return null;
      });
    },
  },

  // Wallet -> exchange: a normal NAV send to this account's bridge address.
  deposit: {
    async run(step, _op, api) {
      const account = requireAccount();
      if (!onMainnet()) throw fail("bridge_unavailable");
      const [paused, registered, exchange] = await bridgeCall(() =>
        Promise.all([readPaused(), readIsRegistered(account.address), readExchangeBalances(account.address)])
      );
      if (paused) throw fail("bridge_paused");
      // Deposits to an unregistered address are not credited.
      if (!registered) throw fail("SenderNotActivated");
      if (step.amount < MIN_BRIDGE_NAV) throw fail("below_minimum");
      if (step.amount > walletNav()) throw fail("insufficient_wallet");

      // Same coin-locking rule as the Send screen: never spend outputs
      // committed to an open trade.
      await loadReservations();
      const selectedUtxos = getReservedAmount(null) > 0n
        ? (await getSendableUtxos(null)).map((u) => u.outputHash)
        : undefined;

      step.address = deriveDepositAddress(account.address).bech32mAddress;
      step.walletBefore = walletNav();
      step.creditBaseline = exchange.total.NAV ?? 0;
      step.sentAt = api.now();
      api.save();
      let result;
      try {
        result = await getNavioClient().sendTransaction({
          address: step.address,
          amount: parseUnits(toDecimalString(step.amount, NAV_DECIMALS), NAV_DECIMALS),
          // The bridge credits exactly what arrives; the fee is paid on top.
          subtractFeeFromAmount: false,
          ...(selectedUtxos ? { selectedUtxos } : {}),
        });
      } catch (e) {
        throw fail("send_failed", e?.message);
      }
      step.txId = result?.txId || "";
      return { depositTxId: step.txId, creditBaseline: step.creditBaseline };
    },
    async verify(step) {
      const { address } = requireAccount();
      try {
        const exchange = await readExchangeBalances(address);
        if (step.creditBaseline != null && exchange.total.NAV >= step.creditBaseline + step.amount * (1 - CREDIT_TOLERANCE)) return "done";
      } catch (e) {
        console.error("[intent] deposit verify read failed:", e.message);
      }
      return walletSendOutcome(step, Number(step.amount));
    },
  },

  waitCredit: {
    async run(step, op, api) {
      const { address } = requireAccount();
      for (;;) {
        try {
          const exchange = await readExchangeBalances(address);
          const arrived = step.need != null
            ? exchange.available.NAV >= step.need * (1 - CREDIT_TOLERANCE)
            : exchange.total.NAV >= (op.ctx.creditBaseline ?? 0) + step.added * (1 - CREDIT_TOLERANCE);
          if (arrived) return null;
        } catch (e) {
          console.error("[intent] waitCredit poll failed:", e.message);
        }
        await api.sleep(POLL_MS);
      }
    },
  },

  // An immediate-or-cancel limit order: it fills at `limitPx` or better, or
  // not at all — so the minimum shown on the review screen is enforced by
  // the exchange itself, however long the preparation took.
  order: {
    async run(step, op, api) {
      const account = requireAccount();
      const market = await HL_SPOT_MARKETS[step.pair]?.resolver();
      if (!market) throw fail("no_market");
      const decimals = market.baseSzDecimals;
      const receives = step.side === "sell" ? "USDC" : step.base;
      const before = (await readExchangeBalances(account.address)).available;

      let size;
      if (step.side === "sell") {
        size = Math.min(step.size, floorTo(before[step.base] ?? 0, decimals));
        if (size < step.size * (1 - CREDIT_TOLERANCE)) throw fail("insufficient_balance");
      } else if (step.size != null) {
        size = step.size;
        if (size * Number(step.limitPx) > before.USDC + 1e-9) throw fail("insufficient_balance");
      } else {
        const budget = Math.min(op.ctx.proceeds ?? 0, before.USDC);
        size = floorTo(budget / Number(step.limitPx), decimals);
      }
      if (!(size > 0)) throw fail("order_too_small");

      // Chosen and persisted before sending, so an interrupted order can be
      // found again by this id (verify below).
      step.cloid = newCloid();
      step.sentSize = size;
      step.sentAt = api.now();
      api.save();
      let result;
      try {
        result = await placeSpotOrder(account, {
          pairIndex: market.pairIndex,
          isBuy: step.side === "buy",
          price: step.limitPx,
          size: toDecimalString(size, decimals),
          tif: "Ioc",
          cloid: step.cloid,
        });
      } catch (e) {
        throw fail(mapOrderError(e?.message), e?.message);
      }
      const status = result?.response?.data?.statuses?.[0];
      if (status?.error) throw fail(mapOrderError(status.error), status.error);
      const filled = status?.filled;
      if (!filled) throw fail("price_moved");

      step.oid = filled.oid;
      step.filledSz = Number(filled.totalSz);
      step.avgPx = Number(filled.avgPx);
      api.save();

      // What actually arrived, read from the balance itself rather than
      // re-deriving the exchange's fee arithmetic.
      let received = null;
      for (let i = 0; i < 5 && received == null; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const after = (await readExchangeBalances(account.address)).available;
          const delta = (after[receives] ?? 0) - (before[receives] ?? 0);
          if (delta > 0) received = delta;
        } catch (e) {
          console.error("[intent] fill balance read failed:", e.message);
        }
      }
      if (received == null) {
        const gross = step.side === "sell" ? step.filledSz * step.avgPx : step.filledSz;
        received = gross * (1 - FALLBACK_FEE_RATE);
      }

      return {
        received,
        receivedSymbol: receives,
        partial: step.filledSz < size * 0.999 || !!op.ctx.partial,
        ...(step.side === "sell" ? { proceeds: received, sold: step.filledSz } : {}),
      };
    },
    async verify(step, op) {
      if (!step.cloid) return "not_sent";
      const { address } = requireAccount();
      try {
        const res = await fetchOrderStatus(address, step.cloid);
        if (res?.status === "unknownOid") return "not_sent";
        const st = res?.order?.status;
        if (st === "filled") {
          step.filledSz = step.filledSz ?? Number(res.order.order?.origSz ?? step.sentSize);
          const gross = step.side === "sell" ? step.filledSz * Number(res.order.order?.limitPx ?? step.limitPx) : step.filledSz;
          op.ctx.received = op.ctx.received ?? gross * (1 - FALLBACK_FEE_RATE);
          op.ctx.receivedSymbol = step.side === "sell" ? "USDC" : step.base;
          if (step.side === "sell") {
            op.ctx.proceeds = op.ctx.received;
            op.ctx.sold = step.filledSz;
          }
          return "done";
        }
        // An IOC that did not fill is gone: safe to send again.
        if (st === "canceled" || st === "rejected" || st === "marginCanceled") return "not_sent";
      } catch (e) {
        console.error("[intent] order verify failed:", e.message);
      }
      return "unknown";
    },
  },

  // Exchange -> HyperEVM: the bridge can only burn NAV held as the ERC20.
  toEvm: {
    async run(step, op, api) {
      const account = requireAccount();
      const { available } = await readExchangeBalances(account.address);
      const wanted = step.amount ?? op.ctx.received ?? 0;
      const amount = floorTo(Math.min(wanted, available.NAV ?? 0), NAV_DECIMALS);
      if (amount < MIN_BRIDGE_NAV) throw fail("below_minimum");
      step.exchangeBefore = available.NAV ?? 0;
      step.moveAmount = amount;
      api.save();
      try {
        await spotSendNavToEvm(account, toDecimalString(amount, NAV_DECIMALS));
      } catch (e) {
        throw fail(mapBridgeError(e) === "unknown" ? "exchange_rejected" : mapBridgeError(e), e?.message);
      }
      return { burnAmount: amount };
    },
    async verify(step, op) {
      const { address } = requireAccount();
      try {
        const { available } = await readExchangeBalances(address);
        if (step.exchangeBefore != null && available.NAV <= step.exchangeBefore - step.moveAmount * (1 - CREDIT_TOLERANCE)) {
          op.ctx.burnAmount = op.ctx.burnAmount ?? step.moveAmount;
          return "done";
        }
        if (step.exchangeBefore != null && available.NAV >= step.exchangeBefore - 1e-9) return "not_sent";
      } catch (e) {
        console.error("[intent] toEvm verify failed:", e.message);
      }
      return "unknown";
    },
  },

  waitEvm: {
    async run(_step, op, api) {
      const { address } = requireAccount();
      const target = op.steps.find((s) => s.type === "burn")?.amount ?? op.ctx.burnAmount ?? 0;
      const raw = parseUnits(toDecimalString(target, NAV_DECIMALS), NAV_DECIMALS);
      for (;;) {
        try {
          if ((await readNavEvmBalance(address)) >= raw) return null;
        } catch (e) {
          console.error("[intent] waitEvm poll failed:", e.message);
        }
        await api.sleep(5_000);
      }
    },
  },

  // HyperEVM -> wallet: burn with the destination encrypted for the bridge.
  burn: {
    async run(step, op, api) {
      const account = requireAccount();
      const amount = step.amount ?? op.ctx.burnAmount;
      const raw = parseUnits(toDecimalString(amount, NAV_DECIMALS), NAV_DECIMALS);
      return bridgeCall(async () => {
        const [paused, registered, minBurn, evmBalance] = await Promise.all([
          readPaused(),
          readIsRegistered(account.address),
          readMinBurnValue(),
          readNavEvmBalance(account.address),
        ]);
        if (paused) throw new Error("bridge_paused");
        if (!registered) throw new Error("BurnerNotActivated");
        if (raw < minBurn) throw new Error("below_minimum");
        if (raw > evmBalance) throw new Error("insufficient_balance");

        await ensureEvmGas(account, await estimateBridgeGasCost());
        step.evmBefore = Number(formatUnits(evmBalance, NAV_DECIMALS));
        step.burnAmount = amount;
        step.walletBefore = walletNav();
        api.save();
        const note = encryptWithdrawalNote(step.destination, account.address);
        const receipt = await burnWithNote(account, raw, note);
        step.hash = receipt?.transactionHash || "";
        return { payout: { amount, baseline: step.walletBefore, at: api.now() } };
      });
    },
    async verify(step, op, api) {
      const { address } = requireAccount();
      try {
        const evm = Number(formatUnits(await readNavEvmBalance(address), NAV_DECIMALS));
        if (step.evmBefore != null && evm <= step.evmBefore - step.burnAmount * (1 - CREDIT_TOLERANCE)) {
          op.ctx.payout = op.ctx.payout ?? { amount: step.burnAmount, baseline: step.walletBefore ?? walletNav(), at: api.now() };
          return "done";
        }
        if (step.evmBefore != null && evm >= step.evmBefore - 1e-9) return "not_sent";
      } catch (e) {
        console.error("[intent] burn verify failed:", e.message);
      }
      return "unknown";
    },
  },
};

for (const [type, def] of Object.entries(executors)) Object.assign(def, STEP_TYPES[type]);
