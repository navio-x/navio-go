import { mnemonicToSeedSync } from "@scure/bip39";
import { HDKey } from "@scure/bip32";
import { toHex } from "viem";

// Ana thread'i bloklamamak için burada çalışır: mnemonicToSeedSync,
// 2048 turlu PBKDF2-HMAC-SHA512 çalıştırır ve yavaş telefonlarda UI'da
// hissedilir bir donmaya yol açabilir.
self.onmessage = (event) => {
  const { mnemonic, index } = event.data || {};
  try {
    if (!mnemonic) throw new Error("mnemonic_missing");
    const seed = mnemonicToSeedSync(mnemonic);
    const root = HDKey.fromMasterSeed(seed);
    // BIP44 EVM path: m/44'/60'/0'/0/{index}
    const child = root.derive(`m/44'/60'/0'/0/${index ?? 0}`);
    const privateKeyHex = toHex(child.privateKey);

    seed.fill(0);
    child.privateKey.fill(0);

    self.postMessage({ ok: true, privateKeyHex });
  } catch (err) {
    self.postMessage({ ok: false, error: err?.message || String(err) });
  }
};
