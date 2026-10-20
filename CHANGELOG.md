# Changelog

## 0.1.3-alpha

### Added
- **Guided processes.** Swap, "Move NAV to trading", "Bring NAV back" and "Receive into trading" now state what they want, and Navio Go works out the prerequisites (one-time trading-account setup, bridge registration, moving NAV to trading), lists them with cost and time before Review, takes one approval and runs the steps as a process
- **Activity** page (More → Activity) and a page per operation: timeline with minutes left, approve / retry / stop, technical details (transaction ids, hashes, errors)
- A process tray above the navigation on every screen and a progress card on Home, Swap and the NAV page, so an operation is never out of sight
- Operations resume after a restart and are **verified on chain** before any interrupted send is repeated; the user is asked only when the outcome cannot be known
- A fresh approval is requested when the setup price moves more than 2 % after Review, instead of failing
- Several operations can run at once; funds reserved by one are kept out of the next plan, only the one-time setup is serialised
- History shows one row per finished operation with its technical steps underneath; the raw exchange rows it produced are folded in
- *Trading account* diagnostics sheet under NAV → Advanced (status, addresses, balances)
- Dev-only scenario harness (`src/dev/scenario.js`, inert in production builds) to exercise every account state without funds
- UX audit, architecture notes and before/after screenshots under `ux-audit/`

### Changed
- Swap shows the NAV you own ("Available" = wallet + trading account, with "In wallet · Ready to trade" underneath); Max is what can actually be swapped
- A wallet that cannot afford the setup or the 10 USDC exchange minimum is told the exact NAV needed and offered *Receive NAV*, instead of "Available: 0"
- Review lists every step and every payment it approves ("Confirm · approves 2 payments")
- NAV → Advanced: "Bridge deposit address" is now *Receive into trading from another wallet* and starts the setup process when needed; the manual Activate and faucet buttons are gone. "Manual bridge withdrawal" is *Bring NAV back to any address* and runs as a process
- Settings: Faucet URL moved under a collapsed Developer group
- Copy no longer uses HyperCore / HyperEVM / HYPE gas / register outside the technical details

### Removed
- The per-page operation card (`OperationCard.vue`), replaced by the process components

## 0.1.2-alpha

### Added
- **Cold staking** (navio-sdk 0.4.0) on the NAV asset page
  - Delegate NAV to a staking operator and unstake it again, all at once or in part
  - The staking summary is always visible, with **Staking Rewards** and **Delegations** tabs
  - Rewards view: 24H / 7D / 30D / 90D / 180D / 1Y ranges, total earned and a rewards chart
  - Delegations list showing each staked commitment's status (active / confirming), its operator, fee and website
  - Staked balance shown in the NAV balance breakdown
- **Staking operators directory** in `staking/operators.json`, read from GitHub so operators can be added by pull request
  - Operator picker with name, fee, networks and website
  - The default operator is listed first and preselected when staking
  - The `enabled` flag hides an operator; operators are filtered by network
  - The delegation key can be chosen from the list, pasted or scanned from a QR code
- **"How staking works" guide** (`/asset/NAV/staking`): rewards, delegation keys, the trust model, maturity, and a reward estimator
- **Transaction notifications**: a toast and a short sound for new transactions
  - Green for received, red for sent, violet for staking rewards
  - Toasts close on their own after 5 seconds; tapping one opens History
  - Sounds can be turned on or off in Settings
- **Pending transactions badge**: a yellow count on the History icon in the navbar

### Changed
- Send / Receive / Swap buttons on the NAV page are now tonal instead of primary blue
- Transactions the wallet sends appear within about 5 seconds: toast, badge and balance, without waiting for the next block
- Upgraded to navio-sdk ^0.4.0 and @nav-io/navio-blsct ^1.3.0

### Fixed
- Hyperliquid deposit and withdrawal, and NAV trading, are turned off on networks other than mainnet, because the NAV bridge runs only on mainnet
- Removed debug logs that exposed the mnemonic, encrypted metadata, outputs and balances
- Removed the extra blank space at the bottom of the NAV asset page

### Known limitations
- Incoming transactions are shown only once they are in a block (about 2 minutes on mainnet). The Electrum server can't report incoming transactions while they are still in the mempool.
