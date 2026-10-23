# Changelog

## Unreleased

### Added
- A seed phrase or master seed copied from the seed screen or Backup is wiped from the clipboard after 60 s, and as soon as the screen is left; the copy message says so. Backup also forgets what it revealed when the page is left
- **Password guessing brake**: after five wrong passwords for a wallet, every further try waits 30 s, then 1, 2, 4 … up to 15 minutes, at every prompt (wallet list, lock screen, spend confirmation, biometric enrolment, extension windows). Only typed passwords count; the wait survives a reload and clears on a correct password
- Create / import wallet refuses passwords that are a common word with digits and a symbol glued on ("Password123!", "Navio2026!"), digit-only patterns, or the wallet's own name
- **Confirm before spending** (Settings → security): the password, or the fingerprint / face when enrolled, is asked for again right before a send, token / NFT send or mint, stake, unstake, swap, guided process (start and re-approval), payroll run, DEX swap, trading-account withdrawal or dApp request, even while the wallet is unlocked. Modes: every transaction (default), only at or above a NAV amount (amounts not in NAV always ask), off
- **Biometric unlock on Android** (Settings → security, off by default): the wallet password is kept in the Android Keystore behind the device's fingerprint / face check, so the lock screen and the wallet list can open the wallet without typing it. The password keeps working as the fallback; nothing changes for wallets where this is left off. Uses `@capgo/capacitor-native-biometric`
- **Auto-lock** (Settings → security): the open wallet locks after 1, 5, 15 or 30 minutes without input or in the background, or as soon as the app goes to the background; a lock screen asks for the password to continue, or lets you log out. Default 5 minutes. Sync keeps running while locked. Not applied while the password is remembered by *Keep wallet unlocked*
- Android: screenshots, screen recording and the app-switcher preview are blocked on the screens that show or take the seed phrase (create, verify, import, backup)

### Changed
- The create/import wizard passes the wallet name and password between its screens in memory only; the seed phrase of a new wallet is held in memory until it is verified (or skipped), then dropped. None of these are written to sessionStorage any more
- Creating or restoring a wallet without a password is refused at the store level (the screens already required one)
- A wallet is in the unlocked state right after it is created or restored, as it is after being opened
- Android: app data is excluded from system backups (`allowBackup=false`)

## 0.1.4-alpha

### Added
- **Transfer between accounts** on the NAV page, inside the balance card right under the wallet / trading breakdown: one sheet for both directions, with a flip button, each account's balance, and the network fee under the amount (paid on top going to trading; paid in HYPE from the trading account coming back)
- **Price chart ranges**: 1H, 1D, 1W, 1M, 3M, 1Y and All replace the candle-size buttons; each range picks the candle size that fills it (1 minute to 1 week). The gap since the last trade stays visible, and a range with no trades says so
- **Confirmations in progress**: while a deposit or the setup payment waits for the network, the process shows "2/3 confirmations" counted by the wallet, then "Confirmed on Navio, waiting for the bridge" — instead of a minute countdown that stuck at "1 min left"
- **View on Explorer** under every step of an operation that has a transaction: Navio sends on blocks.nav.io, HyperEVM calls on hyperevmscan.io
- *Bring NAV back* now runs until the bridge has actually paid the wallet, so it has a progress card and a tray entry like *Move NAV to trading*; the timeline ends with "NAV arrived in your wallet"
- Staking operators directory lives in this repo (`staking/operators.json`), with the format and review rules in `staking/README.md` and a test that rejects entries the app would drop

### Changed
- NAV page: the balance breakdown opens by default; Advanced follows the Send / Receive / Swap row and no longer carries the two "move it yourself" buttons (the transfer button replaces them)
- Network fee is computed the way navio-sdk charges it — 0.002 NAV per input and output, from the wallet's own outputs — instead of a flat 0.01 reserve. Max (transfer, swap, stake) is now exactly balance minus fee
- Guided-process copy (process pages, tray, Swap setup and blocker texts, Receive into trading, Bring NAV back, Trading account sheet, History rows) is translated into the other nine languages
- Non-English locales are loaded the first time they are chosen; English ships in the main chunk

### Fixed
- *Move NAV to trading* with Max failed with "Insufficient funds … fee" on wallets made of several outputs: the fee grows with the number of inputs (five inputs cost 0.014 NAV), which the flat reserve did not cover
- Max left 0.002 NAV behind: the SDK's input picker skips an output worth no more than the fee it adds. A send that empties the wallet now names every output
- The web build failed when the main chunk passed the service worker's 2 MiB precache limit

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
