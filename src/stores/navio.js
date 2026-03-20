import { ref } from "vue";
import blsctWasmUrl from "navio-blsct/wasm/blsct.wasm?url";
import blsctJsUrl from "navio-blsct/wasm/blsct.js?url";
import { IDB_PREFIX } from "@/stores/wallet_management";
import {
  addWalletToRegistry,
  removeWalletFromRegistry,
  getAllWallets,
  generateUniqueId,
  saveElectrumConfig,
  loadElectrumConfig,
  deleteWalletFull,
} from './wallet_management.js';
const _navioClient = ref(null);
const _mnemonicWords = ref([]);
const _sdkInitialized = ref(false);
const databaseAdapter = 'indexeddb';
const syncing = ref(false);
const percent = ref(0);
const walletName = ref("");
const walletHeight = ref(0);
const chainTip = ref(0);
const balance = ref("0");
const utxos = ref([]);
const receiveAddress = ref("");

export let NavioClient = null;
export let blsctLib = null;

export function getNavioClient() {
  return _navioClient.value;
}

export function getMnemonicWords() {
  return _mnemonicWords.value;
}

export function isSdkReady() {
  return _sdkInitialized.value;
}

export {
  syncing,
  percent,
  walletName,
  walletHeight,
  chainTip,
  balance,
  utxos,
  receiveAddress
};

export function isSyncing() {
  return syncing.value;
}

export function getSyncPercent() {
  return percent.value;
}

export function getWalletHeight() {
  return walletHeight.value;
}

export function getChainTip() {
  return chainTip.value;
}

export function getBalance() {
  return balance.value;
}

export function getUtxos() {
  return utxos.value;
}

export function getReceiveAddress() {
  return receiveAddress.value;
}

function isSSL() {
  return window.location.protocol === "https:";
}

function getPort() {
  return window.location.protocol === "https:" ? 50004 : 50005;
}

