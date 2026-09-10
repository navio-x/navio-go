/**
 * stores/trade.js
 * ─────────────────────────────────────────────────────────────────────────
 * Navio Go — native RFQ peer-to-peer trading (Navio's p2pmsg bus), NOT the
 * unrelated EVM/BSC bridge in stores/evm.js (see settings.dexMode there).
 *
 * Phase 1 only holds the server capability probe: whether the connected
 * Electrum server carries the RFQ trading bridge
 * (`client.getElectrumClient().p2pmsgInfo()` → `blockchain.p2pmsg.info`).
 * Nothing here ever touches wallet keys, balances or sync — it only reads
 * the existing wallet singleton (stores/navio.js) to know when a wallet is
 * connected. Entirely dormant (no RPC calls at all) while
 * settings.tradeMode is off, mirroring payroll/POS/EVM-dex.
 */
import { ref, watch } from "vue";
import { getNavioClient, walletName, syncHealth } from "@/stores/navio";
import { settings } from "@/stores/settings";
import { planMakerReservation } from "@/lib/trade/reservation";
import { getTradeStore, getTradeKey } from "@/lib/trade/session";
import { encryptRecord, decryptRecord } from "@/lib/trade/crypto";

// ── Phase 2: asset inventory ────────────────────────────────────────────
// Read-only browsing of what's available to trade. Deliberately its own
// fetch (client.getAssetBalances()) rather than reusing stores/navio.js's
// tokenBalances/nftBalances refs — those already exist for WalletAssets.vue,
// but getAssetBalances() is the single combined call both are filtered from
// SDK-side anyway, and keeping this fetch local to the trade module avoids
// coupling its refresh cadence to an unrelated screen's poll timer. Same
// client, same wallet session — just its own read.
export const assetBalances = ref([]); // WalletAssetBalance[] (token + nft), tokenId is always the public id
export const navBalance = ref(0n); // raw base units
export const assetsLoading = ref(false);
export const assetsError = ref(null);

export async function refreshAssets() {
  const client = getNavioClient();
  if (!client) return;
  assetsLoading.value = true;
  assetsError.value = null;
  try {
    const [assets, nav] = await Promise.all([client.getAssetBalances(), client.getBalance()]);
    assetBalances.value = assets;
    navBalance.value = nav;
  } catch (e) {
    assetsError.value = e?.message || String(e);
  } finally {
    assetsLoading.value = false;
  }
}

/** Unspent outputs for one asset (public token id). Fetched on demand, not cached. */
export async function getTokenOutputs(tokenId) {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  return client.getTokenOutputs(tokenId);
}

// 'disabled'  — tradeMode is off, module is dormant
// 'idle'      — tradeMode is on but no wallet connected yet
// 'checking'  — probe in flight
// 'available' — connected server carries the RFQ bridge
// 'unavailable' — connected server has no bridge (or isn't on electrum)
export const bridgeStatus = ref(settings.tradeMode ? "idle" : "disabled");
export const bridgeUnavailableReason = ref(null); // 'no-electrum-backend' | 'no-bridge' | 'p2pmsg-disabled' | null
export const lastProbedAt = ref(null);

export function isBridgeAvailable() {
  return bridgeStatus.value === "available";
}

export async function probeBridge() {
  if (!settings.tradeMode) {
    bridgeStatus.value = "disabled";
    return;
  }

  const client = getNavioClient();
  if (!client) {
    bridgeStatus.value = "idle";
    bridgeUnavailableReason.value = null;
    return;
  }

  if (bridgeStatus.value === "checking") return;
  bridgeStatus.value = "checking";

  try {
    const electrum = client.getElectrumClient();
    if (!electrum) {
      // Wallet is on the p2p backend, not electrum — the RFQ bridge only
      // exists behind ElectrumX (see navio-sdk's getTradingClient()).
      bridgeStatus.value = "unavailable";
      bridgeUnavailableReason.value = "no-electrum-backend";
      return;
    }

    const info = await electrum.p2pmsgInfo();
    if (info?.enabled) {
      bridgeStatus.value = "available";
      bridgeUnavailableReason.value = null;
    } else {
      bridgeStatus.value = "unavailable";
      bridgeUnavailableReason.value = "p2pmsg-disabled";
    }
  } catch (e) {
    // Servers without the bridge reject blockchain.p2pmsg.info outright
    // (unknown method) — that failure and a transient network error look
    // the same from here, so both land in the same calm "unavailable"
    // state rather than being presented as an error.
    console.warn("Trade bridge probe failed:", e?.message || e);
    bridgeStatus.value = "unavailable";
    bridgeUnavailableReason.value = "no-bridge";
  } finally {
    lastProbedAt.value = Date.now();
  }
}

