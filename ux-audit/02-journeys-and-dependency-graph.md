# 2. Current user journeys and the real dependency graph

## Journey A — wallet has 1 NAV, user opens Swap

Reproduced (`before/30-home-1nav.png` → `before/32-swap-1nav-available-0.png`, scenario `{ navWallet: 1 }`).

| Step | What the user sees | Why (code) |
|---|---|---|
| Home | **1 NAV** total | `usePortfolio().nav.total = wallet + staked + exchange + moving` (`src/composables/usePortfolio.js`) |
| Swap | **Available: 0** | `SwapView.vue` → `fromBalance = onExchange('NAV', state) = state.navExchange` (exchange only). The wallet part is deliberately excluded ("takes minutes, so it is never presented as available"). |
| Swap | no hint | `walletHint` is shown only when `walletExtra >= 1`; with 1 NAV, `spendable = 1 − 0.01 fee reserve = 0.99` → below the threshold → **nothing explains the 0**. |
| Swap, amount 1 | "Too small — the minimum is about 10 USDC worth (1 NAV when moving NAV)." | `quoteSell()` → `gross (0.04 USDC) < MIN_ORDER_USDC (10)` → `below_minimum`. The *real* blockers (setup cost 28.88 NAV, bridge minimum 1 NAV + 0.01 fee) are never evaluated because the quote fails first. |

What the user would actually need to do today to make that NAV swappable:

1. Discover that NAV must be "on the exchange" (NAV page → *Details*).
2. Discover the one-time setup: NAV → Advanced → *Bridge deposit address* → see "Activate your HyperCore account" → press *Get USDC + HYPE with NAV* → pay **28.88 NAV** (faucet quote: 1 USDC activation fee at the live NAV price) → wait ~3 confirmations (~6 min) → come back → press *Activate* (bridge `register()`, HYPE is moved Core→EVM for gas automatically).
3. Deposit ≥ **1 NAV** to the derived deposit address (another send, network fee on top) and wait 3 confirmations (~6 min).
4. Return to Swap: NAV is now "available". Order must still be worth ≥ **10 USDC ≈ 241 NAV**.

Counted for the manual route (as the UI exists today):

| | Manual route (Advanced) | Via Swap → Review (router already automates it) |
|---|---|---|
| Screens | 7 (Home, NAV, Advanced, Deposit NAV, Faucet modal, Deposit send modal, Swap) | 3 (Home/Swap, Review, Swap with card) |
| Taps/clicks | ≈ 14 | 4 (amount, Review, Route details, Confirm) |
| Hidden prerequisites to discover | 4 (account, gas, registration, bridge deposit) | 0 to discover, but 0 explained on the Swap screen itself |
| Advanced-menu interactions | 3 | 0 |
| Approvals (wallet sends signed) | 2 NAV sends + 1 EVM tx (register) | 1 confirm covers 2 NAV sends + 1 EVM tx |
| Waiting periods | 2 × ~6 min (faucet confirmations, deposit confirmations) | same, but tracked |

**The literal case is economically impossible today**: with exactly 1 NAV the user can neither pay the 28.88 NAV setup, nor meet the 1.01 NAV (deposit + fee) bridge minimum, nor the 10 USDC order minimum. The UX problem is that the app does not say so; it shows `0` and a wrong reason.

## Journey B — fresh wallet → first Hyperliquid swap (real dependency graph)

Discovered from `src/lib/intent/router.js`, `executors.js`, `lib/hyperliquid/bridge/*`, `lib/hyperliquid/faucet.js`, and the live faucet quote (`GET https://go.nav.io/faucet/quote` → `amountNav 28.88`, `payout 0.01 USDC + 0.001 HYPE`, `activationFeeUsdc 1`).

