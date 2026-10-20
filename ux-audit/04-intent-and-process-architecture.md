# 4. Intent → requirements → process architecture

Navio Go already has the right bones (`src/lib/intent/`: a quote, a router that adds setup steps, a persisted step engine, `stores/operations.js`). What was missing is (1) an explicit *requirement* layer the UI can show and reason about, (2) consent and verification semantics on steps, (3) a single, global place where processes live. The redesign keeps every protocol executor and extends the orchestration.

## 4.1 Intents

| Intent | Parameters | Entry points |
|---|---|---|
| `swap` | from, to, amount, deliverToWallet | Swap tab, NAV page → Swap, HL asset → Swap, Markets |
| `toExchange` ("move NAV to trading") | amount | NAV → Advanced, Market screen "Add NAV", Swap blocker |
| `toWallet` ("bring NAV back") | amount, destination | NAV → Advanced, Withdraw page |
| `receiveViaBridge` ("receive from another wallet into trading") | – | NAV → Advanced → Bridge deposit address |

All of them go through `planIntent(intent, state)` in `src/lib/intent/router.js`, which calls `evaluateRequirements()` and turns unmet requirements into steps.

## 4.2 Requirements (`src/lib/intent/requirements.js`)

| id | Satisfied when (authoritative source) | Resolution when unmet | Consent | Wait |
|---|---|---|---|---|
| `walletReady` | wallet open, EVM account derived | – (blocked `wallet_locked`) | – | – |
| `bridgeOpen` | Navio mainnet and `paused() == false` | blocked (`bridge_unavailable` / `bridge_paused`) | – | – |
| `tradingAccount` | `coreUserExists(addr)` **and** gas available (`HYPE on EVM ≥ gas estimate` or HYPE on Core > 0) | `faucet` (SEND, 28.88 NAV at the live quote) → `waitAccount` (WAIT ~6 min); blocked `setup_unavailable` when no quote, `no_gas` when the account exists but the one-shot faucet was already used | **yes** (NAV leaves the wallet) | yes |
| `bridgeRegistered` | `isRegistered(addr)` | `register` (AUTO: EVM tx paid in HYPE, idempotent — checks first) | no | seconds |
| `tradingBalance(symbol, amount)` | spot available ≥ amount | for NAV: `deposit` (SEND, max(need, 1 NAV)) → `waitCredit` (WAIT 6–96 min by size); other symbols: blocked `insufficient_balance` | **yes** | yes |
| `orderMinimum` | leg value ≥ 10 USDC | blocked `below_minimum` with the NAV equivalent | – | – |
| `walletFunds(total)` | wallet NAV ≥ deposit + setup cost + fee reserve | blocked `insufficient_balance` **with the exact shortfall** | – | – |
| `deliverable` (only when buying NAV to the wallet) | gas, registered, ≥ 1 NAV, bridge open | `register`? → `toEvm` (AUTO) → `waitEvm` (WAIT) → `burn` (SEND, consent in review) ; otherwise *note* "stays on the exchange" (never a dead end) | yes | yes |

`evaluateRequirements(intent, state)` returns `{ requirements: [{ id, satisfied, resolution: 'auto' | 'send' | 'wait' | 'blocked', steps, costNav, minutes, reason }], steps, blocker, costs }`. Satisfied requirements are skipped — a returning user's swap is just `[order]`; a new user's is `[faucet, waitAccount, register, deposit, waitCredit, order]`. Same intent, different generated process (brief §35).

## 4.3 Process (operation) state model

Persisted in `localStorage["intentOps:<evm address>"]` (per account; survives reload, app restart and wallet lock). Schema `version: 2`:

```
{
  id, version: 2,
  kind: 'swap' | 'toExchange' | 'toWallet' | 'receiveViaBridge',
  intent: { from, to, amount, destination?, deliverToWallet? },
  from, to, send, estReceive, minReceive, deliversToWallet, notes[],
  requirements: ['tradingAccount', 'bridgeRegistered', 'tradingBalance'],   // what was unmet at plan time (for the "why" text)
  steps: [{
    type,                       // faucet | waitAccount | register | deposit | waitCredit | order | toEvm | waitEvm | burn
    kind,                       // 'send' (moves funds, consent) | 'auto' | 'wait' | 'order'
    status,                     // pending | active | submitting | waiting | done | failed
    approved: { amountNav },    // what the user consented to in Review (send steps)
    startedAt, doneAt, txId, hash, filledSz, avgPx, …
  }],
  ctx: { setupTxId, depositTxId, creditBaseline, received, payout, … },
  status: 'running' | 'awaiting' | 'attention' | 'done' | 'cancelled',
  approval: { step, code, amountNav } | null,     // status 'awaiting': what needs a fresh OK and why
  attention: { code, detail } | null,              // status 'attention': what stopped it
  createdAt, updatedAt, finishedAt
}
```

