import { describe, it, expect } from "vitest";
import {
  isValidStakerKey, extractStakerKey, shortKey, toPositions, toRewards, rewardSeries, niceCeil, estimateRewards, parseOperators, sortOperators,
} from "../staking.js";

const KEY = "a" + "1".repeat(95);

describe("isValidStakerKey", () => {
  it("accepts 96 hex characters, any case, with surrounding space", () => {
    expect(isValidStakerKey(KEY)).toBe(true);
    expect(isValidStakerKey(` ${KEY.toUpperCase()} `)).toBe(true);
  });

  it("refuses wrong lengths, non-hex and the identity point", () => {
    expect(isValidStakerKey(KEY.slice(1))).toBe(false);
    expect(isValidStakerKey("z" + KEY.slice(1))).toBe(false);
    expect(isValidStakerKey("c0" + "00".repeat(47))).toBe(false);
    expect(isValidStakerKey(null)).toBe(false);
  });
});

describe("extractStakerKey", () => {
  it("finds the key inside scanned or pasted text", () => {
    expect(extractStakerKey(`navio-staker:${KEY.toUpperCase()}?name=x`)).toBe(KEY);
  });

  it("returns other text trimmed, so the form can say it is invalid", () => {
    expect(extractStakerKey("  nope ")).toBe("nope");
  });
});

describe("shortKey", () => {
  it("keeps the head and tail", () => {
    expect(shortKey(KEY)).toBe(`${KEY.slice(0, 8)}…${KEY.slice(-6)}`);
    expect(shortKey("abc")).toBe("abc");
  });
});

describe("toPositions", () => {
  const outputs = [
    { outputHash: "old", txHash: "t1", amountNav: 10000, blockHeight: 100 },
    { outputHash: "new", txHash: "t2", amountNav: 12000, blockHeight: 200 },
    { outputHash: "pending", txHash: "t3", amountNav: 15000, blockHeight: 0 },
  ];
  const delegations = [{ outputHash: "old", delegateKey: KEY, rewardAddress: "addr" }];

  it("labels each commitment and lists the unconfirmed first, then newest", () => {
    const positions = toPositions(outputs, delegations);
    expect(positions.map((p) => [p.outputHash, p.status])).toEqual([
      ["pending", "confirming"],
      ["new", "unknown"],
      ["old", "active"],
    ]);
    expect(positions[2]).toMatchObject({ delegateKey: KEY, rewardAddress: "addr", amount: 10000 });
  });
});

describe("toRewards", () => {
  it("keeps NAV outputs with the Reward memo and a block time, spent or not", () => {
    const outputs = [
      { memo: "Reward", amount: 150_000_000n, timestamp: 1_700_000_000, tokenId: null, isSpent: true },
      { memo: "Reward", amount: 1n, timestamp: 0, tokenId: null },
      { memo: "Operator Fee", amount: 1n, timestamp: 1_700_000_000, tokenId: null },
      { memo: "Reward", amount: 1n, timestamp: 1_700_000_000, tokenId: "ab" },
      { memo: "Reward", amount: 1n, timestamp: 1_700_000_000, tokenId: null, isStakedCommitment: true },
    ];
    expect(toRewards(outputs)).toEqual([{ at: 1_700_000_000_000, amount: 1.5 }]);
  });
});

describe("rewardSeries", () => {
  const now = new Date(2026, 9, 17, 14, 30).getTime();
  const at = (y, m, d, h = 12) => new Date(y, m, d, h).getTime();

  it("buckets by day, ending with today, and sums to the total", () => {
    const rewards = [
      { at: at(2026, 9, 17), amount: 2 },
      { at: at(2026, 9, 17, 1), amount: 1 },
      { at: at(2026, 9, 11), amount: 4 },
      { at: at(2026, 9, 10), amount: 8 }, // eight days back: outside 7D
    ];
    const s = rewardSeries(rewards, "7D", now);
    expect(s.buckets).toHaveLength(7);
    expect(s.buckets[6].amount).toBe(3);
    expect(s.buckets[0].amount).toBe(4);
    expect(s.total).toBe(7);
    expect(s.count).toBe(3);
  });

  it("buckets 24H by hour, ending with the current one", () => {
    const s = rewardSeries([{ at: at(2026, 9, 17, 14) + 60_000, amount: 1 }], "24H", now);
    expect(s.buckets).toHaveLength(24);
    expect(s.buckets[23].amount).toBe(1);
  });
});