```
wallet open + synced ─────────────────────────────────────────────────────┐
  │                                                                       │
  ▼                                                                       │
EVM account derived from the mnemonic (m/44'/60'/0'/0/0) — automatic      │
  │                                                                       │
  ▼                                                                       │
Hyperliquid account exists? (bridge.coreUserExists)                       │
  │ no → FAUCET: send 28.88 NAV to the faucet address with memo           │
  │        "hl1:<evm>" ─► wait 3 Navio confirmations (~6 min) ─►          │
  │        faucet credits 0.01 USDC + 0.001 HYPE on HyperCore              │
  │        (the first credit *creates* the account)                        │
  ▼                                                                       │
HYPE for gas on HyperEVM? (readHypeBalance ≥ register gas estimate)       │
  │ no, but HYPE on HyperCore → sendAsset HYPE Core→EVM (automatic)       │
  ▼                                                                       │
Registered with the bridge? (bridge.isRegistered)                         │
  │ no → REGISTER: EVM tx register() — gas in HYPE, no NAV moves          │
  ▼                                                                       │
NAV on the exchange ≥ order size?                                         │
  │ no → DEPOSIT: wallet send of max(need, 1 NAV) to the per-account      │
  │        deposit sub-address (SPEC 1 derivation) ─► wait 3/6/24/48      │
  │        confirmations by size (~6 min for < 1,000 NAV) ─► credited     │
  ▼                                                                       │
ORDER: IOC limit order on NAV/USDC (≥ 10 USDC) — fills or nothing         │
  │ (two legs when neither side is USDC)                                  │
  ▼                                                                       │
(optional, when buying NAV) deliver to the wallet:                        │
  sendAsset NAV Core→EVM ─► wait EVM credit ─► burnWithNote(encrypted     │
  destination) — gas in HYPE ─► bridge pays out to the wallet (minutes)   │
```

Setup is **two** chain actions, not one ("activation" in the current UI = `register()`, which itself needs the faucet to have run), and the faucet payment is a *purchase* (1 USDC worth of NAV at the live price), not a free faucet.

## Hidden prerequisites (section 4 of the brief)

| Prerequisite | Required by | Detectable from | Automatic? | Needs consent? | Waiting | Resumable | Can fail | Recovery |
|---|---|---|---|---|---|---|---|---|
| EVM account derivation | everything Hyperliquid | `evmAddress` ref | yes | no (wallet already unlocked) | no | n/a | wallet locked | unlock |
| Hyperliquid account creation (faucet purchase) | register, any exchange balance | `coreUserExists` + HYPE > 0 | send is automatic after consent | **yes — 28.88 NAV leaves the wallet** | ~6 min | yes: coreExists/HYPE is authoritative; the NAV send is in wallet history (memo `hl1:<evm>`) | quote expired / price moved / send failed / faucet down | re-quote, re-approve if the price changed > 2 % |
| HYPE gas on HyperEVM | register, burn | `readHypeBalance` | yes (Core→EVM sendAsset) | no (no NAV moves, negligible) | ~1 min | yes | timeout | retry |
| Bridge registration | deposits credited, burns | `isRegistered` | yes | no NAV moves; costs HYPE gas (fractions of a cent) | seconds | yes (idempotent: checked first) | SenderNotActivated, no gas | wait for faucet / retry |
| NAV on the exchange | swap/sell, move-to-wallet | spot balance | deposit send automatic after consent | **yes — NAV leaves the private wallet, becomes public** | 6–96 min by size | yes: balance delta vs. baseline, wallet history | send failed, below minimum, bridge paused | retry / wait |
| ≥ 10 USDC order value, ≥ 1 NAV bridge minimum, fee reserve | swap, move | arithmetic | n/a | n/a | – | – | – | tell the user the real number up front |
| NAV on HyperEVM (for withdraw) | burn | `balanceOf` | yes (sendAsset) | no | ~seconds | yes | – | retry |
| Burn with note | deliver NAV to wallet | EVM receipt + wallet balance growth | yes after consent | yes (in review) | minutes | yes (payout watched by `settlePayouts`) | gas, paused | retry |
| Bridge not paused / mainnet | all bridge steps | `paused()`, network | – | – | – | – | – | block with reason |