// Re-probe whenever trading is turned on (wallet may already be connected)
// and whenever it's turned off, drop straight back to dormant.
watch(
  () => settings.tradeMode,
  (enabled) => {
    if (enabled) probeBridge();
    else {
      bridgeStatus.value = "disabled";
      bridgeUnavailableReason.value = null;
    }
  }
);

// Re-probe on connect: walletName is set once a wallet finishes connecting
// (see createWallet/loadWallet/restoreWallet in stores/navio.js). This also
// covers "server change" — this app has no in-place server swap for an
// already-open wallet; changing network means opening a different wallet
// entry, which goes through the same connect path.
watch(
  () => walletName.value,
  (name) => {
    if (name) probeBridge();
  }
);

// Re-probe on reconnect: the SDK doesn't expose a reconnect event, so this
// approximates it — a sync success arriving after a previously recorded
// sync error is the closest signal this app has to "the connection came
// back." Fires once per drop, not on every subsequent block.
let _sawSyncError = false;
watch(
  () => syncHealth.value.lastErrorAt,
  (val) => {
    if (val) _sawSyncError = true;
  }
);
watch(
  () => syncHealth.value.lastSuccessAt,
  () => {
    if (_sawSyncError) {
      _sawSyncError = false;
      probeBridge();
    }
  }
);

// ── Phase 3: taker flow ─────────────────────────────────────────────────
// requestQuote/listQuotes/acceptQuote are thin pass-throughs to the SDK —
// all protocol logic (ranking, bounds enforcement, half-building/signing)
// lives there. What's ours: holding the open request across the two screens
// it spans, and turning the SDK's two accept-time failure messages into
// states the UI can render distinctly instead of a generic error.

// The request currently being collected against, or null. Held here (not
// route params) since buyTokenId/sellTokenId/amount must be replayed
// verbatim into acceptQuote and RequestQuoteResult doesn't echo them back.
// Ephemeral by design — a hard refresh mid-flow loses it, same as any other
// in-progress form state elsewhere in the app (e.g. WalletAssets' modals).
export const activeQuoteRequest = ref(null); // { uuid, replyKey, buyTokenId, sellTokenId, amount, expiry } | null

export async function openQuoteRequest({ buyTokenId, sellTokenId, amount, expiry }) {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  const res = await client.requestQuote({ buyTokenId, sellTokenId, amount, expiry });
  activeQuoteRequest.value = { uuid: res.uuid, replyKey: res.replyKey, buyTokenId, sellTokenId, amount, expiry };
  await createTakerHistoryEntry(activeQuoteRequest.value);
  return activeQuoteRequest.value;
}

export async function listQuotes(uuid) {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  const quotes = await client.listQuotes(uuid);
  recordQuotesReceived(uuid, quotes);
  return quotes;
}

export async function cancelQuoteRequest(uuid) {
  const client = getNavioClient();
  if (!client) return;
  try {
    await client.cancelQuoteRequest(uuid);
  } finally {
    if (activeQuoteRequest.value?.uuid === uuid) activeQuoteRequest.value = null;
    markTakerHistoryClosed(uuid);
  }
}

export function clearActiveQuoteRequest() {
  activeQuoteRequest.value = null;
}

/**
 * Accept a quote. maxPay/minRecv are required (no default — callers must
 * derive them explicitly, per the SDK's own mandatory-bounds contract).
 * Refreshes the asset inventory on success since this spends taker coins.
 */
export async function acceptQuote(options) {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  try {
    const result = await client.acceptQuote(options);
    activeQuoteRequest.value = null;
    refreshAssets();
    await settleTakerHistory(options.uuid, result);
    return result;
  } catch (err) {
    await recordTakerAcceptFailure(options.uuid, err);
    throw err;
  }
}

