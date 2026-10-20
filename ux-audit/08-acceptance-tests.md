# 8. Acceptance tests

All runs were made against the dev server with the scenario harness (`src/dev/scenario.js`): the UI, planner, engine, persistence and resume logic are the production code; only the chain/exchange reads and the step executors are simulated, with real delays for the waits. Screenshots in `after/`. Unit tests: `npm test` (54 intent tests, 357 total).

## T1 — The exact reported problem: 1 NAV, trading not set up

Scenario `{ navWallet: 1 }`.

| Step | Expected | Result |
|---|---|---|
| Open Home | `1 NAV` | ✅ `after/30-home-1nav.png` |
| Open Swap | see that they own 1 NAV | ✅ "Available: 1 · In wallet 1 · Ready to trade 0" (`after/32-swap-1nav.png`) |
| Enter 1 | told what is needed, no `0`, no protocol words, a way forward | ✅ "You need about 272 NAV … You have 1 NAV." + "Trades must be worth at least 10 USDC — about 242 NAV" + **Receive NAV** (`after/33-swap-1nav-amount.png`) |

**Verdict:** the contradiction is gone and the app states the real, combined requirement. A 1 NAV wallet cannot complete a Hyperliquid swap on mainnet today for three independent reasons outside the app's control (one-time setup ≈ 28.9 NAV, bridge minimum 1 NAV + fee, exchange minimum 10 USDC ≈ 242 NAV), so the *successful swap* part of this test is run with a wallet that holds enough NAV (T2), with the same inactive account.

## T2 — Inactive trading account → successful swap, no Advanced, no discovery

Scenario `{ navWallet: 400 }` (no Hyperliquid account, not registered, nothing in trading), swap 300 NAV → USDC.

| # | Brief step | Result |
|---|---|---|
| 1 | Open Swap | ✅ `after/41-swap-400nav.png` |
| 2 | See that they own 400 NAV | ✅ "Available: 400 · In wallet 400 · Ready to trade 0" |
| 3 | Enter an amount | ✅ 300 |
| 4 | Be told one-time setup is required | ✅ "One-time setup needed … Set up trading account 28.88 NAV, once · Register with the bridge automatic · Move 300 NAV to trading about 6 min · Total from your wallet 328.88 NAV" (`after/42-swap-300-setup-needed.png`) |
| 5 | Start setup | ✅ Review → "One-time setup required … Navio Go will: 1–4" (`after/43-review-top.png`, `after/44-review-bottom.png`) |
| 6 | Approve only what needs approval | ✅ one Confirm "approves 2 payments"; no further clicks until done |
| 7 | Watch account activation | ✅ step 1 "28.88 NAV sent. Waiting for 3 confirmations" (`after/45-process-started.png`, `46`) |
| 8 | Watch faucet/setup | ✅ same step; "Trading account created." on completion |
| 9 | Watch registration | ✅ "Register with the bridge" runs automatically (`after/50-activity-list.png`) |
| 10 | Approve moving NAV when required | ✅ covered by the Review consent (listed as payment 2); no extra click |
| 11 | Watch confirmation | ✅ "Sent from your wallet. Waiting for confirmations · about 6 min left." (`after/51-process-deposit-waiting.png`) |
| 12 | Automatically continue to the swap | ✅ "Sell NAV for USDC" ran without input |
| 13 | Complete the swap | ✅ "Swapped NAV → USDC · 300 NAV → 12.3091 USDC · You received 12.3091 USDC." (`after/54-process-done.png`); History row (`after/56-history-swap-row.png`) |
| – | Never navigate to Advanced; never learn "Hyperliquid activation" exists | ✅ the words activation/HyperCore/faucet never appear outside *Technical details* / *Setup details* |

## T3 — Interruptibility

| Case | Result |
|---|---|
| Leave the process page during the setup wait → Send | ✅ tray shows "Swap NAV → USDC · 0 of 4 · 28.88 NAV sent. Waiting…" (`after/47-send-with-tray.png`) |
| Home during the wait | ✅ card with progress and "View progress" (`after/48-home-with-process.png`) |
| Reload during the setup wait | ✅ app auto-opens the wallet, process resumes, step advanced to "Register with the bridge" while away (`after/49-home-after-reload.png`, `after/50-activity-list.png`) |
| Reload during the deposit wait | ✅ "Move 300 NAV to trading · waiting" restored (`after/51-process-deposit-waiting.png`), completion detected after the credit landed (`after/54-process-done.png`) |
| Crash while a send is in flight (`crashOn: deposit`), then reload | ✅ engine verified on chain that nothing left the wallet and re-sent without asking; `deposit` shows `×2` attempts in Technical details (`after/67-process-resumed-after-crash.png`) |
| Interrupted with no evidence either way | ✅ "Unclear whether this step went out … It went through / Send again / Stop" (`after/68-process-interrupted-unknown.png`) — asked only when the answer is not knowable |

## T4 — Failure and retry

Scenario registered account, `failOnce: deposit`. ✅ "This step didn't go through … Finished steps are kept. Retry starts from this step." (`after/62-process-failed-step.png`), red tray on Home (`after/63-home-failed-tray.png`), "Needs you" section in Activity (`after/64-activity-needs-you.png`), Retry → re-ran only the deposit (attempts ×2) → completed (`after/65-process-after-retry.png`).

## T5 — Approval when the cost changes

Setup quote changed from 28.88 to 31.40 NAV between Review and send. ✅ process pauses: "The setup price changed since you reviewed it: 31.4 NAV instead of 28.88 NAV. Nothing has been sent yet. [Approve 31.4 NAV] [Stop]" (`after/70-process-approval-needed.png`); blue tray on Home (`after/71-home-approval-tray.png`); after approving the step continued with 31.4 NAV (`after/72-process-after-approval.png`).

## T6 — Account states A–I

| State | Scenario | Result |
|---|---|---|
| A fresh, no NAV | real audit wallet | Swap: "Available: 0 · In wallet 0 · Ready to trade 0"; amount → needs-NAV message + Receive NAV |
| B NAV, not activated | T1 / T2 | see above |
| C activated (account + gas), not registered | `coreExists, hype, faucet: null` | Swap callout lists only "Register with the bridge — automatic" and the move (`after/85-swap-stateC-register-needed.png`); Receive-into-trading offers "Register now", free (`after/86-receive-into-trading-not-ready.png`) |
| D registered, nothing deposited | `registered` | "NAV will be moved to trading first" callout; Review lists Move + Sell (`after/60-swap-registered-move-needed.png`, `after/61-review-move-only.png`) |
| E NAV deposited | `navExchange: 300` | single-step swap, done in seconds (`after/82-swap-returning.png`, `after/84-swap-returning-done.png`) |
| F setup partially completed | reload mid-setup (T3) | resumed at the next step |
| G interrupted during confirmation | T3 | restored, completed |
| H failed operation | T4 | retry from the failed step |
| I fully configured returning user | `registered, navExchange` | `after/80-home-returning.png`, `after/81-nav-asset-returning.png`: NAV page "Ready to trade 300" |

## T7 — Multiple operations

A NAV → USDC swap waiting for its deposit and a USDC → NAV swap started on top: both run, Activity lists both, the tray reads "2 operations in progress" with the most urgent one's status underneath (`after/97-activity-two-operations.png`, `after/98-tray-two-operations.png`). A second operation that would need the same unfinished setup is refused with "Your trading account is being set up…".

## T8 — Receive into trading / Bring NAV back / diagnostics

`after/86…89` (not ready → one button → process → address shown), `after/92-bring-nav-back-empty.png`, `after/90-trading-account-diagnostics.png`.
