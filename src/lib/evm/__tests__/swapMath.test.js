import { describe, it, expect } from "vitest";
import {
  findBestPath,
  estimatePriceImpactBps,
  readAssetBalance,
  hasEnoughNativeForGas,
  mapErrorCode,
} from "../swapMath.js";

const TOKEN_A = "0x1000000000000000000000000000000000000A";
const TOKEN_B = "0x2000000000000000000000000000000000000b";
const TOKEN_C = "0x3000000000000000000000000000000000000C";
const OWNER = "0x9999999999999999999999999999999999999a";

// PancakeSwap V2'nin gerçek fee'siyle (%0.25) aynı formül — mock client'ın
// getAmountsOut'u gerçek zincirdeki davranışı taklit etsin diye.
function pairAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 9975n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;
  return numerator / denominator;
}

function pairKey(a, b) {
  return [a.toLowerCase(), b.toLowerCase()].sort().join("|");
}

/**
 * reserves: { "tokenLower|tokenLower": [reserveOfFirstSortedToken, reserveOfSecondSortedToken] }
 * Bir pair reserves'te yoksa o hop revert eder (gerçek router'da havuz
 * yoksa getPair sıfır adres döner ve işlem revert eder).
 */
function makeAmmClient(reserves) {
  return {
    async readContract({ functionName, args }) {
      if (functionName !== "getAmountsOut") throw new Error("unsupported");
      const [amountIn, path] = args;
      const amounts = [amountIn];
      let current = amountIn;
      for (let i = 0; i < path.length - 1; i++) {
        const [a, b] = [path[i], path[i + 1]];
        const key = pairKey(a, b);
        const pool = reserves[key];
        if (!pool) throw new Error(`no pool for ${key}`);
        const sortedFirst = [a.toLowerCase(), b.toLowerCase()].sort()[0];
        const [reserveIn, reserveOut] =
          a.toLowerCase() === sortedFirst ? pool : [pool[1], pool[0]];
        current = pairAmountOut(current, reserveIn, reserveOut);
        amounts.push(current);
      }
      return amounts;
    },
  };
}

describe("findBestPath", () => {
  it("picks the direct path when it has the deepest liquidity", async () => {
    const client = makeAmmClient({
      [pairKey(TOKEN_A, TOKEN_B)]: [10_000_000n * 10n ** 18n, 10_000_000n * 10n ** 18n],
      [pairKey(TOKEN_A, TOKEN_C)]: [1000n * 10n ** 18n, 1000n * 10n ** 18n],
      [pairKey(TOKEN_C, TOKEN_B)]: [1000n * 10n ** 18n, 1000n * 10n ** 18n],
    });

    const best = await findBestPath(client, "0xRouter", TOKEN_A, TOKEN_B, 10n * 10n ** 18n, [TOKEN_C]);

    expect(best).not.toBeNull();
    expect(best.path).toEqual([TOKEN_A, TOKEN_B]);
  });

  it("falls back to a base-token hop when the direct pool doesn't exist", async () => {
    const client = makeAmmClient({
      [pairKey(TOKEN_A, TOKEN_C)]: [1000n * 10n ** 18n, 1000n * 10n ** 18n],
      [pairKey(TOKEN_C, TOKEN_B)]: [1000n * 10n ** 18n, 1000n * 10n ** 18n],
      // TOKEN_A <-> TOKEN_B doğrudan havuzu yok.
    });

    const best = await findBestPath(client, "0xRouter", TOKEN_A, TOKEN_B, 10n * 10n ** 18n, [TOKEN_C]);

    expect(best).not.toBeNull();
    expect(best.path).toEqual([TOKEN_A, TOKEN_C, TOKEN_B]);
  });

  it("returns null when no path has liquidity", async () => {
    const client = makeAmmClient({});
    const best = await findBestPath(client, "0xRouter", TOKEN_A, TOKEN_B, 10n * 10n ** 18n, [TOKEN_C]);
    expect(best).toBeNull();
  });
});

