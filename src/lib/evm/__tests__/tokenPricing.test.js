import { describe, it, expect } from "vitest";
import { quoteTokenUsdPrice } from "../tokenPricing.js";

const TOKEN = "0x1000000000000000000000000000000000000A";
const STABLE = "0x2000000000000000000000000000000000000b";
const BASE = "0x3000000000000000000000000000000000000C";

function pairAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 9975n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;
  return numerator / denominator;
}

function pairKey(a, b) {
  return [a.toLowerCase(), b.toLowerCase()].sort().join("|");
}

function makeAmmClient(reserves) {
  return {
    async readContract({ functionName, args }) {
      if (functionName !== "getAmountsOut") throw new Error("unsupported");
      const [amountIn, path] = args;
      let current = amountIn;
      const amounts = [amountIn];
      for (let i = 0; i < path.length - 1; i++) {
        const [a, b] = [path[i], path[i + 1]];
        const key = pairKey(a, b);
        const pool = reserves[key];
        if (!pool) throw new Error(`no pool for ${key}`);
        const sortedFirst = [a.toLowerCase(), b.toLowerCase()].sort()[0];
        const [reserveIn, reserveOut] = a.toLowerCase() === sortedFirst ? pool : [pool[1], pool[0]];
        current = pairAmountOut(current, reserveIn, reserveOut);
        amounts.push(current);
      }
      return amounts;
    },
  };
}

describe("quoteTokenUsdPrice", () => {
  it("returns exactly 1 for the stablecoin itself, without any RPC call", async () => {
    const price = await quoteTokenUsdPrice({
      client: null,
      routerAddress: "0xRouter",
      tokenAddr: STABLE,
      tokenDecimals: 18,
      stableAddr: STABLE,
      stableDecimals: 18,
      baseAddrs: [],
    });
    expect(price).toBe(1);
  });

  it("derives an approximate unit price from a direct pool", async () => {
    // 1 TOKEN ~ 2 STABLE havuzda (2,000,000 / 1,000,000).
    const client = makeAmmClient({
      [pairKey(TOKEN, STABLE)]: [1_000_000n * 10n ** 18n, 2_000_000n * 10n ** 18n],
    });

    const price = await quoteTokenUsdPrice({
      client,
      routerAddress: "0xRouter",
      tokenAddr: TOKEN,
      tokenDecimals: 18,
      stableAddr: STABLE,
      stableDecimals: 18,
      baseAddrs: [],
    });

    expect(price).not.toBeNull();
    expect(price).toBeCloseTo(2, 1); // ~%0.25 fee payı dışında ~2.00
  });

  it("falls back through a base token when no direct pool exists", async () => {
    // pairKey sorts addresses, so each reserves tuple must be given in that
    // same sorted order — not the (a, b) order the pair was requested in.
    // TOKEN < BASE alphabetically: [reserveOfTOKEN, reserveOfBASE].
    // STABLE < BASE alphabetically: [reserveOfSTABLE, reserveOfBASE].
    const client = makeAmmClient({
      [pairKey(TOKEN, BASE)]: [1_000_000n * 10n ** 18n, 1_000_000n * 10n ** 18n],
      [pairKey(BASE, STABLE)]: [500_000n * 10n ** 18n, 1_000_000n * 10n ** 18n],
    });

    const price = await quoteTokenUsdPrice({
      client,
      routerAddress: "0xRouter",
      tokenAddr: TOKEN,
      tokenDecimals: 18,
      stableAddr: STABLE,
      stableDecimals: 18,
      baseAddrs: [BASE],
    });

    expect(price).not.toBeNull();
    expect(price).toBeCloseTo(0.5, 1);
  });

  it("returns null when no path has liquidity", async () => {
    const client = makeAmmClient({});
    const price = await quoteTokenUsdPrice({
      client,
      routerAddress: "0xRouter",
      tokenAddr: TOKEN,
      tokenDecimals: 18,
      stableAddr: STABLE,
      stableDecimals: 18,
      baseAddrs: [BASE],
    });
    expect(price).toBeNull();
  });
});
