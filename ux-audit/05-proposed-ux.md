# 5. Proposed UX (before implementation)

## Swap — returning user (everything set up)

```
Swap                                   Advanced trading
┌─────────────────────────────────────┐
│ From                 Available: 312  │   ← economic balance: wallet + trading
│ 300                       [N NAV ▾]  │
│ ≈ $12.44                             │
│ In wallet 12 · Ready to trade 300    │   ← secondary, where it is
└─────────────────────────────────────┘
                 (⇅)
┌─────────────────────────────────────┐
│ To                                   │
│ ≈ 12.43                [$ USDC ▾]    │
└─────────────────────────────────────┘
 1 NAV ≈ 0.0414 USDC
[            Review            ]
```
Review → Confirm → process card "Swap 300 NAV → USDC · Swapping…" → done in seconds.

## Swap — new user (nothing set up), 400 NAV in the wallet

Same screen; amount 300. Under the rate, **before** Review:

```
┌ One-time setup needed ─────────────────────────────┐
│ Your trading account hasn't been set up yet.        │
│ Navio Go does it for you as part of this swap:      │
│   • Set up trading account      28.88 NAV, once     │
│   • Move 300 NAV to trading     ~6 min              │
│ Total from your wallet: 328.89 NAV   [How it works] │
└─────────────────────────────────────────────────────┘
[            Review            ]
```
Review sheet:

```
Review swap
You send 300 NAV  →  You receive ≈ 12.43 USDC
Rate · Exchange fee · Minimum received · Arrives in about 12 min

One-time setup required
Your trading account has not been configured yet. Navio Go
will set it up before executing this swap.
  1. Set up trading account        28.88 NAV (once)
  2. Register with the bridge      automatic
  3. Move 300 NAV to trading       ~6 min
  4. Swap 300 NAV → USDC
Total leaving your wallet: 328.89 NAV + network fees
▸ Setup details (technical)
[ Confirm — approve 2 payments ]
```

## Swap — 1 NAV in the wallet (the reported case)

```
From                              Available: 1
1                                  [N NAV ▾]
In wallet 1 · Ready to trade 0

┌ Not enough NAV for this swap ──────────────────────┐
│ Swapping NAV needs a one-time setup (28.88 NAV)    │
│ and a trade worth at least 10 USDC (≈ 241 NAV).    │
│ You have 1 NAV.           [Receive NAV]            │
└────────────────────────────────────────────────────┘
```
No `0`, no protocol words, one honest sentence, one way forward.

## Process timeline (Activity → detail, and the card)

```
Preparing your swap                              3 of 6
300 NAV → ≈ 12.43 USDC

●──── Set up trading account           done · 28.88 NAV sent
│
●──── Register with the bridge         done
│
◉──── Move 300 NAV to trading          waiting for 3 confirmations · ~4 min left
│     Sent from your wallet. You can leave this screen;
│     Navio Go keeps tracking it.
○──── Swap 300 NAV → USDC
○──── Done

[ Stop ]                                   ▸ Technical details
```
Approval state:
```
!──── Set up trading account           needs your approval
      The setup price changed since you reviewed it:
      29.40 NAV instead of 28.88 NAV. No NAV has been sent.
      [ Approve 29.40 NAV ]  [ Stop ]
```
Failed state:
```
×──── Move 300 NAV to trading          failed
      The wallet couldn't send this transaction.
      Nothing was sent; finished steps are kept.
      [ Retry ]  [ Stop ]        ▸ Details (raw error)
```

## Global tray (every page, above the bottom nav)

```
┌──────────────────────────────────────────────┐
│ ◌ Preparing your swap · 3/6                  │
│   Waiting for your deposit · ~4 min     View ▸│
└──────────────────────────────────────────────┘
```
Variants: `! Needs your approval`, `× Needs attention`, `2 operations in progress`.

## Home

```
Total balance                [Switch wallet]
$17.05
412 NAV

┌ Preparing your swap · 3/6 ───────────── View ▸ ┐
│ Waiting for your deposit · ~4 min               │
└─────────────────────────────────────────────────┘
Assets | Markets | NFTs
```

## NAV page

- "Total 412 NAV" then **Where it is**: In your wallet 112 · Ready to trade 300 · On the way 0.
- Actions: Send / Receive / Swap.
- Advanced (collapsed): Move NAV to trading, Bring NAV back, Order book, Transfer within Hyperliquid, Receive into trading from another wallet, Trading account (diagnostics).

## Receive into trading from another wallet (ex "Bridge deposit")

- Account ready → address + QR + confirmations table.
- Not ready → "To receive NAV into your trading account it needs a one-time setup (28.88 NAV). [Set up now]" → same process engine.

## Bring NAV back to any address (ex "Manual bridge withdrawal")

Amount + destination (defaults to own wallet) → Review (same sheet) → process (Move to HyperEVM → Send to your wallet) with the technical split under details.

## History

```
Today
 ⇄ Swap NAV → USDC            +12.33 USDC
    Done · 12:41               −300 NAV
    ▾ Technical steps: setup payment (tx …), register (0x…), deposit (tx …), order (fill …)
```
Raw Hyperliquid fills/ledger rows that belong to an operation are folded into it; the *Hyperliquid* filter still shows everything raw.

## Mobile

Everything above is designed at 390 px: tray is one line + chevron, detail page is a full page (no sheet on sheet), approve button sits directly under the step that needs it.
