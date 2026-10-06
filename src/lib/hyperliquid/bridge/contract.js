import { getHyperEvmPublicClient, getHyperEvmWalletClient } from "./client";
import { BRIDGE_CONTRACT_ADDRESS } from "./config";

// Minimal ABI — only what this app calls. Function names/selectors were
// cross-checked against the live contract via eth_call before writing this
// (paused/minBurnValue/decimals/symbol/name/coreUserExists all resolve, and
// minBurnValue() returns exactly 100000000 as documented) — the contract
// itself is unverified on HyperEVMScan, so this is the closest thing to a
// source of truth available.
const BRIDGE_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "coreUserExists", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "bool" }] },
  // Found by eth_call probing (true for addresses seen in the bridge's own
  // registration events, false otherwise). The watchtower only watches deposit
  // addresses of registered users — coreUserExists alone is NOT enough.
  { type: "function", name: "isRegistered", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "register", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "minBurnValue", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "burnWithNote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "value", type: "uint256" },
      { name: "note", type: "string" },
    ],
    outputs: [],
  },
  { type: "error", name: "SenderNotActivated", inputs: [] },
  { type: "error", name: "BelowMinimum", inputs: [] },
  { type: "error", name: "InvalidNoteLength", inputs: [] },
  { type: "error", name: "BurnerNotActivated", inputs: [] },
];

export async function readCoreUserExists(address) {
  const client = getHyperEvmPublicClient();
  return client.readContract({
    address: BRIDGE_CONTRACT_ADDRESS,
    abi: BRIDGE_ABI,
    functionName: "coreUserExists",
    args: [address],
  });
}

/** True once the address has called register(); only then are its deposits credited. */
export async function readIsRegistered(address) {
  const client = getHyperEvmPublicClient();
  return client.readContract({
    address: BRIDGE_CONTRACT_ADDRESS,
    abi: BRIDGE_ABI,
    functionName: "isRegistered",
    args: [address],
  });
}

/** Upper bound on the HYPE (wei) register() needs for gas, with headroom. */
export async function estimateRegisterGasCost(account) {
  const client = getHyperEvmPublicClient();
  const gasPrice = await client.getGasPrice();
  let gas = 150_000n;
  try {
    gas = await client.estimateContractGas({
      address: BRIDGE_CONTRACT_ADDRESS,
      abi: BRIDGE_ABI,
      functionName: "register",
      account,
    });
  } catch {
    // Estimation can fail with a zero balance; fall back to the fixed bound.
  }
  return (gas * gasPrice * 3n) / 2n;
}

export async function readMinBurnValue() {
  const client = getHyperEvmPublicClient();
  return client.readContract({ address: BRIDGE_CONTRACT_ADDRESS, abi: BRIDGE_ABI, functionName: "minBurnValue" });
}

export async function readPaused() {
  const client = getHyperEvmPublicClient();
  return client.readContract({ address: BRIDGE_CONTRACT_ADDRESS, abi: BRIDGE_ABI, functionName: "paused" });
}

export async function readNavEvmBalance(address) {
  const client = getHyperEvmPublicClient();
  return client.readContract({
    address: BRIDGE_CONTRACT_ADDRESS,
    abi: BRIDGE_ABI,
    functionName: "balanceOf",
    args: [address],
  });
}

export async function readHypeBalance(address) {
  const client = getHyperEvmPublicClient();
  return client.getBalance({ address });
}

/** Activates the caller's HyperCore account. Costs HYPE gas; only needs to happen once. */
export async function registerCoreUser(account) {
  const client = getHyperEvmPublicClient();
  const wallet = getHyperEvmWalletClient(account);
  const { request } = await client.simulateContract({
    address: BRIDGE_CONTRACT_ADDRESS,
    abi: BRIDGE_ABI,
    functionName: "register",
    account,
  });
  const hash = await wallet.writeContract(request);
  return client.waitForTransactionReceipt({ hash });
}

/** Burns `valueRaw` (base units, 8 decimals) on HyperEVM with an encrypted withdrawal note. Costs HYPE gas. */
export async function burnWithNote(account, valueRaw, noteBase64) {
  const client = getHyperEvmPublicClient();
  const wallet = getHyperEvmWalletClient(account);
  const { request } = await client.simulateContract({
    address: BRIDGE_CONTRACT_ADDRESS,
    abi: BRIDGE_ABI,
    functionName: "burnWithNote",
    args: [valueRaw, noteBase64],
    account,
  });
  const hash = await wallet.writeContract(request);
  return client.waitForTransactionReceipt({ hash });
}

const KNOWN_REVERTS = ["SenderNotActivated", "BelowMinimum", "InvalidNoteLength", "BurnerNotActivated"];

/** Maps a viem contract error to one of this app's own error codes — same convention as lib/evm/swapMath.js's mapErrorCode. */
export function mapBridgeError(e) {
  const passthrough = [
    "wallet_locked",
    "network_error",
    "bridge_paused",
    "no_hype_for_gas",
    "invalid_amount",
    "below_minimum",
    "insufficient_balance",
    "rate_limited",
    "nothing_to_move",
    "hype_move_timeout",
  ];
  if (passthrough.includes(e?.message)) return e.message;

  const text = String(e?.shortMessage || e?.details || e?.message || e || "");
  for (const name of KNOWN_REVERTS) {
    if (text.includes(name)) return name;
  }
  if (/user rejected/i.test(text)) return "user_rejected";
  if (/insufficient funds/i.test(text)) return "no_hype_for_gas";
  return "unknown";
}
