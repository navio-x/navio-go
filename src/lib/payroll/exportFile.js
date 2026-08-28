import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

// Chunked to avoid blowing the call stack on String.fromCharCode(...bytes)
// for a large PDF — reports here are small, but this stays correct either way.
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function writeAndShare(filename, data, { binary, mimeType }) {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: binary ? arrayBufferToBase64(data) : data,
      directory: Directory.Cache,
      ...(binary ? {} : { encoding: Encoding.UTF8 }),
      recursive: true,
    });
    await Share.share({ url: uri, title: filename });
    return { platform: "native", path: filename };
  }

  const blob = new Blob([data], { type: mimeType });
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

/** @returns {Promise<{platform: 'native'|'web', path: string}>} */
export function exportCsvFile(filename, csvText) {
  return writeAndShare(filename, csvText, { binary: false, mimeType: "text/csv;charset=utf-8" });
}

/** @returns {Promise<{platform: 'native'|'web', path: string}>} */
export function exportPdfFile(filename, pdfArrayBuffer) {
  return writeAndShare(filename, pdfArrayBuffer, { binary: true, mimeType: "application/pdf" });
}
