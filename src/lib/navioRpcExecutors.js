import { getNavioClient } from "@/stores/navio";
import { RPC_METHOD } from "@/lib/extensionProtocol.js";

// Registry of RPC methods executed generically by ApproveRequest.vue once a
// wallet is unlocked in the approval window. `mutating: true` methods move
// funds / mint assets and require an explicit user approval click; the
// read-only balance methods execute as soon as the wallet is ready.
//
// Params arrive from the dApp as plain JSON (no BigInt — postMessage/
// browser.storage.session round-tripping of BigInt isn't reliable across all
// browsers), so amounts/ids are accepted as string|number and converted here.
//
// Each mutating entry also carries a `describe(params)` that renders the
// literal navio-sdk call(s) it's about to make, so the approval screen can
// show the user exactly what will run instead of just raw JSON params.

function requireClient() {
  const client = getNavioClient();
  if (!client) throw new Error("Wallet not ready");
  return client;
}

function toBigInt(value, fieldName) {
  if (value === undefined || value === null) {
    throw new Error(`${fieldName} is required`);
  }
  return BigInt(value);
}

// --- code-preview helpers (display only, never used for execution) ---

// Wraps a string that should appear verbatim (e.g. a variable reference like
// `collection.collectionTokenId`) instead of being quoted as a JS string.
class RawCode {
  constructor(code) {
    this.code = code;
  }
}
function raw(code) {
  return new RawCode(code);
}

// BigInt(x) throws on garbage input; describe() runs before the user has
// approved anything (params may still be malformed), so fall back to showing
// the raw value tagged as invalid rather than crashing the confirm screen.
function safeBigInt(value) {
  if (value === undefined || value === null) return undefined;
  try {
    return BigInt(value);
  } catch {
    return raw(`/* invalid: ${JSON.stringify(String(value))} */`);
  }
}

