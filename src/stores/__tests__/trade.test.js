import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref, reactive, nextTick } from "vue";

// Each test gets its own fresh ref/reactive instances + a fresh import of
// trade.js (via vi.doMock + vi.resetModules). trade.js registers top-level
// watch() calls that are never stopped, so reusing the same mock refs across
// tests would leave every prior test's watchers still firing against shared
// state — hence fresh instances per test rather than module-level mocks.
function setUp({ tradeMode = false, walletName = "", client = null } = {}) {
  const mockWalletName = ref(walletName);
  const mockSyncHealth = ref({ lastSuccessAt: null, lastErrorAt: null });
  const mockSettings = reactive({ tradeMode });
  let mockClient = client;

  vi.doMock("@/stores/navio", () => ({
    getNavioClient: () => mockClient,
    walletName: mockWalletName,
    syncHealth: mockSyncHealth,
  }));
  vi.doMock("@/stores/settings", () => ({ settings: mockSettings }));

  return {
    mockWalletName,
    mockSyncHealth,
    mockSettings,
    setClient: (c) => {
      mockClient = c;
    },
  };
}

function makeClient({ hasElectrum = true, p2pmsgInfo, masterSeedHex = "aa".repeat(32), ...sdkMethods } = {}) {
  return {
    getElectrumClient: () =>
      hasElectrum ? { p2pmsgInfo: p2pmsgInfo ?? (() => Promise.resolve({ enabled: true })) } : null,
    getKeyManager: () => ({ getMasterSeedHex: () => masterSeedHex }),
    ...sdkMethods,
  };
}

function utxo(outputHash, tokenId, amount, { isSpent = false, blockHeight = 100 } = {}) {
  return { outputHash, tokenId, amount, isSpent, blockHeight };
}

