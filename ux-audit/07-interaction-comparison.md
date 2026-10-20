# 7. Interaction comparison

Counted on the running app (before: 0.1.2-alpha as audited; after: this branch), phone viewport, same simulated account states. "Discoveries" = things the user had to find out by themselves (which menu, which order, why a number is 0).

## Swap, brand-new account (nothing set up), enough NAV

| | Before | After |
|---|---|---|
| Screens | 3 (Swap, Review sheet, Swap with card) — *if* the user guessed that typing more than "Available: 0" works; otherwise 7 via NAV → Advanced → Bridge deposit → faucet → activate → deposit → Swap | 3 (Swap, Review sheet, process page) |
| Taps | 4 (amount, Review, Route details, Confirm) / ≈14 on the manual route | 3 (amount, Review, Confirm) |
| Manual prerequisite discovery | "Available: 0" with 400 NAV in the wallet; the setup is first mentioned inside Review as a table row | 0 — the Swap screen says "One-time setup needed … 28.88 NAV once · about 6 min · Total 328.88 NAV" before Review |
| Approvals | 1 confirm (covering 2 NAV sends + 1 EVM tx, not stated as such) | 1 confirm, labelled "approves 2 payments", with every payment listed; a fresh approval only if the setup price moves > 2 % |
| Waiting periods | 2 (≈6 min each), progress visible only on Home/NAV/Swap | 2, visible on every screen (tray), on Home, and on the Activity page with minutes left |
| Advanced-menu interactions | 0 (automated route) / 3 (manual route) | 0 |
| After reload | resumes, but the user must find the card | resumes; tray + Activity badge; interrupted sends verified on chain, no question asked when the answer is known |

## Swap, returning user (account ready, NAV already in trading)

| | Before | After |
|---|---|---|
| Screens / taps | 2 / 3 | 2 / 3 |
| Visible balance | "Available: 300" (trading only; 100 in the wallet not counted, hint paragraph shown) | "Available: 400 · In wallet 100 · Ready to trade 300" |

## Swap, 1 NAV in the wallet (the reported problem)

| | Before | After |
|---|---|---|
| What the user sees | Home: `1 NAV`. Swap: `Available: 0`, no explanation. Amount 1 → "Too small — the minimum is about 10 USDC worth (1 NAV when moving NAV)." | Home: `1 NAV`. Swap: `Available: 1 · In wallet 1 · Ready to trade 0`. Amount 1 → "You need about 272 NAV in your wallet for this swap. You have 1 NAV. Trades must be worth at least 10 USDC — about 242 NAV at the current price." + **Receive NAV** |
| Way forward | none | one button |

## Receive NAV into trading from another wallet (ex "Bridge deposit address")

| | Before | After |
|---|---|---|
| Screens | 4 (NAV, Advanced, Deposit NAV, faucet modal) then come back later and press Activate (5th) | 3 (NAV → Advanced → Receive into trading → one button → process page) |
| Taps | ≈8, in an order the screen does not state | 4 |
| Discoveries | that the faucet must run before Activate; what HyperCore/HYPE are | 0 |
| Failure | "Your Hyperliquid Core account isn't activated yet." (pressing Activate first) | not possible |

## Bring NAV back to any address (ex "Manual bridge withdrawal")

| | Before | After |
|---|---|---|
| Screens / taps | 1 screen; HyperCore→HyperEVM "Move" button, then amount, destination, Withdraw, Confirm ≈ 6 taps + waiting between | 1 screen; amount, destination (own wallet prefilled), Review, Confirm = 3 taps; the move is a step of the process |
| Discoveries | HyperEVM vs HyperCore balances | 0 (under Technical details) |

## Where a process can be seen

| | Before | After |
|---|---|---|
| Home / NAV / Swap | card | card |
| Send, Receive, History, Settings, Assets, Markets… | nothing | tray (one line) |
| Dedicated page | none | Activity, with a per-operation page (timeline, approval/retry, technical details) |
| History | raw exchange rows only | one row per operation + technical steps; raw rows folded in |