/**
 * Classify an acceptQuote() rejection into a distinct UI state. Matches the
 * SDK's own thrown messages (see navio-sdk NavioClient.acceptQuote) — it
 * doesn't expose typed error codes for these, so this is deliberately
 * tolerant of message wording rather than exact-matching the whole string.
 */
export function classifyAcceptError(err) {
  const message = err?.message || String(err);
  if (message.includes("exceeds maxPay") || message.includes("below minRecv")) return "bounds";
  if (message.includes("not found for request")) return "expired";
  return "generic";
}

// ── Phase 4: maker flow + coin-locking safety ───────────────────────────
//
// The hazard (from navio-sdk's own docs): replyQuote/broadcastOrder spend
// wallet coins that the SDK does NOT lock. If the user spends the same
// coins from an ordinary send while a quote/order is outstanding, the swap
// silently fails to confirm. There is no SDK-side lock to opt into — this
// is entirely our responsibility, and it's the one place in this module
// where a bug can cost the user real money (a broken swap, or coins tied up
// with no local record of why).
//
// The core problem: replyQuote/broadcastOrder auto-select inputs when no
// selectedUtxos is given, and their result (MakerQuoteResult) does not
// report back which UTXOs got used — only acceptQuote's result does. So
// "lock after the fact" isn't available; we have to select the inputs
// OURSELVES up front (lib/trade/reservation.js, mirroring the SDK's own
// largest-first algorithm), pass them explicitly via selectedUtxos so the
// SDK spends exactly those, and record that exact set as reserved before
// the network call even starts.
//
// Reservations are persisted (encrypted, same pattern as payroll — see
// lib/trade/{crypto,session,storage}.js) and reloaded on every wallet
// connect, independent of settings.tradeMode: an outstanding commitment is
// real regardless of whether the trading UI is currently toggled on, so the
// lock must keep protecting ordinary sends even if the user turns trading
// off without settling. Released on expiry (with a grace buffer) or once
// the reserved outputs are observed spent (settlement, or — if the user
// spent them elsewhere despite the warning — no longer at risk either way).

const RECORD_TYPE = "reservations";
// Past a quote/order's own expiry, the SDK guarantees the coins were never
// locked server-side if unaccepted — but an accept landing right at the
// boundary needs a moment to reach this wallet's own sync. This buffer is
// about that sync lag, not about the protocol (which has no grace period).
const RESERVATION_GRACE_SECONDS = 120;

export const reservations = ref([]); // ReservationRecord[]
let _reservationsLoadedFor = null; // walletName this session's reservations were loaded for

function reservationOutputHashes(r) {
  return [...r.payOutputs, ...r.navFeeOutputs].map((o) => o.outputHash);
}

export function isOutputReserved(outputHash) {
  return reservations.value.some((r) => reservationOutputHashes(r).includes(outputHash));
}

/** Total value currently locked for a token — pay-leg outputs for that
 * token, plus (for NAV) every reservation's separate fee-funding outputs. */
export function getReservedAmount(tokenId) {
  let total = 0n;
  for (const r of reservations.value) {
    if (r.payTokenId === tokenId) {
      total += r.payOutputs.reduce((s, o) => s + BigInt(o.amount), 0n);
    }
    if (tokenId === null) {
      total += r.navFeeOutputs.reduce((s, o) => s + BigInt(o.amount), 0n);
    }
  }
  return total;
}

async function persistReservation(record) {
  const store = getTradeStore();
  const key = await getTradeKey();
  await store.put(RECORD_TYPE, record.id, await encryptRecord(key, record));
}

async function deleteReservationRecord(id) {
  try {
    const store = getTradeStore();
    await store.delete(RECORD_TYPE, id);
  } catch {
    // Best-effort — the in-memory release below is what actually protects
    // the user; a stale row surviving in storage just gets cleaned up (or
    // simply re-swept as already-settled) next load.
  }
}

/** Load persisted reservations for the connected wallet, dropping anything
 * already expired-past-grace before it ever reaches reactive state. Runs on
 * every wallet connect regardless of settings.tradeMode — see module note. */
