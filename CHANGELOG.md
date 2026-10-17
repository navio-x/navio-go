# Changelog

## 0.1.2-alpha

### Added
- **Cold staking** (navio-sdk 0.4.0) on the NAV asset page
  - Delegate NAV to a staking operator and unstake it again, all at once or in part
  - The staking summary is always visible, with **Staking Rewards** and **Delegations** tabs
  - Rewards view: 24H / 7D / 30D / 90D / 180D / 1Y ranges, total earned and a rewards chart
  - Delegations list showing each staked commitment's status (active / confirming), its operator, fee and website
  - Staked balance shown in the NAV balance breakdown
- **Staking operators directory**, loaded from `go.nav.io/staking/operators.json`
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