describe("niceCeil", () => {
  it("rounds up to 1, 2 or 5 times a power of ten", () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(3.2)).toBe(5);
    expect(niceCeil(17)).toBe(20);
    expect(niceCeil(0.04)).toBeCloseTo(0.05);
  });
});

describe("estimateRewards", () => {
  it("is the stake's share of 720 blocks × 8 NAV a day, less the fee", () => {
    const e = estimateRewards({ stake: 10_000, totalStaked: 1_000_000, feePercent: 10 });
    expect(e.share).toBeCloseTo(0.01);
    expect(e.perDay).toBeCloseTo(720 * 8 * 0.01 * 0.9);
    expect(e.perYear).toBeCloseTo(e.perDay * 365);
    expect(e.apr).toBeCloseTo((e.perYear / 10_000) * 100);
    expect(e.daysBetweenRewards).toBeCloseTo(1 / 7.2);
  });

  it("never gives a stake more than the whole network", () => {
    expect(estimateRewards({ stake: 50, totalStaked: 10 }).share).toBe(1);
  });

  it("needs a stake, a total and a fee between 0 and 100", () => {
    expect(estimateRewards({ stake: 0, totalStaked: 1 })).toBeNull();
    expect(estimateRewards({ stake: 1, totalStaked: 0 })).toBeNull();
    expect(estimateRewards({ stake: 1, totalStaked: 1, feePercent: 120 })).toBeNull();
  });
});

describe("parseOperators", () => {
  const KEY2 = "b" + "2".repeat(95);
  const good = { name: " Aurora ", delegationKey: KEY.toUpperCase(), feeBps: 500, networks: ["mainnet", 7], createdAt: "2026-06-02", website: "https://example.com/a" };

  it("keeps well-formed operators, normalised", () => {
    const [op] = parseOperators({ operators: [good] });
    expect(op).toMatchObject({ name: "Aurora", delegationKey: KEY, feeBps: 500, networks: ["mainnet"], website: "https://example.com/a" });
    expect(op.createdAt).toBe(Date.parse("2026-06-02"));
  });

  it("drops bad keys, bad fees, nameless entries and repeated keys", () => {
    const ops = parseOperators({
      operators: [
        good,
        { ...good, name: "Twice" },
        { ...good, delegationKey: "abc" },
        { ...good, delegationKey: KEY2, feeBps: 20000 },
        { ...good, delegationKey: KEY2, name: "" },
        null,
      ],
    });
    expect(ops.map((o) => o.name)).toEqual(["Aurora"]);
  });

  it("only keeps https links", () => {
    const [op] = parseOperators({ operators: [{ ...good, website: "javascript:alert(1)" }] });
    expect(op.website).toBeNull();
  });

  it("returns nothing for a document without an operator list", () => {
    expect(parseOperators(null)).toEqual([]);
    expect(parseOperators({ operators: "x" })).toEqual([]);
  });
});

describe("sortOperators", () => {
  const op = (name, extra) => ({ name, feeBps: 0, createdAt: null, isDefault: false, ...extra });

  it("puts the default first, then the cheapest, then the longest listed", () => {
    const sorted = sortOperators([
      op("pricey", { feeBps: 1000 }),
      op("newer", { createdAt: 2 }),
      op("older", { createdAt: 1 }),
      op("default", { feeBps: 500, isDefault: true }),
    ]);
    expect(sorted.map((o) => o.name)).toEqual(["default", "older", "newer", "pricey"]);
  });

  it("reads only a literal true as default", () => {
    const [a, b] = parseOperators({
      operators: [
        { name: "A", delegationKey: KEY, default: true },
        { name: "B", delegationKey: "b" + "2".repeat(95), default: "yes" },
      ],
    });
    expect([a.isDefault, b.isDefault]).toEqual([true, false]);
  });
});

describe("parseOperators enabled flag", () => {
  it("is on unless the directory says false", () => {
    const ops = parseOperators({
      operators: [
        { name: "A", delegationKey: KEY },
        { name: "B", delegationKey: "b" + "2".repeat(95), enabled: false },
        { name: "C", delegationKey: "c" + "3".repeat(95), enabled: true },
      ],
    });
    expect(ops.map((o) => o.enabled)).toEqual([true, false, true]);
  });
});