### Step semantics (brief §11)

| UI state | Engine | Meaning |
|---|---|---|
| ✓ Completed | `done` | – |
| ● Current automatic operation | `active` on an `auto`/`order` step, `submitting` on a `send` step | running now, no user action |
| ! Approval required | op `awaiting`, `approval.step` | a send step's cost differs from what was approved (e.g. setup quote moved > 2 %) or the user chose step-by-step approval |
| ● Waiting | `active` on a `wait` step | polling chain/exchange state; the app may be closed |
| ○ Upcoming | `pending` | – |
| × Failed | `failed` + op `attention` | retry resumes **from this step**; finished steps are never re-run |

### Consent model

Review is the consent: it lists every fund movement with its amount (setup 28.88 NAV, deposit 300 NAV, burn …) and one *Confirm* approves exactly those numbers (`step.approved`). The engine re-asks (status `awaiting`) only when the real cost deviates from the approved one — that is when consent actually matters. There is no "Next" between steps.

## 4.4 Persistence, resume and reconstruction

- `engine.resume()` runs on wallet open (`hlEnabled && evmAddress`) and re-drives every `running` op. `wait` steps simply poll again. `auto` steps are idempotent (`register` checks `isRegistered` first).
- A `send` step found in `submitting` after a restart is **verified** before anything is re-sent (brief §23): `executor.verify(step, op)` returns `'done' | 'not_sent' | 'unknown'`:
  - `faucet`: `coreUserExists && HYPE > 0`, else a wallet tx to the faucet address with the `hl1:<evm>` memo since `startedAt`, else `not_sent`.
  - `deposit`: exchange NAV grew by ≥ amount since `creditBaseline`, else a wallet send of the amount to the deposit address since `startedAt` (txId or history), else `not_sent`.
  - `order`: a fill with the step's `cloid` (client order id, persisted before sending), else `not_sent`.
  - `toEvm` / `burn`: balance movement since the step started.
  Only `unknown` still asks the user ("It went through / Send again"); the message says what was checked.
- Chain state is authoritative for *where funds are*; the persisted op only remembers *what the user wanted* and which steps were already consumed.
- Deposits in flight (`deposit` done, `waitCredit` not) are counted as "on the way" in the portfolio so the total never dips.

## 4.5 Multiple operations

Operations are independent. `reservedFunds(activeOps)` reports NAV the wallet is about to send and exchange balances about to be spent; `spendable()` subtracts them, so a second operation can be planned honestly (e.g. a USDC→BTC swap while a NAV deposit is confirming). A second operation that needs the same unmet setup is refused with "setup already in progress" rather than queued twice.

## 4.6 Presentation layer (`src/lib/intent/present.js`)

Pure functions that turn an op into UI data, so every surface (tray, card, page, history) agrees:
- `describeOperation(op, t)` → `{ title, subtitle, progress: { done, total }, current: { label, detail, kind }, timeline: [{ id, label, detail, state, txId }], actions: [...] , technical: [...] }`
- `historyRowOf(op)` → one Activity row per finished op (title, amounts, time, technical steps).
- `stagesOf(steps)` collapses engine steps into user stages: *One-time setup* (faucet, waitAccount, register), *Move NAV to trading* (deposit, waitCredit), *Swap* (order…), *Send NAV to your wallet* (toEvm, waitEvm, burn).

## 4.7 Surfaces

| Surface | Component | Shows |
|---|---|---|
| Global tray (every page, above the navbar) | `ProcessTray.vue` | "Preparing trading · 3/5 · Waiting for your deposit (~4 min)" / "Needs your approval" / "2 operations in progress"; tap → Activity |
| Activity page `/activity` | `ActivityCenter.vue` | In progress + needs attention first, then recent. Each as `ProcessCard` |
| Process detail `/activity/:id` (full page, no modal-on-modal) | `ProcessDetail.vue` + `ProcessTimeline.vue` | timeline, explanation of the current step, primary action (Approve / Retry / It went through), Stop, Technical details (tx ids, addresses, raw error, balances) |
| Home / Swap / NAV page | `ProcessCard.vue` (compact) | one card per active op, "View progress" |
| History | op rows | finished ops as one row; technical rows folded in |
| Review sheet | `ReviewSheet.vue` | outcome + "One-time setup required" block + "Navio Go will:" list (the steps) + "Setup details" expandable |

## 4.8 What stays protocol code (unchanged)

`lib/hyperliquid/*` (API, exchange SDK wrapper, bridge contract, faucet, deposit address derivation, note encryption, gas) and the per-step executors' chain calls. The change is orchestration, detection, persistence semantics and presentation.