export async function loadReservations() {
  const client = getNavioClient();
  if (!client || !walletName.value) return;
  if (_reservationsLoadedFor === walletName.value) return;
  try {
    const store = getTradeStore();
    const key = await getTradeKey();
    const rows = await store.list(RECORD_TYPE);
    const settled = await Promise.allSettled(rows.map((row) => decryptRecord(key, row.data)));
    const now = Date.now() / 1000;
    const records = settled
      .filter((s) => s.status === "fulfilled")
      .map((s) => s.value)
      .filter((r) => r.expiry + RESERVATION_GRACE_SECONDS > now);
    reservations.value = records;
    _reservationsLoadedFor = walletName.value;
    // Drop expired rows we just filtered out of memory from storage too.
    const keepIds = new Set(records.map((r) => r.id));
    await Promise.all(rows.filter((row) => !keepIds.has(row.id)).map((row) => deleteReservationRecord(row.id)));
    await sweepSettledReservations();
  } catch (e) {
    console.error("loadReservations failed:", e);
  }
}
watch(() => walletName.value, (name) => {
  if (name) loadReservations();
  else {
    reservations.value = [];
    _reservationsLoadedFor = null;
  }
});

/** Release anything past expiry+grace. Cheap, local-only — safe to call often. */
function sweepExpiredReservations() {
  const now = Date.now() / 1000;
  const stillLive = [];
  const expired = [];
  for (const r of reservations.value) {
    (r.expiry + RESERVATION_GRACE_SECONDS > now ? stillLive : expired).push(r);
  }
  if (expired.length === 0) return;
  reservations.value = stillLive;
  for (const r of expired) {
    deleteReservationRecord(r.id);
    updateMakerHistoryStatus(r.id, "expired");
  }
}

/** Release anything whose locked outputs are no longer unspent — settled
 * (or spent by other means), either way no longer at risk of a collision. */
async function sweepSettledReservations() {
  const client = getNavioClient();
  if (!client || reservations.value.length === 0) return;
  const tokenIds = new Set();
  for (const r of reservations.value) {
    tokenIds.add(r.payTokenId);
    if (r.navFeeOutputs.length > 0) tokenIds.add(null);
  }
  const unspentByToken = new Map();
  try {
    await Promise.all(
      [...tokenIds].map(async (tokenId) => {
        unspentByToken.set(tokenId, new Set((await client.getTokenOutputs(tokenId)).map((o) => o.outputHash)));
      })
    );
  } catch {
    return; // transient — next sweep tries again
  }
  const stillOutstanding = [];
  const settledRecords = [];
  for (const r of reservations.value) {
    const hashes = reservationOutputHashes(r);
    const stillUnspent = hashes.some((h) => {
      const payUnspent = unspentByToken.get(r.payTokenId)?.has(h);
      const navUnspent = unspentByToken.get(null)?.has(h);
      return payUnspent || navUnspent;
    });
    (stillUnspent ? stillOutstanding : settledRecords).push(r);
  }
  if (settledRecords.length === 0) return;
  reservations.value = stillOutstanding;
  for (const r of settledRecords) {
    deleteReservationRecord(r.id);
    updateMakerHistoryStatus(r.id, "settled");
  }
}

export async function sweepReservations() {
  sweepExpiredReservations();
  await sweepSettledReservations();
}
// Piggyback on the existing sync heartbeat rather than adding a new poll
// timer — see the bridge reconnect-probe watcher above for the same idea.
watch(() => syncHealth.value.lastSuccessAt, () => {
  sweepReservations();
});

/** Spendable, unreserved, confirmed outputs for a token — mirrors navio-sdk
 * buildSwapHalf's own spendability filter (unspent AND blockHeight > 0);
 * since we bypass its auto-selection entirely, passing it an unconfirmed
 * output as selectedUtxos would just fail with "not found or not
 * spendable" — filter it out ourselves before that point. */
async function fetchAvailableUtxos(tokenId) {
  const client = getNavioClient();
  const all = await client.getTokenOutputs(tokenId);
  return all.filter((o) => !o.isSpent && o.blockHeight > 0 && !isOutputReserved(o.outputHash));
}