function loadBlsctFactory() {
  return new Promise((resolve, reject) => {
    if (window.BlsctModule) return resolve();

    const script = document.createElement("script");
    script.src = blsctJsUrl;
    script.onload = () => {
      const checkModule = setInterval(() => {
        if (window.BlsctModule) {
          clearInterval(checkModule);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(checkModule);
        if (!window.BlsctModule) {
          reject(new Error("BlsctModule timeout"));
        }
      }, 5000);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function initNavioSDK() {
  if (_sdkInitialized.value) {
    console.log("SDK already initialized ✅");
    return { NavioClient, blsctLib };
  }

  console.log("⚡ Initializing Navio SDK...");

  try {
    console.log("Loading blsct.js from:", blsctJsUrl);
    await loadBlsctFactory();
    console.log("blsct.js loaded ✅");
  } catch (err) {
    console.error("Failed to load blsct.js", err);
    throw new Error("Cannot load blsct.js.");
  }

  let blsct;
  try {
    console.log("Importing navio-blsct module...");
    blsct = await import("navio-blsct");
    console.log("navio-blsct imported ✅");
  } catch (err) {
    console.error("Failed to import navio-blsct", err);
    throw new Error("Cannot import navio-blsct module.");
  }

  let wasmModule;
  try {
    console.log("Fetching WASM binary from:", blsctWasmUrl);
    
    const wasmResponse = await fetch(blsctWasmUrl);
    
    if (!wasmResponse.ok) {
      throw new Error(`WASM fetch failed: ${wasmResponse.status} ${wasmResponse.statusText}`);
    }
    
    console.log("WASM response received, Content-Type:", wasmResponse.headers.get('Content-Type'));
    
    const wasmBinary = await wasmResponse.arrayBuffer();
    console.log("WASM binary fetched ✅ Size:", wasmBinary.byteLength, "bytes");
    
    console.log("Loading WASM module with binary...");
    wasmModule = await blsct.loadBlsctModule({
      wasmBinary: wasmBinary,
    });
    
    console.log("WASM module loaded ✅");
  } catch (err) {
    console.error("Failed to load WASM module", err);
    console.error("Error details:", err.message, err.stack);
    throw new Error(`Cannot load blsct wasm module: ${err.message}`);
  }

  try {
    if (!wasmModule.cryptoGetRandomValues && crypto?.getRandomValues) {
      wasmModule.cryptoGetRandomValues = (ptr, size) => {
        const buf = wasmModule.HEAPU8.subarray(ptr, ptr + size);
        crypto.getRandomValues(buf);
      };
    }
    
    console.log("Running sanity test...");
    const testScalar = new blsct.Scalar();
    console.log("WASM sanity test passed ✅", testScalar);
  } catch (err) {
    console.error("WASM sanity test failed", err);
    throw new Error(`WASM module failed sanity test: ${err.message}`);
  }

  blsctLib = blsct;

  try {
    console.log("Importing navio-sdk...");
    const sdk = await import("navio-sdk");
    NavioClient = sdk.NavioClient;
    console.log("navio-sdk imported ✅");
  } catch (err) {
    console.error("Failed to import navio-sdk", err);
    throw new Error(`Cannot import navio-sdk: ${err.message}`);
  }

  window.$navio = { NavioClient, blsctLib, wasmModule };
  _sdkInitialized.value = true;

  console.log("✅ Navio SDK READY");
  return { NavioClient, blsctLib };
}

async function updateWalletInfo() {
  if (!_navioClient.value) return;

  _navioClient.value.getBalanceNav()
  .then((raw) => {
    console.log(raw);
    const nav = Number(raw);
    console.log("Balance is : " + raw);
    if (!Number.isFinite(nav) || nav === 0) {
      balance.value = "0";
    } else {
      balance.value = nav;
    }
  })
  .catch((error) => {
    console.error("getBalanceNav hatası:", error);
    balance.value = "0";
  });

  _navioClient.value.getAllOutputs()
  .then((data) => {
    utxos.value = data.map((utxo) => ({
      ...utxo,
      amount: Number(utxo.amount),
      blockHeight: Number(utxo.blockHeight),
    }));
    console.log(utxos.value);
  })
  .catch((error) => {
    console.error("getUnspentOutputs hatası:", error);
  });
}

function updateReceiveAddress(network) {
  if (!_navioClient.value) return;
  
  const km = _navioClient.value.getKeyManager();
  if (km) {
    receiveAddress.value = km.getSubAddressBech32m(
      { account: 0, address: 0 },
      network || sessionStorage.getItem("network")
      );
    console.log("Receive address updated:", receiveAddress.value);
  }
}

function formatNAV(raw, decimals = 8) {
  const big = BigInt(raw)
  const divisor = BigInt(10) ** BigInt(decimals)

  const integer = big / divisor
  const fraction = big % divisor

  const fractionStr = fraction
  .toString()
  .padStart(decimals, "0")
  .replace(/0+$/, "")

  return fractionStr
  ? `${integer}.${fractionStr} NAV`
  : `${integer} NAV`
}

/* ---------- SYNC ---------- */
async function startSync() {
  syncing.value = true;
  console.log("Starting background sync...");
  updateWalletInfo();
  try {
    await _navioClient.value.startBackgroundSync({
      pollInterval: 10000,

      onProgress: (currentHeight, tip, blocksProcessed) => {
        walletHeight.value = currentHeight;
        chainTip.value = tip;
        
        if (tip > 0) {
          percent.value = Number(((currentHeight / tip) * 100).toFixed(2));
        } else {
          percent.value = 0;
        }
        
        console.log(
      `Syncing ${currentHeight}/${tip} (${percent.value}%) - ${blocksProcessed} blocks`
      );
      },
      
      onNewBlock: (height, hash) => {
        console.log(`New block ${height}: ${hash.slice(0, 16)}...`);
        updateWalletInfo();
      },

      onBalanceChange: (newB, oldB) =>
      {
        const diff = Number(newB - oldB) / 1e8;
        console.log("Old balance is : " + formatNAV(oldB));
        console.log("New balance is : " + formatNAV(newB));
      },

      onError: (e) => console.error(`Sync error: ${e.message}`),
    });
  } catch (e) {
    syncing.value = false;
    console.error(`Failed to start sync`, e);
  }
}

async function stopSync() {
  if (!_navioClient.value || !syncing.value) return;
  await _navioClient.value.stopBackgroundSync();
  syncing.value = false;
  console.log("Sync stopped");
}

export async function disconnectWallet() {
  if (!_navioClient.value) return;
  try {
    await _navioClient.value.disconnect();
  } catch (e) {
    console.error("Disconnect error:", e);
  }
  _navioClient.value = null;
  syncing.value = false;
}

export { stopSync };

export async function createWallet({
  wallet_name,
  network = "testnet",
  password,
} = {}) {
  if (!_sdkInitialized.value) {
    throw new Error("SDK not initialized!");
  }

  const client = new NavioClient({
    network,
    backend: "electrum",
    electrum: {
      host: network === "mainnet" ? "mainnet.nav.io" : "testnet.nav.io",
      port: getPort(),
      ssl: isSSL(),
    },
    databaseAdapter: databaseAdapter,
    walletDbPath: wallet_name,
    createWalletIfNotExists: true,
  });

  // initialize önce — başarısız olursa registry'e eklenmez
  await client.initialize();

  _navioClient.value = client;
  walletName.value=wallet_name;
  console.log("Wallet Ready ✅");

  const keyManager = client.getKeyManager();
  _mnemonicWords.value = keyManager
  .getMnemonic()
  .trim()
  .split(/\s+/);

  if (password)
  {
    try {
      await keyManager.setPassword(password);
      
      const params = keyManager.getEncryptionParams();
      const walletDb = client.getWalletDB();
      walletDb.saveEncryptionMetadata(params.salt, params.verificationHash);
      
      console.log('Wallet encrypted:', keyManager.isEncrypted());
      keyManager.lock();
      console.log('Wallet unlocked:', keyManager.isUnlocked());
    } catch (error) {
      console.error("Failed to set password:", error);
      throw new Error(`Password encryption failed: ${error.message}`);
    }
  }

  // Her şey başarılıysa registry'e ekle
  addWalletToRegistry({
    id: generateUniqueId(wallet_name),
    name: wallet_name,
    encrypted: !!password,
    createdAt: Date.now(),
  });

  sessionStorage.setItem("mnemonic", _mnemonicWords.value.join(" "));

  updateReceiveAddress(network);
  startSync();

  return {
    client,
    mnemonic_words: _mnemonicWords.value,
  };
}

export async function loadWallet({
  wallet_id,
  network = "testnet",
  password,
} = {}) {
  if (!_sdkInitialized.value) {
    throw new Error("SDK not initialized!");
  }

  const client = new NavioClient({
    network,
    backend: "electrum",
    electrum: {
      host: network === "mainnet" ? "mainnet.nav.io" : "testnet.nav.io",
      port: getPort(),
      ssl: isSSL(),
    },
    databaseAdapter: databaseAdapter,
    walletDbPath: wallet_id,
    createWalletIfNotExists: false
  });
  await client.initialize();
  const keyManager = client.getKeyManager();
  const walletDb = client.getWalletDB();
  const encMeta = await new Promise((resolve) => {
    resolve(walletDb.getEncryptionMetadata());
  });
  console.log(encMeta);
  if (encMeta) {
    keyManager.setEncryptionParams(encMeta.salt, encMeta.verificationHash);
    keyManager.lock();
    if (password) {
      const success = await keyManager.unlock(password);
      if (!success) {
        throw new Error("wrong_password");
      }
    }
  }
  console.log('Wallet encrypted:', keyManager.isEncrypted());
  console.log('Wallet unlocked:', keyManager.isUnlocked());
  _navioClient.value = client;
  console.log("Wallet loaded");
  walletName.value=wallet_id;

  // Update receive address
  updateReceiveAddress(network);

  startSync();
}

export async function restoreWallet({ wallet_name, network, mnemonic, startHeight, password }) {
  if (!mnemonic) throw new Error("Mnemonic required");

  const restoreHeight =
  startHeight !== undefined && startHeight !== null
  ? parseInt(startHeight, 10)
  : undefined;

  console.log(`Restoring wallet from mnemonic '${mnemonic}' (network: ${network} height: ${restoreHeight ?? "genesis"})...`);

  const clientConfig = {
    network,
    backend: "electrum",
    electrum: {
      host: network === "mainnet" ? "mainnet.nav.io" : "testnet.nav.io",
      port: getPort(),
      ssl: isSSL(),
    },
    databaseAdapter: databaseAdapter,
    walletDbPath: wallet_name,
    restoreFromHeight: restoreHeight,
    restoreFromMnemonic: mnemonic,
  };

  console.log(clientConfig);

  const client = new NavioClient(clientConfig);

  await client.initialize();

  _navioClient.value = client;

  const keyManager = client.getKeyManager();

  if (password) {
    try {
      await keyManager.setPassword(password);
      
      const params = keyManager.getEncryptionParams();
      const walletDb = client.getWalletDB();
      walletDb.saveEncryptionMetadata(params.salt, params.verificationHash);
      
      console.log('Wallet encrypted:', keyManager.isEncrypted());
      keyManager.lock();
      console.log('Wallet unlocked:', keyManager.isUnlocked());
    } catch (error) {
      console.error("Failed to set password:", error);
      throw new Error(`Password encryption failed: ${error.message}`);
    }
  }

  // Her şey başarılıysa registry'e ekle
  addWalletToRegistry({
    id: generateUniqueId(wallet_name),
    name: wallet_name,
    encrypted: !!password,
    createdAt: Date.now(),
  });

  console.log("Wallet restored ✅");

  updateReceiveAddress(network);
  startSync();

  return {
    client,
    mnemonic_words: mnemonic,
  };
}
export const txHistory = ref([]);
export async function refreshHistory() {
  if (!_navioClient.value) return;

  try {
    const outputs = await _navioClient.value.getAllOutputs();

    if (outputs.length === 0) {
      txHistory.value = [];
      return;
    }

    const txMap = new Map();

    const getOrCreate = (hash, height) => {
      let rec = txMap.get(hash);
      if (!rec) {
        rec = {
          txHash: hash,
          blockHeight: height,
          received: 0n,
          spent: 0n,
          memos: [],
          outputCount: 0,
          spentCount: 0,
        };
        txMap.set(hash, rec);
      }
      return rec;
    };

    for (const o of outputs) {
      const amt = BigInt(o.amount);

      const recv = getOrCreate(o.txHash, o.blockHeight);
      recv.received += amt;
      recv.outputCount++;
      if (o.memo) recv.memos.push(o.memo);

      if (o.isSpent && o.spentTxHash) {
        const sent = getOrCreate(o.spentTxHash, o.spentBlockHeight);
        sent.spent += amt;
        sent.spentCount++;
      }
    }

    const txList = [...txMap.values()].sort(
      (a, b) => b.blockHeight - a.blockHeight
      );

    txHistory.value = txList.map((tx) => {
      const net = tx.received - tx.spent;
      const hasRecv = tx.received > 0n;
      const hasSent = tx.spent > 0n;
      const isUnconfirmed = tx.blockHeight === 0;

      let type;
      if (hasRecv && hasSent) {
        type = net < 0n ? "sent" : "self";
      } else if (hasSent) {
        type = "sent";
      } else {
        type = "recv";
      }

      return {
        txHash: tx.txHash,
        blockHeight: tx.blockHeight,
        received: tx.received,
        spent: tx.spent,
        net,
        type,                          // 'recv' | 'sent' | 'self'
        memos: tx.memos,
        outputCount: tx.outputCount,
        spentCount: tx.spentCount,
        isUnconfirmed,
        navAmount: Number(net) / 1e8,
      };
    });
  } catch (e) {
    console.error("refreshHistory error:", e);
    txHistory.value = [];
  }
}