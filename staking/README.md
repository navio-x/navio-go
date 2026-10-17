# Staking operators directory

`operators.json` is the list of cold staking operators that Navio Go offers when you stake NAV. Every wallet reads it from:

```
https://raw.githubusercontent.com/navio-x/navio-go/refs/heads/main/staking/operators.json
```

A change shows up in wallets within a few minutes of being merged to `main`.

## Adding an operator

1. Run a staking node with your delegation key. On the machine that runs `navio-staker`:
   ```bash
   navio-staker -gendelegationkey
   ```
   This creates a key pair. The public key (96 hex characters) goes in this directory; the private key file stays on your staking server and is passed to the staker with `-delegationkeyfile`. See [docs.nav.io/node/cold-staking](https://docs.nav.io/node/cold-staking/) for the full setup.
2. Add an entry to `operators` in `operators.json`:
   ```json
   {
     "id": "my-operator",
     "name": "My Operator",
     "enabled": true,
     "default": false,
     "delegationKey": "<96 hex characters>",
     "feeBps": 500,
     "networks": ["mainnet"],
     "createdAt": "2026-10-17",
     "website": "https://example.com",
     "description": "One sentence about your operator."
   }
   ```
3. Run `npm test` and open a pull request.

## Fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique, lowercase, with hyphens |
| `name` | yes | Shown to users, up to 60 characters |
| `delegationKey` | yes | The delegation public key, 96 hex characters |
| `feeBps` | yes | Your fee in basis points, out of 10000: `500` = 5%, `0` = no fee |
| `networks` | yes | `mainnet`, `testnet`, or both |
| `createdAt` | yes | The date the entry was added, `YYYY-MM-DD` |
| `enabled` | no | `false` hides the operator. Delegations already made to it still show its name. Defaults to `true`. |
| `default` | no | Listed first and preselected when staking. Set only by maintainers, at most one per network. |
| `website` | no | Must be `https://` |
| `description` | no | Up to 200 characters |

## Review

Maintainers check that:
- the key belongs to a node the operator actually runs, and has not been listed before;
- the fee matches what the operator says publicly;
- `default` is not changed by an outside pull request.

Being listed is not an endorsement. Users can always paste any delegation key themselves.
