import { describe, it, expect } from "vitest";
import { spentOutputOf, locateSend, sendConfirmations, minedTxId } from "../navioSend";

const SIGNED = "signedtx"; // the id the send had when it was signed
const MERGED = "blocktx"; // the id of the block's merged transaction

// The wallet's records right after a send, and after its block was synced.
const afterSend = [
  { outputHash: "in1", txHash: "old1", blockHeight: 90, spentTxHash: SIGNED, spentBlockHeight: 0 },
  { outputHash: "in2", txHash: "old2", blockHeight: 91, spentTxHash: SIGNED, spentBlockHeight: 0 },
  { outputHash: `mempool:${SIGNED}:1`, txHash: SIGNED, blockHeight: 0, spentTxHash: null, spentBlockHeight: null },
  { outputHash: "other", txHash: "old3", blockHeight: 80, spentTxHash: null, spentBlockHeight: null },
];
const minedAlone = [
  { outputHash: "in1", txHash: "old1", blockHeight: 90, spentTxHash: SIGNED, spentBlockHeight: 100 },
  { outputHash: "change", txHash: SIGNED, blockHeight: 100, spentTxHash: null, spentBlockHeight: null },
];
const minedMerged = [
  { outputHash: "in1", txHash: "old1", blockHeight: 90, spentTxHash: MERGED, spentBlockHeight: "100" },
  { outputHash: "in2", txHash: "old2", blockHeight: 91, spentTxHash: MERGED, spentBlockHeight: "100" },
  { outputHash: "change", txHash: MERGED, blockHeight: 100, spentTxHash: null, spentBlockHeight: null },
];

describe("spentOutputOf", () => {
  it("picks an output the send spent", () => {
    expect(spentOutputOf(afterSend, SIGNED)).toBe("in1");
  });

  it("is empty when the wallet shows none, or there is no id", () => {
    expect(spentOutputOf(afterSend, "unknown")).toBe("");
    expect(spentOutputOf(afterSend, "")).toBe("");
    expect(spentOutputOf(null, SIGNED)).toBe("");
  });
});

describe("following a send", () => {
  const send = { txId: SIGNED, spentOutput: "in1" };

  it("is in the mempool right after sending: no confirmations, nothing for the explorer", () => {
    expect(locateSend(afterSend, send)).toEqual({ height: 0, txId: SIGNED });
    expect(sendConfirmations(afterSend, send, 99)).toBe(0);
    expect(minedTxId(afterSend, send)).toBeNull();
  });

  it("keeps its id when mined on its own", () => {
    expect(sendConfirmations(minedAlone, send, 102)).toBe(3);
    expect(minedTxId(minedAlone, send)).toBe(SIGNED);
  });

  it("is found under the merged transaction's id when its block merged it", () => {
    expect(locateSend(minedMerged, send)).toEqual({ height: 100, txId: MERGED });
    expect(sendConfirmations(minedMerged, send, 102)).toBe(3);
    expect(minedTxId(minedMerged, send)).toBe(MERGED);
  });

  it("cannot follow a merged send without the output it spent", () => {
    const legacy = { txId: SIGNED };
    expect(sendConfirmations(minedMerged, legacy, 102)).toBeNull();
    expect(minedTxId(minedMerged, legacy)).toBeNull();
    // …but an unmerged one is still matched by its id, through what it spent or created.
    expect(minedTxId(minedAlone, legacy)).toBe(SIGNED);
    expect(sendConfirmations([minedAlone[1]], legacy, 100)).toBe(1);
  });

  it("prefers a mined record over a mempool one", () => {
    const mixed = [afterSend[2], minedAlone[0]];
    expect(locateSend(mixed, { txId: SIGNED })).toEqual({ height: 100, txId: SIGNED });
  });

  it("does not count an output that is no longer marked spent (send dropped)", () => {
    const dropped = [{ outputHash: "in1", txHash: "old1", blockHeight: 90, spentTxHash: null, spentBlockHeight: null }];
    expect(locateSend(dropped, send)).toBeNull();
    expect(sendConfirmations(dropped, send, 100)).toBeNull();
  });

  it("knows nothing without an id or an output, or before the tip reaches the block", () => {
    expect(locateSend(minedAlone, {})).toBeNull();
    expect(locateSend(null, send)).toBeNull();
    expect(sendConfirmations(minedAlone, send, 99)).toBe(0);
  });
});
