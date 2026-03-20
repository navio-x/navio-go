/**
 * wallet_management.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Navio Web Wallet — Wallet Registry Store
 *
 * localStorage ve IndexedDB üzerindeki tüm cüzdan yönetimi işlemlerini kapsar:
 *   - Registry okuma / yazma
 *   - Cüzdan ekleme, güncelleme, silme
 *   - Electrum sunucu ayarlarını kaydetme
 *   - IndexedDB veritabanını temizleme
 *   - Yardımcı: slugify
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'navio-web-wallet';
const IDB_PREFIX   = 'navio-wallet-';

/** @type {SavedConfig} */
const DEFAULT_ELECTRUM = {
  host: 'testnet.nav.io',
  port: 50005,
};

// ─── Tip tanımları (JSDoc) ────────────────────────────────────────────────────

/**
 * @typedef {Object} WalletEntry
 * @property {string}  id         - Benzersiz cüzdan kimliği (slugified isim)
 * @property {string}  name       - Kullanıcıya gösterilen isim
 * @property {boolean} encrypted  - Şifreli mi?
 * @property {number}  createdAt  - Unix timestamp (ms)
 */

/**
 * @typedef {Object} SavedConfig
 * @property {string} host - Electrum sunucu adresi
 * @property {number} port - Electrum port numarası
 */

/**
 * @typedef {Object} Registry
 * @property {WalletEntry[]} wallets   - Kayıtlı cüzdan listesi
 * @property {SavedConfig}   electrum  - Electrum bağlantı ayarları
 */

// ─── Registry: Okuma & Yazma ──────────────────────────────────────────────────

/**
 * localStorage'dan registry'yi okur.
 * Veri yoksa ya da parse hatası varsa varsayılan boş yapı döner.
 *
 * @returns {Registry}
 */
function loadRegistry() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* Bozuk veri varsa görmezden gel, varsayılanı döndür */
  }
  return {
    wallets: [],
    electrum: { ...DEFAULT_ELECTRUM },
  };
}

/**
 * Verilen registry nesnesini localStorage'a JSON olarak yazar.
 *
 * @param {Registry} reg
 */
function saveRegistry(reg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reg));
}

// ─── Cüzdan CRUD ──────────────────────────────────────────────────────────────

/**
 * Cüzdanı registry'ye ekler. Aynı id varsa önce kaldırır (upsert davranışı).
 *
 * @param {WalletEntry} entry
 */
function addWalletToRegistry(entry) {
  const reg = loadRegistry();
  // Aynı id'li kaydı çıkar (güncelleme senaryosu)
  reg.wallets = reg.wallets.filter((w) => w.id !== entry.id);
  reg.wallets.push(entry);
  saveRegistry(reg);
}

/**
 * Belirtilen id'ye sahip cüzdanı registry'den kaldırır.
 *
 * @param {string} id
 */
function removeWalletFromRegistry(id) {
  const reg = loadRegistry();
  reg.wallets = reg.wallets.filter((w) => w.id !== id);
  saveRegistry(reg);
}

/**
 * Tüm cüzdanları döner (oluşturulma tarihine göre yeniden eskiye sıralı).
 *
 * @returns {WalletEntry[]}
 */
function getAllWallets() {
  const reg = loadRegistry();
  return reg.wallets.slice().sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Tek bir cüzdanı id ile getirir; bulunamazsa null döner.
 *
 * @param {string} id
 * @returns {WalletEntry | null}
 */
function getWalletById(id) {
  const reg = loadRegistry();
  return reg.wallets.find((w) => w.id === id) ?? null;
}

/**
 * Registry'deki cüzdan sayısını döner.
 * Yeni cüzdan ismi üretirken kullanılır (ör. "Wallet 3").
 *
 * @returns {number}
 */
function getWalletCount() {
  return loadRegistry().wallets.length;
}

/**
 * Verilen isim için benzersiz bir id üretir.
 * Registry'de çakışma varsa timestamp eki ekler.
 *
 * @param {string} name
 * @returns {string}
 */
function generateUniqueId(name) {
  const base = slugify(name);
  const reg  = loadRegistry();
  const taken = new Set(reg.wallets.map((w) => w.id));
  if (!taken.has(base)) return base;
  return `${base}-${Date.now().toString(36)}`;
}

// ─── Electrum Ayarları ────────────────────────────────────────────────────────

/**
 * Electrum bağlantı ayarlarını kaydeder.
 *
 * @param {SavedConfig} cfg
 */
function saveElectrumConfig(cfg) {
  const reg = loadRegistry();
  reg.electrum = cfg;
  saveRegistry(reg);
}

/**
 * Kayıtlı Electrum ayarlarını döner.
 * Kayıt yoksa varsayılan değerleri döner.
 *
 * @returns {SavedConfig}
 */
function loadElectrumConfig() {
  return loadRegistry().electrum;
}

// ─── IndexedDB ────────────────────────────────────────────────────────────────

/**
 * Verilen cüzdan id'sine ait IndexedDB veritabanını siler.
 * Cüzdan tamamen silinirken kullanılır.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
function deleteWalletIDB(id) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(IDB_PREFIX + id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
    req.onblocked = () => resolve(); // Başka sekme açıksa bile devam et
  });
}

/**
 * Hem IndexedDB veritabanını hem de registry kaydını siler.
 * Silmeden önce kullanıcıya onay sormak çağıranın sorumluluğundadır.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteWalletFull(id) {
  await deleteWalletIDB(id);
  removeWalletFromRegistry(id);
}

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

/**
 * Cüzdan adını URL/IDB-dostu bir kimliğe dönüştürür.
 *
 * Örnekler:
 *   "My Wallet!"  → "my-wallet"
 *   "  --Test-- " → "test"
 *   ""            → "wallet"
 *
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'wallet';
}

// ─── Dışa aktarım ─────────────────────────────────────────────────────────────

export {
  // Registry
  loadRegistry,
  saveRegistry,

  // Cüzdan CRUD
  addWalletToRegistry,
  removeWalletFromRegistry,
  getAllWallets,
  getWalletById,
  getWalletCount,
  generateUniqueId,

  // Electrum
  saveElectrumConfig,
  loadElectrumConfig,

  // IndexedDB
  deleteWalletIDB,
  deleteWalletFull,

  // Yardımcı
  slugify,

  // Sabitler
  STORAGE_KEY,
  IDB_PREFIX,
  DEFAULT_ELECTRUM,
};
