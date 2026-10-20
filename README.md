# Navio Go

The all-in-one light wallet for the [Navio](https://nav.io) blockchain. Pay, trade, stake and chat from one self-custodial wallet, confidential by default. Navio Go sends and receives NAV without exposing your balance or transaction history on-chain. It runs on web, Android, iOS and as a browser extension, and your keys and data stay on your device.

- **Website:** [go.nav.io](https://go.nav.io)
- **Web wallet:** [go.nav.io/wallet](https://go.nav.io/wallet)
- **Android APK:** [go.nav.io/downloads/app-release.apk](https://go.nav.io/downloads/app-release.apk)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)
- **Issues:** [github.com/navio-x/navio-go/issues](https://github.com/navio-x/navio-go/issues)

No account, no sign-up, no backend and no telemetry. Navio Go talks directly to the Navio network.

## Features

### Wallet
- **Confidential by default.** Every transaction uses blsCT, which hides amounts while the network still verifies them.
- **HD wallet with a BIP39 backup.** Create a new 12-word recovery phrase, or restore from an existing one.
- **Password-protected.** Keys are encrypted on the device and unlocked with your password, with an optional "keep unlocked" period.
- **Backup** by revealing the recovery phrase or the seed, to restore the wallet on another device.
- **Multiple wallets** on one device.
- **Tokens and NFTs.** Hold, send and mint Navio tokens and NFTs alongside NAV.
- **Send, receive and history,** with QR scanning, pending transaction tracking and a pending count on the History icon.
- **Transaction notifications.** Toasts and a short sound for NAV received, sent and staking rewards. The sound can be turned off in Settings.
- **Networks.** Mainnet and testnet, with a network status screen.
- **Personalisation.** Light and dark themes, wallpapers, and 10 languages (English, Turkish, German, Spanish, French, Japanese, Korean, Brazilian Portuguese, Russian, Chinese).

### Cold staking
- Delegate NAV to a staking operator and earn rewards without running a node. The NAV stays in your wallet, and you can unstake all or part of it at any time.
- **Operator directory** read from [staking/operators.json](staking/operators.json) in this repo, so anyone can list an operator by pull request (see [staking/README.md](staking/README.md)). It shows each operator's name, fee and website, with the default operator preselected. A delegation key can also be pasted or scanned.
- **Staking Rewards** for 24H, 7D, 30D, 90D, 180D and 1Y, with totals and a chart.
- **Delegations:** every staked commitment with its status, operator and fee.
- **"How staking works" guide** covering rewards, delegation keys and the trust model, with a reward estimator.

### Trade and DeFi
Activity on Hyperliquid and BNB Smart Chain is public, unlike native NAV transfers. These features can be switched off in Settings; while they are off, the wallet makes no requests to either network.

- **Hyperliquid spot trading.** Limit and market orders on USDC pairs (NAV, BTC, ETH, SOL, HYPE, ZEC, AVAX), with a live order book, candlestick chart and recent trades.
- **Swap with guided setup.** Tell Navio Go what to swap; it works out what the trading account still needs (one-time setup, moving NAV to trading), lists it with cost and time, takes one approval and runs the steps as a process you can leave and come back to — visible on every screen and under More → Activity, resumed and verified after a restart.
- **Navio–Hyperliquid bridge.** NAV moves between the private wallet and the trading account through a custodial bridge, **mainnet only**; on other networks bridge and NAV trading are turned off. Receiving into trading from another wallet and bringing NAV back to any address are under the NAV page's Advanced section.
- **BNB Smart Chain account** derived from the same recovery phrase, with BNB and custom token balances.
- **On-chain token swaps** on BNB Smart Chain through PancakeSwap, with a slippage limit and a price-impact check.
- **Peer-to-peer swaps on Navio** *(experimental).* Request quotes anonymously or make a market with standing orders. Swaps settle atomically on-chain.
- **Markets on the home screen,** with live prices and 24-hour change.

### Private chat *(beta)*
- One-to-one and group chats, end-to-end encrypted, peer-to-peer over Navio's own network (navio-p2pmsg).
- Contact requests you can accept or reject.
- A chat identity derived from your recovery phrase, and history stored encrypted on your device only.
- Chat currently runs against test-network nodes.

### Business
- **Employer mode (payroll).** Batch salary and freelance payouts in one run, recipient management with CSV import, fiat amounts with a rate locked at send time, signed receipts for every payout, a receipt verifier, and CSV and PDF export.
- **Merchant mode (point of sale).** Enter an amount and show a QR code for the customer to scan and approve. Payment requests are signed and show the shop's name, and the confirmations required scale with the amount. Sales history is kept encrypted on the device. The request format is specified in [docs/pos-payment-request-uri.md](docs/pos-payment-request-uri.md).

### Browser extension
- Chrome, Firefox and Edge builds of the same wallet.
- Injects a `window.navio` provider for dApps, with an approval popup for every request: connect (`nav_requestAccounts`), token and NFT collection creation, minting, sending tokens and reading balances.
- A sample dApp is in [test-dapp/](test-dapp/).

## Development

Requires Node.js and npm.

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (vitest)
npm run build        # production build
npm run build:web    # build for the hosted web wallet
```

### Mobile (Capacitor)

```bash
npm run build:android && npm run cap:open:android
npm run build:ios && npm run cap:open:ios
```

### Browser extension (WXT)

```bash
npm run dev:extension:chrome       # or dev:extension:firefox
npm run build:extension:chrome     # or :firefox, :edge
npm run zip:extension:chrome       # or zip:extension:firefox
```

### Local regtest node

`npm run regtest` starts a `naviod` regtest node with p2p messaging from `../navio-core-build`, and `npm run regtest:stop` stops it.

### Configuration

| Variable | Purpose |
|---|---|
| `VITE_STAKING_OPERATORS_URL` | Overrides the staking operators directory (default: `staking/operators.json` on `main`, from `raw.githubusercontent.com`) |

## Built with

Vue 3, Vite, Tailwind CSS, Capacitor and WXT, on the Navio core team's libraries: [navio-sdk](https://github.com/nav-io/navio-sdk), navio-blsct and navio-p2pmsg.

## Community

Navio Go is built and maintained by volunteers from the Navio community. There is no company behind it and it is self-funded. Navio Go is self-custodial and never holds user funds. Bug reports and contributions are welcome on [GitHub](https://github.com/navio-x/navio-go).
