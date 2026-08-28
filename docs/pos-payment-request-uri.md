# `navio:` payment request URI — v1

This document specifies the QR-encoded payment request format produced by
Navio Go's Merchant/POS mode. It's the interoperability contract for anyone
who needs to *read* a Navio POS request without being Navio Go itself: other
Navio wallets, and the planned WooCommerce plugin (which needs to both
generate and verify these).

Reference implementation: `src/lib/pos/uriScheme.js`, `canonical.js`,
`merchantCrypto.js`, `requestId.js`, `address.js`.

## Shape

```
navio:<address>?v=1&amount=<nav>&label=<merchant>&id=<request_id>&exp=<unix_ts>&pk=<merchant_pubkey>&sig=<signature>
```

Example (address/label shortened for readability — see [Size budget](#size-budget) for real lengths):

```
navio:tnv1q...9x2k?v=1&amount=12.50000000&label=Cafe+Luna&id=3f9a1c2b7e4d0f88&exp=1700000300&pk=MCowBQYDK2VwAyEA...&sig=4f8e2a...
```

### Fields

| Field    | Meaning                                                              | Encoding |
|----------|-----------------------------------------------------------------------|----------|
| `<address>` | Path component (not a query param). Fresh, single-use Navio address, derived per request. | Bech32m, as produced by the wallet — used verbatim. |
| `v`      | Format version of this request. Always `1` for this spec.            | Decimal integer string. |
| `amount` | Requested amount, in NAV (not satoshis).                              | Fixed 8 decimal places, e.g. `12.50000000`. Never scientific notation. |
| `label`  | Merchant display name, shown to the customer before they approve.     | UTF-8 text, URL-encoded (`application/x-www-form-urlencoded` — spaces as `+` or `%20`, both valid on decode). Capped at 20 characters by the reference implementation (`MAX_LABEL_LENGTH`); a longer configured name is truncated for the wire format only. |
| `id`     | Request id, generated locally by the merchant device.                 | 16 lowercase hex chars (8 random bytes). Only needs to be unique within that merchant's own request list — used to match an incoming payment to the request that asked for it, not as a global identifier. |
| `exp`    | Expiry. A request must be rejected once this time has passed.         | Unix timestamp, **seconds**, decimal integer string. |
| `pk`     | The merchant's Ed25519 **public** signing key for this request.       | Raw 32 bytes, base64url, no padding. |
| `sig`    | Ed25519 signature over the canonical payload (see below).             | Raw 64 bytes, base64url, no padding. |

`pk` and `sig` are both **optional** — a URI missing either is a valid v1
request, just an *unsigned* one (see [Unsigned / legacy requests](#unsigned--legacy-requests)).

### Why `pk` travels in the URI

Ed25519 signatures are not key-recoverable (unlike, say, Ethereum's ECDSA
with a recovery id) — a device with no prior relationship to a given
merchant has no way to obtain that merchant's public key except by receiving
it. `pk` does **not** need to be part of the signed payload itself: verifying
`(pk, message, signature)` together already cryptographically binds all
three, so an attacker who substitutes a different `pk` simply fails
verification — they'd need the matching private key to produce a valid
signature under it.

### Why base64url, not hex

`pk` and `sig` are fixed-size binary values (32 and 64 bytes). Base64url
encodes 3 bytes as 4 characters versus hex's 2 characters per byte — roughly
25% shorter — which matters here because Navio's blsCT addresses are
themselves long (see below) and every character counts against reliable QR
scanning. `amount`, `label`, `id`, `exp` are left as plain decimal/hex/text
since they're either already short or need to stay human-legible.

## Canonicalisation (what actually gets signed)

The merchant signs a **fixed-order JSON object**, built the same way as the
existing payroll receipt format (`src/lib/payroll/receiptCanonical.js`) for
consistency across the codebase:

```json
{"formatVersion":"1","address":"<address>","amount":"<amount>","label":"<label>","id":"<id>","exp":"<exp>"}
```

Rules, all enforced by `canonical.js`:

- **Field order is fixed**: `formatVersion`, `address`, `amount`, `label`,
  `id`, `exp` — always in that order, never derived from input key order.
- **`amount`** is formatted as a decimal string with **exactly 8 decimal
  places** (`Number(amount).toFixed(8)`), e.g. `1` → `"1.00000000"`. Never
  trimmed, never scientific notation.
- **`exp`** is an integer string (`Math.trunc`) — no fractional seconds.
- **`label`** is the exact string that appears in the URI (already
  sanitised/truncated — see the `label` row above), not the merchant's full
  configured name if that's longer.
- The object is serialised via `JSON.stringify` on a literal with this exact
  key sequence; UTF-8 encode the resulting string to get the bytes that are
  signed/verified.
- `sig` = Ed25519 signature over those bytes, under the merchant's per-wallet
  merchant signing key (see below). `sig` itself and `pk` are **not** part of
  this payload.

A conforming implementation in any language must reproduce this exact JSON
text (same key order, same string formatting) from the URI's own visible
fields to get byte-identical input to signature verification. This is
intentionally a plain, explicit template — not "canonicalize an arbitrary
object" — so it's reproducible without relying on a particular language's
object/map ordering semantics.

## Merchant signing key

The signing key is **not** the wallet's spending key and never touches the
on-chain signing path. It's derived via HKDF-SHA256 from the wallet's master
seed, with its own domain-separation string, following the same pattern
already used for payroll's receipt-signing key
(`src/lib/payroll/receiptCrypto.js`):

- HKDF info: `"navio-merchant-v1"`
- HKDF salt: `"navio-merchant-signing-salt-v1"` (fixed, not random — the key
  must be reproducible from the same seed on every device)
- Output: 32 bytes → Ed25519 keypair (native WebCrypto)

Because it's derived deterministically from the seed, the same wallet
produces the same merchant public key across devices/reinstalls (restoring
from the same mnemonic recovers the same merchant identity, which matters
for [trust-on-first-use](#unsigned--legacy-requests) on the scanning side).

## Address

The `<address>` is a **fresh, single-use** address, derived per request —
never a shared/static address. Reference implementation
(`src/lib/pos/address.js`) calls the wallet's existing HD sub-address
derivation (`KeyManager.generateNewSubAddress()` /
`getSubAddressBech32m()` in `navio-sdk`), the same primitive the ordinary
Receive screen could use but currently doesn't (it always asks for a fixed
`{account: 0, address: 0}`). POS requests use a separate account index
(`POS_ACCOUNT_INDEX = 1`) so merchant addresses are never mixed with the
wallet's regular receive address.

## Size budget

QR codes need to stay reasonably dense-free to scan reliably at typical
counter distance in poor lighting. Target: **under 400 characters** for the
whole URI.

Navio's blsCT addresses are long — a mainnet/testnet bech32m sub-address is
**166 characters** (3-char HRP + separator + 154 data characters + 8-char
checksum; regtest is 167), roughly 4x a Bitcoin bech32 address, because it
encodes a double public key (spend + view). That alone is over 40% of the
400-character target before any query parameters. Measured (not estimated —
see `uriScheme.test.js`'s "size budget" suite) with a real-length address:

| Scenario | Amount | Label | Total length |
|---|---|---|---|
| Typical (short label, small amount) | `12.5` | `Cafe Luna` (9 chars) | **384** |
| Worst realistic case (max label, max amount) | `9999.99999999` | 20 `A`s (`MAX_LABEL_LENGTH`) | **397** |

Both fit under 400, but only just — 3 characters of headroom in the worst
case. Two things keep real requests under budget:

- **`label` is capped at 20 characters** in the wire format
  (`MAX_LABEL_LENGTH`), regardless of how long the merchant's configured
  display name is. The full name is still what's stored in local merchant
  records — only the QR-encoded value is shortened.
- **`amount` and `pk`/`sig` use base64url**, not hex, for the same reason.

`buildPaymentRequestUri()` always returns the URI it built along with its
length and an `overBudget` flag — callers should surface that to the
merchant rather than silently failing, since a very large amount combined
with a maximum-length label can still occasionally exceed 400 characters.

If a future version needs to add fields, re-check this budget first — there
is very little headroom left.

## Expiry

A request must be rejected by the scanning wallet once `exp` (unix seconds)
has passed, with a message that clearly says the request expired — not a
generic error. See Part 5/Part 3 for the actual expired/late-payment UX;
this document only defines the field.

## Unsigned / legacy requests

A URI with `v` unset, or missing `pk`/`sig`, is still a valid request under
this spec — just unsigned. A scanning wallet **must still allow payment**
against it, but must mark the merchant details (label, identity) as
**unverified** rather than silently treating it as equivalent to a signed
request. This covers requests from an older/simpler implementation that
hasn't adopted signing yet.

## Trust-on-first-use (scanning side)

This spec defines the wire format and its signature only. It makes **no
claim about merchant identity** beyond "this request was signed by whoever
holds the private key matching `pk`" — there is no registry, no
certificate authority, no verification that a given `pk` actually belongs to
the business named in `label`. A scanning wallet is expected to implement
trust-on-first-use: remember `(label, pk)` pairs it has paid before, and
warn (not silently accept) if a previously-seen label ever arrives signed by
a different key. See `src/lib/payroll/issuerKeys.js` for the equivalent
pattern already used for payroll receipts.