// Serializes the fetch-plan-lock critical section of maker reservations so
// two actions (e.g. auto-reply answering several pending requests) can
// never both select the same not-yet-persisted coins. The network call
// itself runs outside the lock — once a plan is optimistically reserved,
// later callers already see those coins as unavailable.
let _reservationMutex = Promise.resolve();
function withReservationLock(fn) {
  const run = _reservationMutex.then(fn, fn);
  _reservationMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

const PROVISIONAL_PREFIX = "provisional:";

function addProvisionalReservation(record) {
  reservations.value = [...reservations.value, record];
}
function removeReservationById(id) {
  reservations.value = reservations.value.filter((r) => r.id !== id);
}
// Awaited by both call sites below, deliberately: the SDK call already
// succeeded (coins are genuinely committed) by the time this runs, so the
// reservation must be durably on disk before makerReplyQuote/
// makerBroadcastOrder hand control back to the caller — a reload in the gap
// between an in-memory-only update and the encrypted write landing would
// silently forget an outstanding lock.
async function finalizeReservation(provisionalId, finalRecord) {
  reservations.value = reservations.value.map((r) => (r.id === provisionalId ? finalRecord : r));
  await persistReservation(finalRecord);
}

function reservationErrorMessage(plan) {
  if (plan.reason === "insufficient_pay") return "insufficient_pay";
  if (plan.reason === "insufficient_fee_nav") return "insufficient_fee_nav";
  return "invalid_amount";
}

/**
 * Plan and optimistically lock the coins a maker action will spend, given
 * the pay leg (what this wallet delivers). Returns the plan (selectedUtxos
 * to hand the SDK call) plus a provisional record id to finalize or roll
 * back once the SDK call settles. Throws a short error code (see
 * reservationErrorMessage) the UI maps to a translated message — never a
 * silent "just pick something," per "never permit an unbounded accept"
 * applied to the maker side: an action with insufficient (or accidentally
 * double-committed) coins must fail loudly, not spend the wrong thing.
 */
async function planAndLock({ payTokenId, payAmount, kind, recvTokenId, recvAmount, expiry }) {
  return withReservationLock(async () => {
    const [payUtxos, navUtxos] = await Promise.all([
      fetchAvailableUtxos(payTokenId),
      payTokenId === null ? Promise.resolve(null) : fetchAvailableUtxos(null),
    ]);
    const plan = planMakerReservation({
      payTokenId,
      payAmount,
      payUtxos,
      navUtxos: payTokenId === null ? payUtxos : navUtxos,
    });
    if (!plan.ok) {
      throw new Error(reservationErrorMessage(plan));
    }
    const byHash = new Map([...payUtxos, ...(navUtxos ?? [])].map((o) => [o.outputHash, o]));
    const payOutputs = [];
    const navFeeOutputs = [];
    for (const hash of plan.selectedUtxos) {
      const utxo = byHash.get(hash);
      const entry = { outputHash: hash, amount: utxo.amount.toString() };
      if (utxo.tokenId === payTokenId) payOutputs.push(entry);
      else navFeeOutputs.push(entry);
    }
    const provisionalId = PROVISIONAL_PREFIX + crypto.randomUUID();
    addProvisionalReservation({
      id: provisionalId,
      kind,
      payTokenId,
      payAmount: payAmount.toString(),
      recvTokenId,
      recvAmount: recvAmount.toString(),
      payOutputs,
      navFeeOutputs,
      expiry,
      createdAt: Date.now(),
    });
    return { selectedUtxos: plan.selectedUtxos, provisionalId };
  });
}

/**
 * Answer a pending quote request (maker side). Reserves the coins it will
 * spend before calling the SDK; finalizes (persists) the reservation on
 * success, releases it immediately on failure since nothing was spent.
 */
export async function makerReplyQuote(request, options = {}) {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  const orderExpiry = options.orderExpiry ?? Math.floor(Date.now() / 1000) + 600; // matches the SDK's own default
  let provisionalId = null;
  try {
    const plan = await planAndLock({
      payTokenId: request.buyTokenId,
      payAmount: request.fill,
      kind: "quote",
      recvTokenId: request.sellTokenId,
      recvAmount: request.sellCost,
      expiry: orderExpiry,
    });
    provisionalId = plan.provisionalId;
    const result = await client.replyQuote({ request, orderExpiry, selectedUtxos: plan.selectedUtxos });
    await finalizeReservation(provisionalId, {
      ...reservations.value.find((r) => r.id === provisionalId),
      id: `quote:${result.quoteId}`,
    });
    await createMakerHistoryEntry({
      id: `quote:${result.quoteId}`,
      kind: "reply",
      payTokenId: request.buyTokenId,
      payAmount: request.fill,
      recvTokenId: request.sellTokenId,
      recvAmount: request.sellCost,
      expiry: orderExpiry,
      status: "pending",
    });
    return result;
  } catch (err) {
    if (provisionalId) removeReservationById(provisionalId);
    await createMakerHistoryEntry({
      id: `quote:failed:${crypto.randomUUID()}`,
      kind: "reply",
      payTokenId: request.buyTokenId,
      payAmount: request.fill,
      recvTokenId: request.sellTokenId,
      recvAmount: request.sellCost,
      expiry: orderExpiry,
      status: "failed",
      error: err?.message ?? String(err),
    });
    throw err;
  }
}

/** Publish a standing order (maker side). Same reserve-then-call-then-
 * finalize/release shape as makerReplyQuote. */
export async function makerBroadcastOrder(options) {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  let provisionalId = null;
  try {
    const plan = await planAndLock({
      payTokenId: options.offerTokenId,
      payAmount: options.offerAmount,
      kind: "order",
      recvTokenId: options.wantTokenId,
      recvAmount: options.wantAmount,
      expiry: options.expiry,
    });
    provisionalId = plan.provisionalId;
    const result = await client.broadcastOrder({ ...options, selectedUtxos: plan.selectedUtxos });
    await finalizeReservation(provisionalId, {
      ...reservations.value.find((r) => r.id === provisionalId),
      id: `order:${result.quoteId}`,
    });
    await createMakerHistoryEntry({
      id: `order:${result.quoteId}`,
      kind: "order",
      payTokenId: options.offerTokenId,
      payAmount: options.offerAmount,
      recvTokenId: options.wantTokenId,
      recvAmount: options.wantAmount,
      expiry: options.expiry,
      status: "pending",
    });
    return result;
  } catch (err) {
    if (provisionalId) removeReservationById(provisionalId);
    await createMakerHistoryEntry({
      id: `order:failed:${crypto.randomUUID()}`,
      kind: "order",
      payTokenId: options.offerTokenId,
      payAmount: options.offerAmount,
      recvTokenId: options.wantTokenId,
      recvAmount: options.wantAmount,
      expiry: options.expiry,
      status: "failed",
      error: err?.message ?? String(err),
    });
    throw err;
  }
}

// ── Send-flow integration: the other half of the coin-locking hazard ────
// Read by WalletSend.vue / WalletAssets.vue's send modal (see those files
// for the actual gating) — both are additive, no-op-when-zero reads: a
// wallet with no outstanding maker commitments sees identical behavior to
// before this module existed.

/** Spendable outputs for a token, minus whatever's currently reserved —
 * pass straight through as selectedUtxos on an ordinary send to guarantee
 * it can't touch a coin an outstanding quote/order depends on. */
export async function getSendableUtxos(tokenId) {
  return fetchAvailableUtxos(tokenId);
}

// ── Intents (maker "advertise liquidity") ───────────────────────────────
// Pure daemon-side config — no coins involved, nothing to reserve (see
// navio-sdk docs: "Costs nothing, signs nothing").

export const swapIntents = ref([]);

export async function refreshSwapIntents() {
  const client = getNavioClient();
  if (!client) return;
  try {
    swapIntents.value = await client.listSwapIntents();
  } catch (e) {
    console.error("refreshSwapIntents failed:", e);
  }
}

export async function createSwapIntent(options) {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  const id = await client.setSwapIntent(options);
  await refreshSwapIntents();
  return id;
}

export async function removeSwapIntent(intentId) {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  await client.clearSwapIntent(intentId);
  await refreshSwapIntents();
}

// ── Pending requests + reply (manual and auto) ──────────────────────────

export const pendingRequests = ref([]);
export const pendingSubscriptionActive = ref(false);
// Off by default every session, on purpose: an automated money-committing
// action resuming silently after a reload/crash without the user
// re-confirming is exactly the kind of surprise this module exists to
// avoid. Never persisted.
export const autoReplyEnabled = ref(false);
export const autoReplyLog = ref([]); // recent {time, uuid, quoteId|error} entries, most-recent-first, capped

const _autoRepliedUuids = new Set();
let _unsubscribePending = null;

export async function startPendingSubscription() {
  const client = getNavioClient();
  if (!client || pendingSubscriptionActive.value) return;
  const current = await client.subscribePendingQuoteRequests((pending) => {
    pendingRequests.value = pending;
    if (autoReplyEnabled.value) processAutoReply(pending);
  });
  pendingRequests.value = current;
  pendingSubscriptionActive.value = true;
  if (autoReplyEnabled.value) processAutoReply(current);
}

export async function stopPendingSubscription() {
  const client = getNavioClient();
  pendingSubscriptionActive.value = false;
  if (!client) return;
  try {
    await client.unsubscribePendingQuoteRequests();
  } catch {
    // best-effort
  }
}

async function processAutoReply(pending) {
  for (const request of pending) {
    if (_autoRepliedUuids.has(request.uuid)) continue;
    if (!autoReplyEnabled.value) break; // turned off mid-batch
    _autoRepliedUuids.add(request.uuid);
    try {
      const result = await makerReplyQuote(request);
      autoReplyLog.value = [{ time: Date.now(), uuid: request.uuid, quoteId: result.quoteId }, ...autoReplyLog.value].slice(0, 50);
    } catch (err) {
      autoReplyLog.value = [
        { time: Date.now(), uuid: request.uuid, error: err?.message ?? String(err) },
        ...autoReplyLog.value,
      ].slice(0, 50);
    }
  }
}

/**
 * Turning auto-reply on keeps the pending-request subscription alive even
 * if the user navigates away from the Respond screen — that's the point of
 * "auto." Turning it off stops the subscription too: nothing else needs it
 * running in the background once auto-reply is off (the Respond screen, if
 * open, restarts it on its own via mount for manual browsing).
 */
export async function setAutoReply(enabled) {
  autoReplyEnabled.value = enabled;
  if (enabled) {
    try {
      await startPendingSubscription();
    } catch (e) {
      // Don't let a subscription hiccup block answering requests we
      // already know about — the caller can retry starting it later.
      console.error("Failed to start pending-request subscription:", e);
    }
    processAutoReply(pendingRequests.value);
  } else {
    await stopPendingSubscription();
  }
}

// ── Phase 5: swap history ────────────────────────────────────────────────
// A permanent record of every swap attempt, both sides — persisted the same
// way as reservations (encrypted, same per-wallet database — see the
// "history" record type added to lib/trade/storage/indexedDbStore.js) but
// never swept away: a reservation's lock is released once it stops being a
// safety concern, but its outcome (settled/expired/failed) stays in history
// for as long as the wallet exists. Loaded eagerly on wallet connect, same
// as reservations — sweep-triggered status updates need entries from prior
// sessions in memory regardless of whether the user ever opens History.

const HISTORY_RECORD_TYPE = "history";
export const swapHistory = ref([]); // SwapHistoryEntry[], newest first
let _historyLoadedFor = null;

async function persistHistoryEntry(entry) {
  const store = getTradeStore();
  const key = await getTradeKey();
  await store.put(HISTORY_RECORD_TYPE, entry.id, await encryptRecord(key, entry));
}

function upsertHistoryEntry(entry) {
  const idx = swapHistory.value.findIndex((e) => e.id === entry.id);
  if (idx === -1) swapHistory.value = [entry, ...swapHistory.value];
  else swapHistory.value = swapHistory.value.map((e) => (e.id === entry.id ? entry : e));
}

export async function loadSwapHistory() {
  const client = getNavioClient();
  if (!client || !walletName.value) return;
  if (_historyLoadedFor === walletName.value) return;
  try {
    const store = getTradeStore();
    const key = await getTradeKey();
    const rows = await store.list(HISTORY_RECORD_TYPE);
    const settled = await Promise.allSettled(rows.map((row) => decryptRecord(key, row.data)));
    const entries = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
    entries.sort((a, b) => b.createdAt - a.createdAt);
    swapHistory.value = entries;
    _historyLoadedFor = walletName.value;
  } catch (e) {
    console.error("loadSwapHistory failed:", e);
  }
}
watch(() => walletName.value, (name) => {
  if (name) loadSwapHistory();
  else {
    swapHistory.value = [];
    _historyLoadedFor = null;
  }
});

// -- taker-side lifecycle -------------------------------------------------

async function createTakerHistoryEntry(request) {
  const entry = {
    id: `take:${request.uuid}`,
    role: "taker",
    uuid: request.uuid,
    buyTokenId: request.buyTokenId,
    sellTokenId: request.sellTokenId,
    amount: request.amount.toString(),
    expiry: request.expiry,
    quotesReceived: [],
    acceptedQuote: null,
    txId: null,
    status: "pending",
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  upsertHistoryEntry(entry);
  await persistHistoryEntry(entry);
}

async function recordQuotesReceived(uuid, quotes) {
  const entry = swapHistory.value.find((e) => e.id === `take:${uuid}`);
  if (!entry || entry.status !== "pending" || quotes.length === 0) return;
  const known = new Set(entry.quotesReceived.map((q) => q.quoteId));
  const fresh = quotes.filter((q) => !known.has(q.quoteId));
  if (fresh.length === 0) return;
  const updated = {
    ...entry,
    quotesReceived: [
      ...entry.quotesReceived,
      ...fresh.map((q) => ({
        quoteId: q.quoteId,
        fill: q.fill.toString(),
        sellCost: q.sellCost.toString(),
        price: q.price,
        orderExpiry: q.orderExpiry,
      })),
    ],
    updatedAt: Date.now(),
  };
  upsertHistoryEntry(updated);
  await persistHistoryEntry(updated);
}

async function settleTakerHistory(uuid, result) {
  const entry = swapHistory.value.find((e) => e.id === `take:${uuid}`);
  if (!entry) return;
  const updated = {
    ...entry,
    status: "settled",
    txId: result.txId,
    acceptedQuote: {
      quoteId: result.quote.quoteId,
      fill: result.quote.fill.toString(),
      sellCost: result.quote.sellCost.toString(),
      price: result.quote.price,
    },
    updatedAt: Date.now(),
  };
  upsertHistoryEntry(updated);
  await persistHistoryEntry(updated);
}

/**
 * A bounds rejection or an accept-time expiry just mean "pick a different
 * quote" — the request is still viable, so it stays pending. Only a generic
 * failure (insufficient funds, a rejected broadcast, ...) is treated as
 * terminal: retrying within the same window is unlikely to succeed.
 */
async function recordTakerAcceptFailure(uuid, err) {
  const entry = swapHistory.value.find((e) => e.id === `take:${uuid}`);
  if (!entry || entry.status !== "pending") return;
  if (classifyAcceptError(err) !== "generic") return;
  const updated = { ...entry, status: "failed", error: err?.message ?? String(err), updatedAt: Date.now() };
  upsertHistoryEntry(updated);
  await persistHistoryEntry(updated);
}

async function markTakerHistoryClosed(uuid) {
  const entry = swapHistory.value.find((e) => e.id === `take:${uuid}`);
  if (!entry || entry.status !== "pending") return;
  const updated = { ...entry, status: "expired", updatedAt: Date.now() };
  upsertHistoryEntry(updated);
  await persistHistoryEntry(updated);
}

function sweepTakerHistory() {
  const now = Date.now() / 1000;
  for (const entry of swapHistory.value) {
    if (entry.role === "taker" && entry.status === "pending" && entry.expiry < now) {
      markTakerHistoryClosed(entry.uuid);
    }
  }
}
watch(() => syncHealth.value.lastSuccessAt, () => {
  sweepTakerHistory();
});

// -- maker-side lifecycle --------------------------------------------------
// Note: navio-sdk's MakerQuoteResult (from replyQuote/broadcastOrder) never
// carries a final transaction id — only the taker's acceptQuote result does,
// since the maker only ever signs its own half. A settled maker entry is
// therefore detected indirectly (its reserved coins are observed spent —
// see sweepSettledReservations) and its txId stays null; the History view
// says so explicitly rather than implying a txid that was never available.

async function createMakerHistoryEntry({ id, kind, payTokenId, payAmount, recvTokenId, recvAmount, expiry, status, error }) {
  const entry = {
    id,
    role: "maker",
    kind, // 'reply' | 'order'
    payTokenId,
    payAmount: payAmount.toString(),
    recvTokenId,
    recvAmount: recvAmount.toString(),
    expiry,
    txId: null,
    status,
    error: error ?? null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  upsertHistoryEntry(entry);
  await persistHistoryEntry(entry);
}

async function updateMakerHistoryStatus(id, status) {
  const entry = swapHistory.value.find((e) => e.id === id);
  if (!entry || entry.status !== "pending") return;
  const updated = { ...entry, status, updatedAt: Date.now() };
  upsertHistoryEntry(updated);
  await persistHistoryEntry(updated);
}
