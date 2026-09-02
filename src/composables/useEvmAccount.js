import { privateKeyToAccount } from "viem/accounts";
import { getNavioClient } from "@/stores/navio";
import { setEvmAddress } from "@/stores/evm";

// KRİTİK: private key hiçbir zaman ref()/reactive() içine konmaz — Vue
// devtools'ta görünür olur ve HMR anlık görüntüsüne sızabilir. Modül
// kapsamında düz bir değişkende tutulur; store'a yalnızca türetilmiş adres
// yazılır (bkz. stores/evm.js).
let _privateKeyHex = null;
let _worker = null;

function getWorker() {
  if (!_worker) {
    _worker = new Worker(new URL("../workers/evmDerive.worker.js", import.meta.url), {
      type: "module",
    });
  }
  return _worker;
}

function deriveInWorker(mnemonic, index) {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    const onMessage = (event) => {
      worker.removeEventListener("message", onMessage);
      if (event.data?.ok) resolve(event.data.privateKeyHex);
      else reject(new Error(event.data?.error || "derivation_failed"));
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({ mnemonic, index });
  });
}

// Mnemonic'e erişim için cüzdanın kendi yolunu kullanır — WalletBackup.vue'nun
// yaptığı gibi doğrudan keyManager'dan okur, ayrı bir şifre çözme/saklama
// mantığı icat etmez.
function readMnemonic() {
  const client = getNavioClient();
  if (!client) throw new Error("wallet_not_ready");
  const keyManager = client.getKeyManager();
  const mnemonic = keyManager?.getMnemonic();
  if (!mnemonic) throw new Error("wallet_locked");
  return mnemonic;
}

/**
 * BIP44 EVM türetmesi: m/44'/60'/0'/0/{index}. Navio cüzdanıyla aynı
 * mnemonic'ten türetilir, ayrı bir seed üretilmez — bu sayede aynı mnemonic
 * MetaMask'a import edildiğinde aynı adres çıkar.
 */
export async function deriveEvmAddress(index = 0) {
  const mnemonic = readMnemonic();
  _privateKeyHex = await deriveInWorker(mnemonic, index);
  const account = privateKeyToAccount(_privateKeyHex);
  setEvmAddress(account.address);
  return account.address;
}

// Yalnızca imza anında (Faz 2) çağrılır; sonucu hiçbir yerde önbelleğe
// alınmaz.
export function getEvmAccount() {
  if (!_privateKeyHex) return null;
  return privateKeyToAccount(_privateKeyHex);
}

// Cüzdan kilitlendiğinde türetilmiş anahtar hemen düşürülür.
export function lockEvmAccount() {
  _privateKeyHex = null;
}
