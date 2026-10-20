# 6. Everything currently under "Advanced" (and the bridge pages it links to)

| Item | Where | Classification | Decision |
|---|---|---|---|
| Move to exchange / Bring back to wallet | NAV → Advanced | **Truly advanced** (explicit placement; Swap does it on its own) | Keep under Advanced, renamed "Move NAV to trading" / "Bring NAV back to wallet"; both run through the same intent engine (`planMove`) so setup is handled automatically there too. |
| Order book (limit orders) | NAV → Advanced, Swap → "Advanced trading" | **Truly advanced** | Keep. Add "Add NAV to trading" link when the balance is 0. |
| Hyperliquid transfer (send/receive within the exchange) | NAV → Advanced → `/hl/asset/NAV` | **User-facing but niche** | Keep under Advanced as "Transfer within Hyperliquid". |
| Bridge deposit address (`/bridge/deposit`) | NAV → Advanced | **Required prerequisite + troubleshooting mixed** | Split: (a) the one-time setup becomes an automatic requirement of Swap / Move / Receive-via-bridge; (b) the page becomes "Receive NAV from another wallet into trading" — shows the address once the account is ready, otherwise starts the setup process. |
| "Activate" button (bridge `register()`) | `/bridge/deposit` | **Required prerequisite** | Removed as a manual button. Runs automatically inside any process that needs it. Status shown under *Trading account* diagnostics. |
| "Get USDC + HYPE with NAV" (faucet purchase) | `/bridge/deposit` | **Required prerequisite (with cost)** | Removed as a manual button. Becomes the "Set up trading account (28.88 NAV, once)" step, approved in Review. |
| Manual bridge withdrawal (`/bridge/withdraw`) with "Move to HyperEVM" | NAV → Advanced | **Advanced + troubleshooting** | Becomes "Bring NAV back to any Navio address" using `planMove('toWallet')` with a custom destination; HyperEVM/HyperCore split moves to *Technical details*. |
| Explanation text ("NAV on the exchange is … Wrapped Navio …") | NAV → Advanced | **Education** | Keep, shortened, under Advanced. |
| Faucet URL | Settings | **Developer / operator** | Move under a collapsed "Developer" group in Settings. |
| Slippage, transaction deadline, EVM network | Settings | **Advanced** | Keep. |
| Trading account status (account exists, registered, gas, deposit address, EVM address, balances on Core/EVM) | nowhere today (spread over bridge pages) | **Troubleshooting / diagnostics** | New read-only "Trading account" sheet under NAV → Advanced. |