describe("estimatePriceImpactBps", () => {
  it("is close to zero for a trade that's tiny relative to deep reserves", async () => {
    const deepReserves = { [pairKey(TOKEN_A, TOKEN_B)]: [10_000_000n * 10n ** 18n, 10_000_000n * 10n ** 18n] };
    const client = makeAmmClient(deepReserves);
    const path = [TOKEN_A, TOKEN_B];
    const amountIn = 10n * 10n ** 18n; // havuzun ~0.0001'i
    const amountOut = pairAmountOut(amountIn, deepReserves[pairKey(TOKEN_A, TOKEN_B)][0], deepReserves[pairKey(TOKEN_A, TOKEN_B)][1]);

    const impactBps = await estimatePriceImpactBps(client, "0xRouter", path, amountIn, amountOut);

    expect(impactBps).not.toBeNull();
    expect(impactBps).toBeLessThan(5); // < %0.05
  });

  it("is meaningfully high for a trade that's large relative to shallow reserves", async () => {
    const shallowReserves = { [pairKey(TOKEN_A, TOKEN_B)]: [1000n * 10n ** 18n, 1000n * 10n ** 18n] };
    const client = makeAmmClient(shallowReserves);
    const path = [TOKEN_A, TOKEN_B];
    const amountIn = 200n * 10n ** 18n; // havuzun %20'si
    const amountOut = pairAmountOut(amountIn, shallowReserves[pairKey(TOKEN_A, TOKEN_B)][0], shallowReserves[pairKey(TOKEN_A, TOKEN_B)][1]);

    const impactBps = await estimatePriceImpactBps(client, "0xRouter", path, amountIn, amountOut);

    expect(impactBps).not.toBeNull();
    expect(impactBps).toBeGreaterThan(500); // > %5
  });

  it("returns null when amountIn is too small to probe", async () => {
    const client = makeAmmClient({ [pairKey(TOKEN_A, TOKEN_B)]: [1000n, 1000n] });
    const impactBps = await estimatePriceImpactBps(client, "0xRouter", [TOKEN_A, TOKEN_B], 1n, 1n);
    expect(impactBps).toBeNull();
  });
});

describe("readAssetBalance", () => {
  it("reads native balance via getBalance for a native asset", async () => {
    const client = {
      async getBalance({ address }) {
        expect(address).toBe(OWNER);
        return 123n;
      },
    };
    const balance = await readAssetBalance(client, { isNative: true }, OWNER);
    expect(balance).toBe(123n);
  });

  it("reads token balance via readContract for an ERC20 asset", async () => {
    const client = {
      async readContract({ address, functionName, args }) {
        expect(address).toBe(TOKEN_A);
        expect(functionName).toBe("balanceOf");
        expect(args).toEqual([OWNER]);
        return 456n;
      },
    };
    const balance = await readAssetBalance(client, { isNative: false, address: TOKEN_A }, OWNER);
    expect(balance).toBe(456n);
  });
});

describe("hasEnoughNativeForGas", () => {
  it("returns true when balance covers gas plus value with buffer", async () => {
    const client = {
      async getBalance() { return 1_000_000n; },
      async getGasPrice() { return 1n; },
    };
    // gasUnits * gasPrice * 1.2 + value = 21000*1*1.2 + 0 = 25200
    const ok = await hasEnoughNativeForGas(client, OWNER, 21_000n, 0n);
    expect(ok).toBe(true);
  });

  it("returns false when balance can't cover the buffered gas estimate", async () => {
    const client = {
      async getBalance() { return 100n; },
      async getGasPrice() { return 1n; },
    };
    const ok = await hasEnoughNativeForGas(client, OWNER, 21_000n, 0n);
    expect(ok).toBe(false);
  });

  it("fails open (true) when the gas/balance RPC calls throw", async () => {
    const client = {
      async getBalance() { throw new Error("rpc down"); },
      async getGasPrice() { return 1n; },
    };
    const ok = await hasEnoughNativeForGas(client, OWNER, 21_000n, 0n);
    expect(ok).toBe(true);
  });
});

describe("mapErrorCode", () => {
  it("maps known internal error messages to their codes", () => {
    expect(mapErrorCode(new Error("no_liquidity"))).toBe("no_liquidity");
    expect(mapErrorCode(new Error("wallet_locked"))).toBe("wallet_locked");
    expect(mapErrorCode(new Error("insufficient_gas"))).toBe("insufficient_gas");
  });

  it("maps PancakeSwap router revert reasons to user-facing codes", () => {
    expect(mapErrorCode({ shortMessage: "execution reverted: INSUFFICIENT_OUTPUT_AMOUNT" })).toBe("insufficient_output");
    expect(mapErrorCode({ shortMessage: "execution reverted: TRANSFER_FROM_FAILED" })).toBe("transfer_from_failed");
    expect(mapErrorCode({ shortMessage: "execution reverted: INSUFFICIENT_LIQUIDITY" })).toBe("insufficient_liquidity");
    expect(mapErrorCode({ shortMessage: "execution reverted: EXPIRED" })).toBe("expired");
  });

  it("maps a user-rejected wallet action", () => {
    expect(mapErrorCode({ name: "UserRejectedRequestError" })).toBe("user_rejected");
    expect(mapErrorCode({ message: "User rejected the request" })).toBe("user_rejected");
  });

  it("falls back to unknown for unrecognized errors", () => {
    expect(mapErrorCode(new Error("something completely unexpected"))).toBe("unknown");
  });
});
