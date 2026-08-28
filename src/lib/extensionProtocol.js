// Shared message-shape constants between the inpage provider, content script,
// background service worker and the popup approval views. Kept dependency-free
// (no Vue/WXT imports) so it can be pulled into any of those contexts.

export const PROVIDER_CHANNEL = "navio-provider";
export const CONTENT_CHANNEL = "navio-content";

export const MESSAGE_TYPE = {
  PROVIDER_REQUEST: "navio:provider-request",
  GET_PENDING_REQUEST: "navio:get-pending-request",
  RESOLVE_REQUEST: "navio:resolve-request",
  REJECT_REQUEST: "navio:reject-request",
};

// dApp-facing RPC methods. nav_requestAccounts has its own dedicated view
// (ConnectRequest.vue); the asset methods below are executed generically by
// ApproveRequest.vue via src/lib/navioRpcExecutors.js. SIGN_TRANSACTION /
// APPROVE_NFT_TRANSFER remain placeholders for future work.
export const RPC_METHOD = {
  REQUEST_ACCOUNTS: "nav_requestAccounts",
  SIGN_TRANSACTION: "nav_signTransaction",
  APPROVE_NFT_TRANSFER: "nav_approveNftTransfer",
  CREATE_TOKEN_COLLECTION: "nav_createTokenCollection",
  CREATE_NFT_COLLECTION: "nav_createNftCollection",
  CREATE_TOKEN_COLLECTION_AND_MINT: "nav_createTokenCollectionAndMint",
  MINT_TOKEN: "nav_mintToken",
  SEND_TOKEN: "nav_sendToken",
  GET_TOKEN_BALANCE: "nav_getTokenBalance",
  GET_ASSET_BALANCES: "nav_getAssetBalances",
  GET_TOKEN_BALANCES: "nav_getTokenBalances",
  GET_NFT_BALANCES: "nav_getNftBalances",
};

// Maps an RPC method to the popup route that should render its approval UI.
// Add an entry here + a view under src/views/extension when implementing a
// new approval flow (signTransaction, NFT approval, ...).
export const APPROVAL_ROUTE_BY_METHOD = {
  [RPC_METHOD.REQUEST_ACCOUNTS]: "connect",
};

export const DEFAULT_APPROVAL_ROUTE = "approve";

export const ERROR_CODE = {
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
};

export function approvalRouteForMethod(method) {
  return APPROVAL_ROUTE_BY_METHOD[method] ?? DEFAULT_APPROVAL_ROUTE;
}
