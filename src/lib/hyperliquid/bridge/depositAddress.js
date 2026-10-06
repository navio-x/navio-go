import { keccak256 } from "viem";
import { Scalar, PublicKey, SubAddrId, SubAddr, Address, AddressEncoding, setChain, BlsctChain } from "@nav-io/navio-blsct";
import { BRIDGE_AUDIT_KEY_HEX } from "./config";

const MASK_52_BITS = (1n << 52n) - 1n;

/**
 * Pure derivation of the Navio deposit (sub)address the bridge watches for a
 * given EVM address — SPEC 1. Verified against the known-good vector:
 * 0x6fd62A11edC46D0857f05719101E2986a788B748 → account 2441068302202369,
 * address 3470840645374836 → "nav1ja8p3krkcq37xt2n4fqx8x9xt5zhqar9yuej…".
 *
 * account/address are kept at 52 bits (not 32): navio-core reserves negative
 * account numbers (-1 change, -2 staking), so both must be non-negative, and
 * 52 bits is the largest width that still fits exactly in a JS number
 * (Number.MAX_SAFE_INTEGER is 2^53-1) — needed because SubAddrId.generate
 * takes plain numbers, not bigints. At 52 bits the self-collision birthday
 * bound is 2^52; at 32 bits it would be hours of GPU time, and a collision
 * locks the loser out of depositing.
 */
export function deriveDepositAddress(evmAddress, { network = "mainnet" } = {}) {
  const keyBytes = hexToBytes(BRIDGE_AUDIT_KEY_HEX);
  if (keyBytes.length !== 80) throw new Error("bridge audit key must be 80 bytes");

  const viewKey = Scalar.deserialize(bytesToHex(keyBytes.subarray(0, 32)));
  const spendPubKey = PublicKey.deserialize(bytesToHex(keyBytes.subarray(32, 80)));

  const rawAddr = hexToBytes(evmAddress.toLowerCase().replace(/^0x/, ""));
  if (rawAddr.length !== 20) throw new Error("evmAddress must be a 20-byte address");

  const h = hexToBytes(keccak256(rawAddr).slice(2));
  const account = Number(readUint64BE(h, 0) & MASK_52_BITS);
  const address = Number(readUint64BE(h, 8) & MASK_52_BITS);

  const subAddrId = SubAddrId.generate(account, address);
  const subAddr = SubAddr.generate(viewKey, spendPubKey, subAddrId);
  const dpk = subAddr.toDoublePublicKey();

  setChain(network === "mainnet" ? BlsctChain.Mainnet : BlsctChain.Testnet);
  const bech32mAddress = Address.encode(dpk, AddressEncoding.Bech32M);

  return { bech32mAddress, account, address };
}

function hexToBytes(hex) {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readUint64BE(bytes, offset) {
  let v = 0n;
  for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(bytes[offset + i]);
  return v;
}
