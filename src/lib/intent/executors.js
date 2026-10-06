import { parseUnits, formatUnits } from "viem";
import { getNavioClient, balance } from "@/stores/navio";
import { getReservedAmount, getSendableUtxos, loadReservations } from "@/stores/trade";
import { getEvmAccount } from "@/composables/useEvmAccount";
import { fetchSpotClearinghouseState, fetchL2Book, fetchUserFees } from "@/lib/hyperliquid/api";
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
import { MIN_BRIDGE_NAV } from "./router";

const POLL_MS = 15_000;
// A credited deposit is accepted as "arrived" within this margin of the
// expected amount, so an operation never waits forever on a rounding
// difference between what was sent and what the bridge credits.
const CREDIT_TOLERANCE = 0.01;
// The bridge only exists on Navio mainnet.
const onMainnet = () => (sessionStorage.getItem("network") ?? "mainnet") === "mainnet";

function fail(code, detail) {
  const err = new Error(code);
  if (detail) err.detail = detail;
  return err;
}

function requireAccount() {
  const account = getEvmAccount();
  if (!account) throw fail("wallet_locked");
  return account;
}

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
  if (!registered && (!coreExists || !gasReady)) {
    try {
      const quote = await fetchFaucetQuote(address);
      faucet = { amountNav: quote.amountNav, usdc: quote.payout?.usdc, hype: quote.payout?.hype };
    } catch (e) {
      console.error("[intent] setup quote unavailable:", e.message);
    }
  }

  return {
    navWallet: Number(balance.value) || 0,
    navExchange: exchange.available.NAV ?? 0,
    navEvm: Number(formatUnits(navEvmRaw, NAV_DECIMALS)),
    balances: exchange.available,
    registered,
    coreExists,
    paused,
    gasReady,
    faucet,
    bridgeUnavailable: !onMainnet(),
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

// One entry per step type in steps.js (which also says which ones move funds).
export const executors = {
  // One-time setup, part 1: buy a small USDC + HYPE package with NAV. Its
  // arrival creates the Hyperliquid account and provides gas.
  faucet: {
    async run(step) {
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
      // The price is only held for a while; never pay noticeably more than was reviewed.
      if (Number(quote.amountNav) > Number(step.amountNav) * 1.02) {
        throw fail("setup_price_changed", `${quote.amountNav} NAV`);
      }
      let result;
      try {
        result = await sendFaucetPayment(quote);
      } catch (e) {
        throw fail("send_failed", e?.message);
      }
      return { setupTxId: result?.txId || "" };
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
    async run() {
      const account = requireAccount();
      return bridgeCall(async () => {
        if (await readIsRegistered(account.address)) return null;
        if (!(await readCoreUserExists(account.address))) throw new Error("SenderNotActivated");
        await ensureEvmGas(account, await estimateRegisterGasCost(account));
        await registerCoreUser(account);
        return null;
      });
    },
  },

  // Wallet -> exchange: a normal NAV send to this account's bridge address.
  deposit: {
    async run(step) {
      const account = requireAccount();
      if (!onMainnet()) throw fail("bridge_unavailable");
      const [paused, registered, exchange] = await bridgeCall(() =>
        Promise.all([readPaused(), readIsRegistered(account.address), readExchangeBalances(account.address)])
      );
      if (paused) throw fail("bridge_paused");
      // Deposits to an unregistered address are not credited.
      if (!registered) throw fail("SenderNotActivated");
      if (step.amount < MIN_BRIDGE_NAV) throw fail("below_minimum");
      if (step.amount > (Number(balance.value) || 0)) throw fail("insufficient_wallet");

      // Same coin-locking rule as the Send screen: never spend outputs
      // committed to an open trade.
      await loadReservations();
      const selectedUtxos = getReservedAmount(null) > 0n
        ? (await getSendableUtxos(null)).map((u) => u.outputHash)
        : undefined;

      let result;
      try {
        result = await getNavioClient().sendTransaction({
          address: deriveDepositAddress(account.address).bech32mAddress,
          amount: parseUnits(toDecimalString(step.amount, NAV_DECIMALS), NAV_DECIMALS),
          // The bridge credits exactly what arrives; the fee is paid on top.
          subtractFeeFromAmount: false,
          ...(selectedUtxos ? { selectedUtxos } : {}),
        });
      } catch (e) {
        throw fail("send_failed", e?.message);
      }
      return { depositTxId: result?.txId || "", creditBaseline: exchange.total.NAV ?? 0 };
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

      let result;
      try {
        result = await placeSpotOrder(account, {
          pairIndex: market.pairIndex,
          isBuy: step.side === "buy",
          price: step.limitPx,
          size: toDecimalString(size, decimals),
          tif: "Ioc",
        });
      } catch (e) {
        throw fail(mapOrderError(e?.message), e?.message);
      }
      const status = result?.response?.data?.statuses?.[0];
      if (status?.error) throw fail(mapOrderError(status.error), status.error);
      const filled = status?.filled;
      if (!filled) throw fail("price_moved");

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
  },

  // Exchange -> HyperEVM: the bridge can only burn NAV held as the ERC20.
  toEvm: {
    async run(step, op) {
      const account = requireAccount();
      const { available } = await readExchangeBalances(account.address);
      const wanted = step.amount ?? op.ctx.received ?? 0;
      const amount = floorTo(Math.min(wanted, available.NAV ?? 0), NAV_DECIMALS);
      if (amount < MIN_BRIDGE_NAV) throw fail("below_minimum");
      try {
        await spotSendNavToEvm(account, toDecimalString(amount, NAV_DECIMALS));
      } catch (e) {
        throw fail(mapBridgeError(e) === "unknown" ? "exchange_rejected" : mapBridgeError(e), e?.message);
      }
      return { burnAmount: amount };
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
        const note = encryptWithdrawalNote(step.destination, account.address);
        await burnWithNote(account, raw, note);
        return { payout: { amount, baseline: Number(balance.value) || 0, at: api.now() } };
      });
    },
  },
};
