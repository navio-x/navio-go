# Navio Go — UX audit and redesign: guided processes

The central change: a user states what they want (swap, move NAV, receive into trading), Navio Go evaluates the account, lists the prerequisites it will handle, asks for one consent, runs the steps, and keeps the process visible and resumable everywhere until the original intent is complete.

| Document | What it covers |
|---|---|
| [01-screen-inventory.md](01-screen-inventory.md) | Every screen, its purpose, entry point, prerequisites, problems, screenshot |
| [02-journeys-and-dependency-graph.md](02-journeys-and-dependency-graph.md) | Journey A (1 NAV vs `Available: 0`, traced to code), Journey B (fresh wallet → first swap), the real dependency graph, hidden prerequisites table |
| [03-problem-inventory.md](03-problem-inventory.md) | P0–P3 problems with evidence and fix |
| [04-intent-and-process-architecture.md](04-intent-and-process-architecture.md) | Intents, requirements, the process state model, persistence, verification on resume, approvals, multiple operations, surfaces |
| [05-proposed-ux.md](05-proposed-ux.md) | The redesigned flows as wireframes (written before implementation) |
| [06-advanced-audit.md](06-advanced-audit.md) | What was under Advanced and where each item went |
| [07-interaction-comparison.md](07-interaction-comparison.md) | Screens / taps / discoveries / approvals, before vs after |
| [08-acceptance-tests.md](08-acceptance-tests.md) | The 1 NAV test, the inactive-account → swap test, interruptibility, failure, approval, states A–I, multiple operations |

## Screenshots

`before/` — the app as audited (fresh mainnet wallet; files 30+ use the scenario harness on the unchanged UI). `after/` — the redesign. Matching subjects:

| Subject | Before | After |
|---|---|---|
| Home with 1 NAV | `before/30-home-1nav.png` | `after/30-home-1nav.png` |
| Swap with 1 NAV | `before/32-swap-1nav-available-0.png`, `before/33-swap-1nav-amount.png` | `after/32-swap-1nav.png`, `after/33-swap-1nav-amount.png` |
| Swap needing setup | `before/36-swap-300-with-hint.png` | `after/42-swap-300-setup-needed.png` |
| Review with setup | `before/37-swap-review-setup.png`, `before/38-swap-review-route-details.png` | `after/43-review-top.png`, `after/44-review-bottom.png` |
| Process: waiting | `before/39-swap-operation-cards.png` (card 1) | `after/46-process-setup-waiting.png`, `after/51-process-deposit-waiting.png` |
| Process: failed | `before/39-…` (card 2) | `after/62-process-failed-step.png` |
| Process: interrupted | `before/39-…` (card 3) | `after/67-process-resumed-after-crash.png` (auto-verified), `after/68-process-interrupted-unknown.png` |
| Process: approval | — | `after/70-process-approval-needed.png` |
| Process: done | `before/39-…` (card 4) | `after/54-process-done.png`, `after/55-process-technical.png` |
| Process visible elsewhere | `before/42-send-no-process-visible.png` | `after/47-send-with-tray.png`, `after/48-home-with-process.png` |
| Process after reload | — | `after/49-home-after-reload.png`, `after/50-activity-list.png` |
| Activity page | — | `after/50-activity-list.png`, `after/64-activity-needs-you.png`, `after/97-activity-two-operations.png`, `after/99-activity-empty.png` |
| History | `before/41-history-with-ops.png` | `after/56-history-swap-row.png`, `after/57-history-swap-details.png` |
| Bridge deposit / Receive into trading | `before/13-bridge-deposit-not-activated.png`, `before/14-faucet-quote.png`, `before/15-bridge-activate-error.png` | `after/86-receive-into-trading-not-ready.png`, `after/87-…review.png`, `after/88-setup-only-process-done.png`, `after/89-receive-into-trading-ready.png` |
| Bridge withdraw / Bring NAV back | `before/16-bridge-withdraw.png` | `after/92-bring-nav-back-empty.png` |
| NAV page + Advanced | `before/10b-nav-asset-fresh-advanced.png` | `after/81-nav-asset-returning.png`, `after/90-trading-account-diagnostics.png` |
| Mobile 375 px | — | `after/m1-process-375.png`, `after/m2-swap-375.png`, `after/m3-home-375.png` |
| Desktop | `before-lowres/00-welcome-desktop.jpg` | `after/d1-home-desktop.png`, `after/d2-swap-desktop.png`, `after/d3-process-desktop.png` |
| Dark mode | (extension pass, `before-lowres/`) | `after/k1-process-dark.png`, `after/k2-swap-dark.png`, `after/k3-home-dark.png` |

## Reproducing the states (dev only)

With `npm run dev`, in the browser console:

```js
localStorage.uxScenario = JSON.stringify({ navWallet: 400 })               // fresh account, 400 NAV
localStorage.uxScenario = JSON.stringify({ navWallet: 400, coreExists: true, registered: true, hype: 0.001, sim: { failOnce: "deposit" } })
localStorage.removeItem("uxScenario")                                       // back to the real chain
```

See `src/dev/scenario.js` for every field (`sim.faucetMs`, `sim.creditMs`, `sim.crashOn`, …). The guard is the compile-time constant `import.meta.env.DEV`, so the harness is inert in production builds.