describe("stores/trade", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("starts disabled when tradeMode is off", async () => {
    setUp({ tradeMode: false });
    const { bridgeStatus } = await import("../trade.js");
    expect(bridgeStatus.value).toBe("disabled");
  });

  it("probeBridge is a no-op (stays disabled) while tradeMode is off, even with a client", async () => {
    setUp({ tradeMode: false, client: makeClient() });
    const { bridgeStatus, probeBridge } = await import("../trade.js");
    await probeBridge();
    expect(bridgeStatus.value).toBe("disabled");
  });

  it("goes idle when tradeMode is on but no wallet is connected", async () => {
    setUp({ tradeMode: true, client: null });
    const { bridgeStatus, probeBridge } = await import("../trade.js");
    await probeBridge();
    expect(bridgeStatus.value).toBe("idle");
  });

  it("reports unavailable/no-electrum-backend on the p2p backend", async () => {
    setUp({ tradeMode: true, client: makeClient({ hasElectrum: false }) });
    const { bridgeStatus, bridgeUnavailableReason, probeBridge } = await import("../trade.js");
    await probeBridge();
    expect(bridgeStatus.value).toBe("unavailable");
    expect(bridgeUnavailableReason.value).toBe("no-electrum-backend");
  });

  it("reports available when p2pmsgInfo resolves enabled:true", async () => {
    setUp({ tradeMode: true, client: makeClient({ p2pmsgInfo: () => Promise.resolve({ enabled: true }) }) });
    const { bridgeStatus, isBridgeAvailable, probeBridge } = await import("../trade.js");
    await probeBridge();
    expect(bridgeStatus.value).toBe("available");
    expect(isBridgeAvailable()).toBe(true);
  });

  it("reports unavailable/p2pmsg-disabled when the daemon has p2pmsg off", async () => {
    setUp({ tradeMode: true, client: makeClient({ p2pmsgInfo: () => Promise.resolve({ enabled: false }) }) });
    const { bridgeStatus, bridgeUnavailableReason, probeBridge } = await import("../trade.js");
    await probeBridge();
    expect(bridgeStatus.value).toBe("unavailable");
    expect(bridgeUnavailableReason.value).toBe("p2pmsg-disabled");
  });

  it("reports unavailable/no-bridge when the server rejects the RPC (no bridge)", async () => {
    setUp({
      tradeMode: true,
      client: makeClient({ p2pmsgInfo: () => Promise.reject(new Error("Unknown method")) }),
    });
    const { bridgeStatus, bridgeUnavailableReason, probeBridge } = await import("../trade.js");
    await probeBridge();
    expect(bridgeStatus.value).toBe("unavailable");
    expect(bridgeUnavailableReason.value).toBe("no-bridge");
  });

  it("re-probes automatically when tradeMode flips on with a wallet already connected", async () => {
    const { mockSettings } = setUp({
      tradeMode: false,
      client: makeClient({ p2pmsgInfo: () => Promise.resolve({ enabled: true }) }),
    });
    const { bridgeStatus } = await import("../trade.js");
    expect(bridgeStatus.value).toBe("disabled");
    mockSettings.tradeMode = true;
    await vi.waitFor(() => expect(bridgeStatus.value).toBe("available"));
  });

  it("drops back to disabled immediately when tradeMode flips off", async () => {
    const { mockSettings } = setUp({
      tradeMode: true,
      client: makeClient({ p2pmsgInfo: () => Promise.resolve({ enabled: true }) }),
    });
    // Mirrors TradeHome.vue's onMounted probe — first-visit entry point.
    const { bridgeStatus, probeBridge } = await import("../trade.js");
    await probeBridge();
    expect(bridgeStatus.value).toBe("available");
    mockSettings.tradeMode = false;
    await nextTick();
    expect(bridgeStatus.value).toBe("disabled");
  });

  it("re-probes on connect: walletName going from empty to set", async () => {
    const { mockWalletName, setClient } = setUp({ tradeMode: true, client: null });
    const { bridgeStatus, probeBridge } = await import("../trade.js");
    await probeBridge();
    expect(bridgeStatus.value).toBe("idle");
    setClient(makeClient({ p2pmsgInfo: () => Promise.resolve({ enabled: true }) }));
    mockWalletName.value = "my-wallet";
    await vi.waitFor(() => expect(bridgeStatus.value).toBe("available"));
  });

  it("re-probes once on reconnect (error seen, then a fresh sync success)", async () => {
    let calls = 0;
    const { mockSyncHealth } = setUp({
      tradeMode: true,
      walletName: "my-wallet",
      client: makeClient({
        p2pmsgInfo: () => {
          calls++;
          return Promise.resolve({ enabled: true });
        },
      }),
    });
    // Mirrors TradeHome.vue's onMounted probe — first-visit entry point.
    const { bridgeStatus, probeBridge } = await import("../trade.js");
    await probeBridge();
    expect(bridgeStatus.value).toBe("available");
    const callsAfterConnect = calls;

    // A sync error alone shouldn't trigger a re-probe.
    mockSyncHealth.value = { ...mockSyncHealth.value, lastErrorAt: Date.now() };
    await nextTick();
    expect(calls).toBe(callsAfterConnect);

    // The next sync success after that error is the "reconnect" signal.
    mockSyncHealth.value = { ...mockSyncHealth.value, lastSuccessAt: Date.now() };
    await vi.waitFor(() => expect(calls).toBe(callsAfterConnect + 1));

    // A further success with no new error in between shouldn't re-probe again.
    mockSyncHealth.value = { ...mockSyncHealth.value, lastSuccessAt: Date.now() };
    await nextTick();
    expect(calls).toBe(callsAfterConnect + 1);
  });

  describe("classifyAcceptError", () => {
    it("classifies a maxPay violation as a bounds rejection", async () => {
      setUp();
      const { classifyAcceptError } = await import("../trade.js");
      expect(classifyAcceptError(new Error("Quote charges 120 which exceeds maxPay 100"))).toBe("bounds");
    });
    it("classifies a minRecv violation as a bounds rejection", async () => {
      setUp();
      const { classifyAcceptError } = await import("../trade.js");
      expect(classifyAcceptError(new Error("Quote delivers 80 which is below minRecv 100"))).toBe("bounds");
    });
    it("classifies a missing quote as expired", async () => {
      setUp();
      const { classifyAcceptError } = await import("../trade.js");
      expect(classifyAcceptError(new Error("Quote q1 not found for request u1"))).toBe("expired");
    });
    it("falls back to generic for anything else", async () => {
      setUp();
      const { classifyAcceptError } = await import("../trade.js");
      expect(classifyAcceptError(new Error("Network timeout"))).toBe("generic");
    });
  });

  describe("taker flow actions", () => {
    it("openQuoteRequest calls requestQuote and stores the echoed request", async () => {
      const requestQuote = vi.fn().mockResolvedValue({ uuid: "u1", reply_key: "rk1", replyKey: "rk1" });
      setUp({ walletName: "test-wallet-taker-1", client: makeClient({ requestQuote }) });
      const { activeQuoteRequest, openQuoteRequest } = await import("../trade.js");

      const opts = { buyTokenId: "aa".repeat(32), sellTokenId: null, amount: 500n, expiry: 123456 };
      const result = await openQuoteRequest(opts);

      expect(requestQuote).toHaveBeenCalledWith(opts);
      expect(result.uuid).toBe("u1");
      expect(activeQuoteRequest.value).toMatchObject({ uuid: "u1", ...opts });
    });

    it("listQuotes passes through to client.listQuotes", async () => {
      const summary = [{ quoteId: "q1", fill: 500n, sellCost: 10n, price: 0.02, orderExpiry: 999 }];
      const listQuotes = vi.fn().mockResolvedValue(summary);
      setUp({ client: makeClient({ listQuotes }) });
      const { listQuotes: storeListQuotes } = await import("../trade.js");

      await expect(storeListQuotes("u1")).resolves.toBe(summary);
      expect(listQuotes).toHaveBeenCalledWith("u1");
    });

    it("cancelQuoteRequest clears the active request even if it matches", async () => {
      const cancelQuoteRequest = vi.fn().mockResolvedValue(true);
      const requestQuote = vi.fn().mockResolvedValue({ uuid: "u1", replyKey: "rk1" });
      setUp({ walletName: "test-wallet-taker-2", client: makeClient({ cancelQuoteRequest, requestQuote }) });
      const { activeQuoteRequest, openQuoteRequest, cancelQuoteRequest: storeCancelRequest } = await import(
        "../trade.js"
      );

      await openQuoteRequest({ buyTokenId: null, sellTokenId: null, amount: 1n, expiry: 1 });
      expect(activeQuoteRequest.value).not.toBeNull();

      await storeCancelRequest("u1");
      expect(cancelQuoteRequest).toHaveBeenCalledWith("u1");
      expect(activeQuoteRequest.value).toBeNull();
    });

    it("acceptQuote clears the active request and refreshes assets on success", async () => {
      const acceptResult = {
        txId: "tx1",
        quote: { quoteId: "q1", fill: 500n, sellCost: 10n, price: 0.02, orderExpiry: 999 },
        fee: 5n,
      };
      const acceptQuote = vi.fn().mockResolvedValue(acceptResult);
      const requestQuote = vi.fn().mockResolvedValue({ uuid: "u1", replyKey: "rk1" });
      const getAssetBalances = vi.fn().mockResolvedValue([]);
      const getBalance = vi.fn().mockResolvedValue(0n);
      setUp({
        walletName: "test-wallet-taker-3",
        client: makeClient({ acceptQuote, requestQuote, getAssetBalances, getBalance }),
      });
      const { activeQuoteRequest, openQuoteRequest, acceptQuote: storeAcceptQuote } = await import("../trade.js");

      await openQuoteRequest({ buyTokenId: null, sellTokenId: null, amount: 1n, expiry: 1 });
      const opts = { uuid: "u1", quoteId: "q1", buyTokenId: null, sellTokenId: null, maxPay: 10n, minRecv: 1n };
      const result = await storeAcceptQuote(opts);

      expect(acceptQuote).toHaveBeenCalledWith(opts);
      expect(result).toBe(acceptResult);
      expect(activeQuoteRequest.value).toBeNull();
      await vi.waitFor(() => expect(getAssetBalances).toHaveBeenCalled());
    });

    it("acceptQuote propagates a bounds rejection without clearing the active request", async () => {
      const acceptQuote = vi.fn().mockRejectedValue(new Error("Quote charges 120 which exceeds maxPay 100"));
      const requestQuote = vi.fn().mockResolvedValue({ uuid: "u1", replyKey: "rk1" });
      setUp({ walletName: "test-wallet-taker-4", client: makeClient({ acceptQuote, requestQuote }) });
      const {
        activeQuoteRequest,
        openQuoteRequest,
        acceptQuote: storeAcceptQuote,
        classifyAcceptError,
      } = await import("../trade.js");

      await openQuoteRequest({ buyTokenId: null, sellTokenId: null, amount: 1n, expiry: 1 });
      const opts = { uuid: "u1", quoteId: "q1", buyTokenId: null, sellTokenId: null, maxPay: 100n, minRecv: 1n };

      let caught = null;
      await storeAcceptQuote(opts).catch((e) => (caught = e));
      expect(classifyAcceptError(caught)).toBe("bounds");
      // Rejected acceptQuote must not silently drop the taker's open request —
      // they may still want to retry with tighter/looser bounds.
      expect(activeQuoteRequest.value).not.toBeNull();
    });
  });

  describe("maker flow + coin locking", () => {
    let walletCounter = 0;
    function uniqueWallet() {
      walletCounter += 1;
      return `test-wallet-${walletCounter}-${Date.now()}`;
    }

    it("makerReplyQuote reserves exactly the selected UTXOs and finalizes on success", async () => {
      const navUtxos = [utxo("nav-a", null, 5_000_000n)];
      const replyQuote = vi.fn().mockResolvedValue({ quoteId: "q1", fee: 100n, halfTxHex: "aa" });
      const getTokenOutputs = vi.fn((tokenId) => Promise.resolve(tokenId === null ? navUtxos : []));
      const wallet = uniqueWallet();
      setUp({ walletName: wallet, client: makeClient({ replyQuote, getTokenOutputs }) });
      const { reservations, makerReplyQuote, isOutputReserved, getReservedAmount } = await import("../trade.js");

      const request = { uuid: "u1", buyTokenId: null, sellTokenId: "aa".repeat(32), fill: 1_000_000n, sellCost: 50n, replyKey: "rk" };
      const result = await makerReplyQuote(request);

      expect(result.quoteId).toBe("q1");
      expect(replyQuote).toHaveBeenCalledWith(
        expect.objectContaining({ request, selectedUtxos: ["nav-a"] })
      );
      expect(reservations.value).toHaveLength(1);
      expect(reservations.value[0].id).toBe("quote:q1");
      expect(isOutputReserved("nav-a")).toBe(true);
      expect(getReservedAmount(null)).toBe(5_000_000n);
    });

    it("makerReplyQuote fails cleanly (no SDK call) when funds are insufficient", async () => {
      const replyQuote = vi.fn().mockResolvedValue({ quoteId: "q1", fee: 0n, halfTxHex: "" });
      const getTokenOutputs = vi.fn(() => Promise.resolve([utxo("nav-a", null, 10n)]));
      const wallet = uniqueWallet();
      setUp({ walletName: wallet, client: makeClient({ replyQuote, getTokenOutputs }) });
      const { reservations, makerReplyQuote } = await import("../trade.js");

      const request = { uuid: "u1", buyTokenId: null, sellTokenId: null, fill: 1_000_000n, sellCost: 50n, replyKey: "rk" };
      await expect(makerReplyQuote(request)).rejects.toThrow("insufficient_pay");
      expect(replyQuote).not.toHaveBeenCalled();
      expect(reservations.value).toHaveLength(0);
    });

    it("makerReplyQuote releases the provisional reservation when the SDK call itself fails", async () => {
      const replyQuote = vi.fn().mockRejectedValue(new Error("daemon rejected"));
      const getTokenOutputs = vi.fn(() => Promise.resolve([utxo("nav-a", null, 5_000_000n)]));
      const wallet = uniqueWallet();
      setUp({ walletName: wallet, client: makeClient({ replyQuote, getTokenOutputs }) });
      const { reservations, makerReplyQuote, isOutputReserved } = await import("../trade.js");

      const request = { uuid: "u1", buyTokenId: null, sellTokenId: null, fill: 1_000_000n, sellCost: 50n, replyKey: "rk" };
      await expect(makerReplyQuote(request)).rejects.toThrow("daemon rejected");
      expect(reservations.value).toHaveLength(0);
      expect(isOutputReserved("nav-a")).toBe(false);
    });

    it("token-pay reservation locks both the token UTXO and a separate NAV fee UTXO", async () => {
      const tokenId = "cc".repeat(32);
      const tokenUtxos = [utxo("tok-a", tokenId, 800n)];
      const navUtxos = [utxo("nav-a", null, 5_000_000n)];
      const replyQuote = vi.fn().mockResolvedValue({ quoteId: "q1", fee: 0n, halfTxHex: "" });
      const getTokenOutputs = vi.fn((t) => Promise.resolve(t === null ? navUtxos : tokenUtxos));
      const wallet = uniqueWallet();
      setUp({ walletName: wallet, client: makeClient({ replyQuote, getTokenOutputs }) });
      const { reservations, makerReplyQuote, getReservedAmount } = await import("../trade.js");

      const request = { uuid: "u1", buyTokenId: tokenId, sellTokenId: null, fill: 500n, sellCost: 50n, replyKey: "rk" };
      await makerReplyQuote(request);

      expect(reservations.value[0].payOutputs.map((o) => o.outputHash)).toEqual(["tok-a"]);
      expect(reservations.value[0].navFeeOutputs.map((o) => o.outputHash)).toEqual(["nav-a"]);
      expect(getReservedAmount(tokenId)).toBe(800n);
      expect(getReservedAmount(null)).toBe(5_000_000n);
    });

    it("two concurrent makerReplyQuote calls never select the same UTXO", async () => {
      // Only enough for ONE of the two requests if selection is exclusive;
      // if the mutex failed to serialize, both would succeed against the
      // same single UTXO.
      const navUtxos = [utxo("nav-a", null, 5_000_000n)];
      let calls = 0;
      const replyQuote = vi.fn(() => {
        calls += 1;
        return Promise.resolve({ quoteId: `q${calls}`, fee: 0n, halfTxHex: "" });
      });
      const getTokenOutputs = vi.fn(() => Promise.resolve(navUtxos));
      const wallet = uniqueWallet();
      setUp({ walletName: wallet, client: makeClient({ replyQuote, getTokenOutputs }) });
      const { reservations, makerReplyQuote } = await import("../trade.js");

      const requestA = { uuid: "uA", buyTokenId: null, sellTokenId: null, fill: 1_000_000n, sellCost: 1n, replyKey: "rk" };
      const requestB = { uuid: "uB", buyTokenId: null, sellTokenId: null, fill: 1_000_000n, sellCost: 1n, replyKey: "rk" };

      const [a, b] = await Promise.allSettled([makerReplyQuote(requestA), makerReplyQuote(requestB)]);
      // One succeeds (the only NAV UTXO), the other must fail — never both
      // succeeding against the same coin.
      const outcomes = [a.status, b.status];
      expect(outcomes.filter((s) => s === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((s) => s === "rejected")).toHaveLength(1);
      expect(reservations.value).toHaveLength(1);
    });

    it("sweepReservations releases a reservation past expiry + grace", async () => {
      const wallet = uniqueWallet();
      setUp({ walletName: wallet, client: makeClient({ getTokenOutputs: () => Promise.resolve([]) }) });
      const trade = await import("../trade.js");
      // Directly seed reservations state via a successful reply, then force
      // its expiry into the past to exercise the sweep in isolation.
      const navUtxos = [utxo("nav-a", null, 5_000_000n)];
      trade.reservations.value = [
        {
          id: "quote:q1",
          kind: "quote",
          payTokenId: null,
          payAmount: "1",
          recvTokenId: null,
          recvAmount: "1",
          payOutputs: [{ outputHash: "nav-a", amount: "5000000" }],
          navFeeOutputs: [],
          expiry: Math.floor(Date.now() / 1000) - 1000, // long past expiry + grace
          createdAt: Date.now(),
        },
      ];
      await trade.sweepReservations();
      expect(trade.reservations.value).toHaveLength(0);
    });

    it("sweepReservations releases a reservation whose coins are now spent (settled)", async () => {
      const wallet = uniqueWallet();
      const getTokenOutputs = vi.fn(() => Promise.resolve([])); // the reserved output no longer appears -> spent
      setUp({ walletName: wallet, client: makeClient({ getTokenOutputs }) });
      const trade = await import("../trade.js");
      trade.reservations.value = [
        {
          id: "quote:q1",
          kind: "quote",
          payTokenId: null,
          payAmount: "1",
          recvTokenId: null,
          recvAmount: "1",
          payOutputs: [{ outputHash: "nav-a", amount: "5000000" }],
          navFeeOutputs: [],
          expiry: Math.floor(Date.now() / 1000) + 600, // not expired
          createdAt: Date.now(),
        },
      ];
      await trade.sweepReservations();
      expect(trade.reservations.value).toHaveLength(0);
    });

    it("sweepReservations keeps a reservation that is neither expired nor settled", async () => {
      const wallet = uniqueWallet();
      const getTokenOutputs = vi.fn(() => Promise.resolve([utxo("nav-a", null, 5_000_000n)]));
      setUp({ walletName: wallet, client: makeClient({ getTokenOutputs }) });
      const trade = await import("../trade.js");
      trade.reservations.value = [
        {
          id: "quote:q1",
          kind: "quote",
          payTokenId: null,
          payAmount: "1",
          recvTokenId: null,
          recvAmount: "1",
          payOutputs: [{ outputHash: "nav-a", amount: "5000000" }],
          navFeeOutputs: [],
          expiry: Math.floor(Date.now() / 1000) + 600,
          createdAt: Date.now(),
        },
      ];
      await trade.sweepReservations();
      expect(trade.reservations.value).toHaveLength(1);
    });

    it("loadReservations rehydrates persisted reservations after a simulated reload", async () => {
      const wallet = uniqueWallet();
      const navUtxos = [utxo("nav-a", null, 5_000_000n)];
      const replyQuote = vi.fn().mockResolvedValue({ quoteId: "q1", fee: 0n, halfTxHex: "" });
      setUp({ walletName: wallet, client: makeClient({ replyQuote, getTokenOutputs: () => Promise.resolve(navUtxos) }) });

      const trade1 = await import("../trade.js");
      await trade1.makerReplyQuote({ uuid: "u1", buyTokenId: null, sellTokenId: null, fill: 1n, sellCost: 1n, replyKey: "rk" });
      expect(trade1.reservations.value).toHaveLength(1);

      // Fresh module instance, same underlying doMock registrations (same
      // wallet identity, same mocked client) — genuinely simulates a reload:
      // in-memory state (reservations, the "already loaded" guard) resets,
      // but persisted storage (same wallet id -> same IndexedDB database)
      // does not.
      vi.resetModules();
      const trade2 = await import("../trade.js");
      expect(trade2.reservations.value).toHaveLength(0);
      await trade2.loadReservations();
      expect(trade2.reservations.value).toHaveLength(1);
      expect(trade2.reservations.value[0].id).toBe("quote:q1");
    });

    it("loadReservations drops an expired-past-grace reservation instead of rehydrating it", async () => {
      const wallet = uniqueWallet();
      setUp({ walletName: wallet, client: makeClient({}) });

      // Write an already-expired record straight to encrypted storage,
      // bypassing the normal create path entirely — isolates the load-time
      // filter from reservation creation.
      const { getTradeStore, getTradeKey } = await import("../../lib/trade/session.js");
      const { encryptRecord } = await import("../../lib/trade/crypto.js");
      const store = getTradeStore();
      const key = await getTradeKey();
      const expiredRecord = {
        id: "quote:expired1",
        kind: "quote",
        payTokenId: null,
        payAmount: "1",
        recvTokenId: null,
        recvAmount: "1",
        payOutputs: [{ outputHash: "nav-x", amount: "1" }],
        navFeeOutputs: [],
        expiry: Math.floor(Date.now() / 1000) - 10_000, // long past expiry + grace
        createdAt: Date.now(),
      };
      await store.put("reservations", expiredRecord.id, await encryptRecord(key, expiredRecord));

      const trade = await import("../trade.js");
      await trade.loadReservations();
      expect(trade.reservations.value).toHaveLength(0);

      // And it was actually cleaned out of storage, not just filtered from
      // the in-memory view.
      const stillThere = await store.get("reservations", expiredRecord.id);
      expect(stillThere).toBeNull();
    });

    it("createSwapIntent / removeSwapIntent / refreshSwapIntents pass through to the SDK", async () => {
      const setSwapIntent = vi.fn().mockResolvedValue(7);
      const clearSwapIntent = vi.fn().mockResolvedValue(true);
      const listSwapIntents = vi.fn().mockResolvedValue([{ id: 7, tokenIn: null, tokenOut: "aa".repeat(32), minSize: 1n, maxSize: 10n, priceMin: 1n, expiry: 999 }]);
      const wallet = uniqueWallet();
      setUp({ walletName: wallet, client: makeClient({ setSwapIntent, clearSwapIntent, listSwapIntents }) });
      const { swapIntents, createSwapIntent, removeSwapIntent } = await import("../trade.js");

      const opts = { tokenInId: null, tokenOutId: "aa".repeat(32), minSize: 1n, maxSize: 10n, priceMin: 1n, expiry: 999 };
      const id = await createSwapIntent(opts);
      expect(setSwapIntent).toHaveBeenCalledWith(opts);
      expect(id).toBe(7);
      expect(swapIntents.value).toHaveLength(1);

      await removeSwapIntent(7);
      expect(clearSwapIntent).toHaveBeenCalledWith(7);
      expect(listSwapIntents).toHaveBeenCalledTimes(2);
    });

    it("setAutoReply(true) answers each currently-pending request exactly once, logging results", async () => {
      const navUtxos = [utxo("nav-a", null, 5_000_000n), utxo("nav-b", null, 5_000_000n)];
      let replyCalls = 0;
      const replyQuote = vi.fn(() => {
        replyCalls += 1;
        return Promise.resolve({ quoteId: `q${replyCalls}`, fee: 0n, halfTxHex: "" });
      });
      const getTokenOutputs = vi.fn(() => Promise.resolve(navUtxos));
      const wallet = uniqueWallet();
      setUp({ walletName: wallet, client: makeClient({ replyQuote, getTokenOutputs }) });
      const { pendingRequests, autoReplyLog, setAutoReply, reservations } = await import("../trade.js");

      pendingRequests.value = [
        { uuid: "uA", buyTokenId: null, sellTokenId: null, fill: 1n, sellCost: 1n, replyKey: "rk" },
        { uuid: "uB", buyTokenId: null, sellTokenId: null, fill: 1n, sellCost: 1n, replyKey: "rk" },
      ];
      setAutoReply(true);
      // Wait on the log itself, not the earlier replyCalls signal — history
      // persistence now happens between the SDK call resolving and
      // processAutoReply pushing to the log, widening that gap.
      await vi.waitFor(() => expect(autoReplyLog.value).toHaveLength(2));
      expect(replyCalls).toBe(2);
      expect(reservations.value).toHaveLength(2);
      expect(autoReplyLog.value.every((e) => e.quoteId)).toBe(true);
    });

    it("does not answer the same request uuid twice across repeated pending updates", async () => {
      const navUtxos = [utxo("nav-a", null, 5_000_000n), utxo("nav-b", null, 5_000_000n)];
      let replyCalls = 0;
      const replyQuote = vi.fn(() => {
        replyCalls += 1;
        return Promise.resolve({ quoteId: `q${replyCalls}`, fee: 0n, halfTxHex: "" });
      });
      const getTokenOutputs = vi.fn(() => Promise.resolve(navUtxos));
      const wallet = uniqueWallet();
      setUp({ walletName: wallet, client: makeClient({ replyQuote, getTokenOutputs }) });
      const { pendingRequests, setAutoReply } = await import("../trade.js");

      const requestA = { uuid: "uA", buyTokenId: null, sellTokenId: null, fill: 1n, sellCost: 1n, replyKey: "rk" };
      pendingRequests.value = [requestA];
      setAutoReply(true);
      await vi.waitFor(() => expect(replyCalls).toBe(1));

      // The daemon's next update still lists the same (already-answered)
      // request — must not be answered again.
      pendingRequests.value = [requestA];
      await new Promise((r) => setTimeout(r, 20));
      expect(replyCalls).toBe(1);
    });

    it("auto-reply subscription drives makerReplyQuote via startPendingSubscription", async () => {
      const navUtxos = [utxo("nav-a", null, 5_000_000n)];
      const replyQuote = vi.fn().mockResolvedValue({ quoteId: "q1", fee: 0n, halfTxHex: "" });
      const getTokenOutputs = vi.fn(() => Promise.resolve(navUtxos));
      const request = { uuid: "uA", buyTokenId: null, sellTokenId: null, fill: 1n, sellCost: 1n, replyKey: "rk" };
      const subscribePendingQuoteRequests = vi.fn().mockResolvedValue([request]);
      const unsubscribePendingQuoteRequests = vi.fn().mockResolvedValue(true);
      const wallet = uniqueWallet();
      setUp({
        walletName: wallet,
        client: makeClient({ replyQuote, getTokenOutputs, subscribePendingQuoteRequests, unsubscribePendingQuoteRequests }),
      });
      const { setAutoReply, startPendingSubscription, stopPendingSubscription, pendingSubscriptionActive } =
        await import("../trade.js");

      setAutoReply(true);
      await startPendingSubscription();
      expect(pendingSubscriptionActive.value).toBe(true);
      await vi.waitFor(() => expect(replyQuote).toHaveBeenCalledTimes(1));

      await stopPendingSubscription();
      expect(unsubscribePendingQuoteRequests).toHaveBeenCalled();
      expect(pendingSubscriptionActive.value).toBe(false);
    });
  });

  describe("swap history", () => {
    let walletCounter = 0;
    function uniqueWallet() {
      walletCounter += 1;
      return `test-wallet-history-${walletCounter}-${Date.now()}`;
    }

    it("openQuoteRequest creates a pending taker history entry", async () => {
      const requestQuote = vi.fn().mockResolvedValue({ uuid: "u1", replyKey: "rk1" });
      setUp({ walletName: uniqueWallet(), client: makeClient({ requestQuote }) });
      const { swapHistory, openQuoteRequest } = await import("../trade.js");

      const opts = { buyTokenId: null, sellTokenId: null, amount: 500n, expiry: 123456 };
      await openQuoteRequest(opts);

      expect(swapHistory.value).toHaveLength(1);
      expect(swapHistory.value[0]).toMatchObject({
        id: "take:u1",
        role: "taker",
        status: "pending",
        amount: "500",
        quotesReceived: [],
        acceptedQuote: null,
        txId: null,
      });
    });

    it("listQuotes accumulates quotesReceived on the matching history entry, deduped by quoteId", async () => {
      const requestQuote = vi.fn().mockResolvedValue({ uuid: "u1", replyKey: "rk1" });
      const listQuotes = vi
        .fn()
        .mockResolvedValueOnce([{ quoteId: "q1", fill: 500n, sellCost: 10n, price: 0.02, orderExpiry: 999 }])
        .mockResolvedValueOnce([
          { quoteId: "q1", fill: 500n, sellCost: 10n, price: 0.02, orderExpiry: 999 },
          { quoteId: "q2", fill: 500n, sellCost: 9n, price: 0.018, orderExpiry: 999 },
        ]);
      setUp({ walletName: uniqueWallet(), client: makeClient({ requestQuote, listQuotes }) });
      const { swapHistory, openQuoteRequest, listQuotes: storeListQuotes } = await import("../trade.js");

      await openQuoteRequest({ buyTokenId: null, sellTokenId: null, amount: 500n, expiry: 123456 });
      await storeListQuotes("u1");
      await vi.waitFor(() => expect(swapHistory.value[0].quotesReceived).toHaveLength(1));
      await storeListQuotes("u1");
      await vi.waitFor(() => expect(swapHistory.value[0].quotesReceived).toHaveLength(2));
      expect(swapHistory.value[0].quotesReceived.map((q) => q.quoteId)).toEqual(["q1", "q2"]);
    });

    it("acceptQuote success settles the taker history entry with txId and the accepted quote", async () => {
      const requestQuote = vi.fn().mockResolvedValue({ uuid: "u1", replyKey: "rk1" });
      const acceptResult = {
        txId: "tx1",
        quote: { quoteId: "q1", fill: 500n, sellCost: 10n, price: 0.02, orderExpiry: 999 },
        fee: 0n,
      };
      const acceptQuote = vi.fn().mockResolvedValue(acceptResult);
      const getAssetBalances = vi.fn().mockResolvedValue([]);
      const getBalance = vi.fn().mockResolvedValue(0n);
      setUp({
        walletName: uniqueWallet(),
        client: makeClient({ requestQuote, acceptQuote, getAssetBalances, getBalance }),
      });
      const { swapHistory, openQuoteRequest, acceptQuote: storeAcceptQuote } = await import("../trade.js");

      await openQuoteRequest({ buyTokenId: null, sellTokenId: null, amount: 500n, expiry: 123456 });
      await storeAcceptQuote({ uuid: "u1", quoteId: "q1", buyTokenId: null, sellTokenId: null, maxPay: 10n, minRecv: 500n });

      expect(swapHistory.value[0]).toMatchObject({
        status: "settled",
        txId: "tx1",
        acceptedQuote: { quoteId: "q1", fill: "500", sellCost: "10" },
      });
    });

    it("a bounds-rejected accept attempt leaves the taker entry pending, not failed", async () => {
      const requestQuote = vi.fn().mockResolvedValue({ uuid: "u1", replyKey: "rk1" });
      const acceptQuote = vi.fn().mockRejectedValue(new Error("Quote charges 120 which exceeds maxPay 100"));
      setUp({ walletName: uniqueWallet(), client: makeClient({ requestQuote, acceptQuote }) });
      const { swapHistory, openQuoteRequest, acceptQuote: storeAcceptQuote } = await import("../trade.js");

      await openQuoteRequest({ buyTokenId: null, sellTokenId: null, amount: 500n, expiry: 123456 });
      await storeAcceptQuote({ uuid: "u1", quoteId: "q1", buyTokenId: null, sellTokenId: null, maxPay: 100n, minRecv: 500n }).catch(
        () => {}
      );

      expect(swapHistory.value[0].status).toBe("pending");
    });

    it("a generic accept failure marks the taker entry failed", async () => {
      const requestQuote = vi.fn().mockResolvedValue({ uuid: "u1", replyKey: "rk1" });
      const acceptQuote = vi.fn().mockRejectedValue(new Error("Network timeout"));
      setUp({ walletName: uniqueWallet(), client: makeClient({ requestQuote, acceptQuote }) });
      const { swapHistory, openQuoteRequest, acceptQuote: storeAcceptQuote } = await import("../trade.js");

      await openQuoteRequest({ buyTokenId: null, sellTokenId: null, amount: 500n, expiry: 123456 });
      await storeAcceptQuote({ uuid: "u1", quoteId: "q1", buyTokenId: null, sellTokenId: null, maxPay: 100n, minRecv: 500n }).catch(
        () => {}
      );

      expect(swapHistory.value[0]).toMatchObject({ status: "failed", error: "Network timeout" });
    });

    it("cancelQuoteRequest marks the taker entry expired", async () => {
      const requestQuote = vi.fn().mockResolvedValue({ uuid: "u1", replyKey: "rk1" });
      const cancelQuoteRequest = vi.fn().mockResolvedValue(true);
      setUp({ walletName: uniqueWallet(), client: makeClient({ requestQuote, cancelQuoteRequest }) });
      const { swapHistory, openQuoteRequest, cancelQuoteRequest: storeCancelRequest } = await import("../trade.js");

      await openQuoteRequest({ buyTokenId: null, sellTokenId: null, amount: 500n, expiry: 123456 });
      await storeCancelRequest("u1");

      expect(swapHistory.value[0].status).toBe("expired");
    });

    it("a taker entry whose window closes unaccepted is swept to expired", async () => {
      const requestQuote = vi.fn().mockResolvedValue({ uuid: "u1", replyKey: "rk1" });
      const { mockSyncHealth } = setUp({
        walletName: uniqueWallet(),
        client: makeClient({ requestQuote }),
      });
      const { swapHistory, openQuoteRequest } = await import("../trade.js");

      await openQuoteRequest({
        buyTokenId: null,
        sellTokenId: null,
        amount: 500n,
        expiry: Math.floor(Date.now() / 1000) - 10, // already in the past
      });
      expect(swapHistory.value[0].status).toBe("pending");

      // Sweeps piggyback on the sync heartbeat.
      mockSyncHealth.value = { ...mockSyncHealth.value, lastSuccessAt: Date.now() };
      await vi.waitFor(() => expect(swapHistory.value[0].status).toBe("expired"));
    });

    it("a successful makerReplyQuote creates a pending maker history entry", async () => {
      const navUtxos = [utxo("nav-a", null, 5_000_000n)];
      const replyQuote = vi.fn().mockResolvedValue({ quoteId: "q1", fee: 0n, halfTxHex: "" });
      const getTokenOutputs = vi.fn(() => Promise.resolve(navUtxos));
      setUp({ walletName: uniqueWallet(), client: makeClient({ replyQuote, getTokenOutputs }) });
      const { swapHistory, makerReplyQuote } = await import("../trade.js");

      const request = { uuid: "uA", buyTokenId: null, sellTokenId: "aa".repeat(32), fill: 1_000_000n, sellCost: 50n, replyKey: "rk" };
      await makerReplyQuote(request);

      expect(swapHistory.value).toHaveLength(1);
      expect(swapHistory.value[0]).toMatchObject({
        id: "quote:q1",
        role: "maker",
        kind: "reply",
        status: "pending",
        payAmount: "1000000",
        recvAmount: "50",
      });
    });

    it("a maker action that fails to reserve funds records a failed history entry", async () => {
      const replyQuote = vi.fn();
      const getTokenOutputs = vi.fn(() => Promise.resolve([utxo("nav-a", null, 10n)])); // far too little
      setUp({ walletName: uniqueWallet(), client: makeClient({ replyQuote, getTokenOutputs }) });
      const { swapHistory, makerReplyQuote } = await import("../trade.js");

      const request = { uuid: "uA", buyTokenId: null, sellTokenId: null, fill: 1_000_000n, sellCost: 50n, replyKey: "rk" };
      await expect(makerReplyQuote(request)).rejects.toThrow("insufficient_pay");

      expect(replyQuote).not.toHaveBeenCalled();
      expect(swapHistory.value).toHaveLength(1);
      expect(swapHistory.value[0]).toMatchObject({ role: "maker", status: "failed", error: "insufficient_pay" });
    });

    it("a maker action whose SDK call fails records a failed history entry and releases the lock", async () => {
      const navUtxos = [utxo("nav-a", null, 5_000_000n)];
      const replyQuote = vi.fn().mockRejectedValue(new Error("daemon rejected"));
      const getTokenOutputs = vi.fn(() => Promise.resolve(navUtxos));
      setUp({ walletName: uniqueWallet(), client: makeClient({ replyQuote, getTokenOutputs }) });
      const { swapHistory, reservations, makerReplyQuote } = await import("../trade.js");

      const request = { uuid: "uA", buyTokenId: null, sellTokenId: null, fill: 1_000_000n, sellCost: 50n, replyKey: "rk" };
      await expect(makerReplyQuote(request)).rejects.toThrow("daemon rejected");

      expect(reservations.value).toHaveLength(0); // lock released
      expect(swapHistory.value[0]).toMatchObject({ role: "maker", status: "failed", error: "daemon rejected" });
    });

    it("sweeping a settled reservation transitions its paired maker history entry to settled", async () => {
      const navUtxos = [utxo("nav-a", null, 5_000_000n)];
      const replyQuote = vi.fn().mockResolvedValue({ quoteId: "q1", fee: 0n, halfTxHex: "" });
      // First call (during the reply itself) sees the UTXO unspent; later
      // sweep calls see it gone (spent — settled).
      const getTokenOutputs = vi.fn().mockResolvedValueOnce(navUtxos).mockResolvedValue([]);
      const { mockSyncHealth } = setUp({
        walletName: uniqueWallet(),
        client: makeClient({ replyQuote, getTokenOutputs }),
      });
      const { swapHistory, reservations, makerReplyQuote } = await import("../trade.js");

      const request = { uuid: "uA", buyTokenId: null, sellTokenId: null, fill: 1_000_000n, sellCost: 50n, replyKey: "rk" };
      await makerReplyQuote(request);
      expect(swapHistory.value[0].status).toBe("pending");

      mockSyncHealth.value = { ...mockSyncHealth.value, lastSuccessAt: Date.now() };
      await vi.waitFor(() => expect(reservations.value).toHaveLength(0));
      expect(swapHistory.value[0].status).toBe("settled");
    });

    it("sweeping an expired reservation transitions its paired maker history entry to expired", async () => {
      const navUtxos = [utxo("nav-a", null, 5_000_000n)];
      const replyQuote = vi.fn().mockResolvedValue({ quoteId: "q1", fee: 0n, halfTxHex: "" });
      const getTokenOutputs = vi.fn(() => Promise.resolve(navUtxos));
      const { mockSyncHealth } = setUp({
        walletName: uniqueWallet(),
        client: makeClient({ replyQuote, getTokenOutputs }),
      });
      const { swapHistory, reservations, makerReplyQuote } = await import("../trade.js");

      // orderExpiry already in the past.
      const request = { uuid: "uA", buyTokenId: null, sellTokenId: null, fill: 1_000_000n, sellCost: 50n, replyKey: "rk" };
      await makerReplyQuote(request, { orderExpiry: Math.floor(Date.now() / 1000) - 10_000 });

      mockSyncHealth.value = { ...mockSyncHealth.value, lastSuccessAt: Date.now() };
      await vi.waitFor(() => expect(reservations.value).toHaveLength(0));
      expect(swapHistory.value[0].status).toBe("expired");
    });

    it("loadSwapHistory rehydrates persisted entries after a simulated reload", async () => {
      const wallet = uniqueWallet();
      const requestQuote = vi.fn().mockResolvedValue({ uuid: "u1", replyKey: "rk1" });
      setUp({ walletName: wallet, client: makeClient({ requestQuote }) });

      const trade1 = await import("../trade.js");
      await trade1.openQuoteRequest({ buyTokenId: null, sellTokenId: null, amount: 500n, expiry: 123456 });
      expect(trade1.swapHistory.value).toHaveLength(1);

      vi.resetModules();
      const trade2 = await import("../trade.js");
      expect(trade2.swapHistory.value).toHaveLength(0);
      await trade2.loadSwapHistory();
      expect(trade2.swapHistory.value).toHaveLength(1);
      expect(trade2.swapHistory.value[0].id).toBe("take:u1");
    });
  });
});
