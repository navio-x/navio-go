import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

function receiptFilename(receipt) {
  const datePart = (receipt.paymentDate || new Date().toISOString().slice(0, 10)).replace(/[^0-9-]/g, "");
  return `navio-receipt-${receipt.recipientLabel.replace(/[^a-z0-9-]+/gi, "_")}-${datePart}.json`;
}

/**
 * Share/export a single receipt as a standalone JSON file — the same
 * document format the verification screen (receiptCrypto.verifyReceipt)
 * accepts. Native uses the OS share sheet; web falls back to a Blob
 * download, matching the split backup.js already uses for the encrypted
 * backup export.
 *
 * @returns {Promise<{platform: 'native'|'web', path: string}>}
 */
export async function shareReceipt(receipt) {
  const json = JSON.stringify(receipt, null, 2);
  const filename = receiptFilename(receipt);

  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({ url: uri, title: filename });
    return { platform: "native", path: filename };
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { platform: "web", path: filename };
}