function isValidIdentifier(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

function jsLiteral(value, indent = 0) {
  const pad = "  ".repeat(indent);
  const childPad = "  ".repeat(indent + 1);

  if (value instanceof RawCode) return value.code;
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "bigint") return `${value}n`;

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => `${childPad}${jsLiteral(v, indent + 1)}`).join(",\n");
    return `[\n${items}\n${pad}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return "{}";
    const body = entries
      .map(([k, v]) => `${childPad}${isValidIdentifier(k) ? k : JSON.stringify(k)}: ${jsLiteral(v, indent + 1)}`)
      .join(",\n");
    return `{\n${body}\n${pad}}`;
  }

  return String(value);
}

function callLiteral(method, argsObj) {
  return `client.${method}(${jsLiteral(argsObj ?? {})})`;
}

export const RPC_EXECUTORS = {
  [RPC_METHOD.GET_TOKEN_BALANCE]: {
    mutating: false,
    describe: (params) => `client.getTokenBalance(${jsLiteral(params?.tokenId)})`,
    async execute(params) {
      const tokenId = params?.tokenId;
      if (!tokenId) throw new Error("tokenId is required");
      const balance = await requireClient().getTokenBalance(tokenId);
      return { tokenId, balance };
    },
  },

  [RPC_METHOD.GET_ASSET_BALANCES]: {
    mutating: false,
    describe: () => "client.getAssetBalances()",
    async execute() {
      const balances = await requireClient().getAssetBalances();
      return { balances };
    },
  },

  [RPC_METHOD.GET_TOKEN_BALANCES]: {
    mutating: false,
    describe: () => "client.getTokenBalances()",
    async execute() {
      const balances = await requireClient().getTokenBalances();
      return { balances };
    },
  },

  [RPC_METHOD.GET_NFT_BALANCES]: {
    mutating: false,
    describe: () => "client.getNftBalances()",
    async execute() {
      const balances = await requireClient().getNftBalances();
      return { balances };
    },
  },

  [RPC_METHOD.CREATE_TOKEN_COLLECTION]: {
    mutating: true,
    describe: (params) =>
      callLiteral("createTokenCollection", {
        metadata: params?.metadata,
        totalSupply: safeBigInt(params?.totalSupply),
        selectedUtxos: params?.selectedUtxos,
      }),
    async execute(params) {
      return requireClient().createTokenCollection({
        metadata: params?.metadata,
        totalSupply: toBigInt(params?.totalSupply, "totalSupply"),
        selectedUtxos: params?.selectedUtxos,
      });
    },
  },

  // Convenience combo: create a token collection, then immediately mint the
  // first batch of tokens from it to `address`, in one approval. Equivalent
  // to calling CREATE_TOKEN_COLLECTION then MINT_TOKEN back to back with the
  // freshly-created collectionTokenId.
  [RPC_METHOD.CREATE_TOKEN_COLLECTION_AND_MINT]: {
    mutating: true,
    describe: (params) => {
      const createLine = `const collection = await ${callLiteral("createTokenCollection", {
        metadata: params?.metadata,
        totalSupply: safeBigInt(params?.totalSupply),
      })};`;
      const mintLine = `const mint = await ${callLiteral("mintToken", {
        address: params?.address,
        collectionTokenId: raw("collection.collectionTokenId"),
        amount: safeBigInt(params?.amount),
      })};`;
      return `${createLine}\n\n${mintLine}`;
    },
    async execute(params) {
      if (!params?.address) throw new Error("address is required");
      const client = requireClient();

      const collection = await client.createTokenCollection({
        metadata: params?.metadata,
        totalSupply: toBigInt(params?.totalSupply, "totalSupply"),
        selectedUtxos: params?.selectedUtxos,
      });

      const mint = await client.mintToken({
        address: params.address,
        collectionTokenId: collection.collectionTokenId,
        amount: toBigInt(params?.amount, "amount"),
      });

      return { collection, mint };
    },
  },

  [RPC_METHOD.CREATE_NFT_COLLECTION]: {
    mutating: true,
    describe: (params) =>
      callLiteral("createNftCollection", {
        metadata: params?.metadata,
        totalSupply: params?.totalSupply !== undefined ? safeBigInt(params.totalSupply) : undefined,
        selectedUtxos: params?.selectedUtxos,
      }),
    async execute(params) {
      return requireClient().createNftCollection({
        metadata: params?.metadata,
        totalSupply: params?.totalSupply !== undefined ? toBigInt(params.totalSupply, "totalSupply") : undefined,
        selectedUtxos: params?.selectedUtxos,
      });
    },
  },

  [RPC_METHOD.MINT_TOKEN]: {
    mutating: true,
    describe: (params) =>
      callLiteral("mintToken", {
        address: params?.address,
        collectionTokenId: params?.collectionTokenId,
        amount: safeBigInt(params?.amount),
        selectedUtxos: params?.selectedUtxos,
      }),
    async execute(params) {
      if (!params?.address) throw new Error("address is required");
      if (!params?.collectionTokenId) throw new Error("collectionTokenId is required");
      return requireClient().mintToken({
        address: params.address,
        collectionTokenId: params.collectionTokenId,
        amount: toBigInt(params.amount, "amount"),
        selectedUtxos: params.selectedUtxos,
      });
    },
  },

  [RPC_METHOD.SEND_TOKEN]: {
    mutating: true,
    describe: (params) =>
      callLiteral("sendToken", {
        address: params?.address,
        tokenId: params?.tokenId,
        amount: safeBigInt(params?.amount),
        memo: params?.memo,
        subtractFeeFromAmount: !!params?.subtractFeeFromAmount,
        selectedUtxos: params?.selectedUtxos,
      }),
    async execute(params) {
      if (!params?.address) throw new Error("address is required");
      if (!params?.tokenId) throw new Error("tokenId is required");
      return requireClient().sendToken({
        address: params.address,
        tokenId: params.tokenId,
        amount: toBigInt(params.amount, "amount"),
        memo: params.memo,
        subtractFeeFromAmount: !!params.subtractFeeFromAmount,
        selectedUtxos: params.selectedUtxos,
      });
    },
  },
};

export function getRpcExecutor(method) {
  return RPC_EXECUTORS[method] ?? null;
}

// Renders the literal navio-sdk call the approval screen is about to make,
// so the user sees actual code instead of a raw method name + JSON params.
// Falls back to a best-effort `client.<method>(params)` guess for any
// executor that hasn't defined its own describe().
export function describeRpcCall(method, params) {
  const executor = getRpcExecutor(method);
  if (executor?.describe) {
    try {
      return executor.describe(params ?? {});
    } catch (err) {
      console.error("describeRpcCall failed:", err);
    }
  }
  const sdkMethod = method?.replace(/^nav_/, "") ?? String(method);
  return callLiteral(sdkMethod, params ?? {});
}

// JSON.stringify throws on BigInt; the SDK returns bigint fields (balance,
// fee, nftId, ...) on almost every result. Recursively stringify them so the
// approval UI can display results and resolveRequest() can hand them back to
// the dApp over browser.runtime messaging.
export function serializeRpcValue(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeRpcValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = serializeRpcValue(val);
    }
    return out;
  }
  return value;
}
