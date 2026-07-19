import * as FileSystem from 'expo-file-system/legacy';
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

type NativeDownloader = {
  downloadFile(url: string, destPath: string): Promise<string>;
  cancelDownload(): Promise<null>;
  addListener?: (name: string) => void;
  removeListeners?: (count: number) => void;
};

const NativeLLM = (NativeModules as { AISocialLiteRtLlm?: NativeDownloader }).AISocialLiteRtLlm;

const MODEL_SUBDIR = 'llm-models';

const HF_HOST = 'huggingface.co';

function withHuggingFaceDownloadQuery(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname !== HF_HOST && !u.hostname.endsWith(`.${HF_HOST}`)) {
      return url;
    }
    if (!u.searchParams.has('download')) {
      u.searchParams.set('download', 'true');
    }
    return u.toString();
  } catch {
    return url;
  }
}

function base64FirstBytesToUint8(b64: string, maxBytes: number): Uint8Array {
  const bin = atob(b64);
  const n = Math.min(maxBytes, bin.length);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = bin.charCodeAt(i) & 0xff;
  }
  return out;
}

function looksLikeZipTaskPrefix(bytes: Uint8Array): boolean {
  // MediaPipe `.task` bundles may begin with a small header (e.g. 4 leading zero bytes)
  // before the actual zip local-file header `PK\x03\x04`. Accept either layout.
  const maxOffset = Math.max(0, bytes.length - 4);
  const scanLimit = Math.min(maxOffset, 64);
  for (let i = 0; i <= scanLimit; i++) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      (bytes[i + 2] === 0x03 || bytes[i + 2] === 0x05 || bytes[i + 2] === 0x07) &&
      (bytes[i + 3] === 0x04 || bytes[i + 3] === 0x06 || bytes[i + 3] === 0x08)
    ) {
      return true;
    }
  }
  return false;
}

function hasZipEndOfCentralDirectory(bytes: Uint8Array): boolean {
  // EOCD signature: 0x50 0x4b 0x05 0x06
  for (let i = 0; i <= bytes.length - 4; i++) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Validates a downloaded `.task` path before MediaPipe loads it (also used after HTTP download).
 */
export async function assertLooksLikeMediapipeTaskFile(
  fileUri: string,
  approxSizeBytes?: number,
): Promise<void> {
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) {
    throw new Error('Model file is missing.');
  }
  const size = (info as { size?: number }).size ?? 0;

  if (approxSizeBytes && size > 0 && size < approxSizeBytes * 0.05) {
    throw new Error(
      `This file is only ${Math.round(size / 1024)} KB but this model is ~${Math.round(approxSizeBytes / 1_048_576)} MB — ` +
        'the download is almost certainly an error page or a truncated transfer. Delete it in Models and download again on stable Wi‑Fi.',
    );
  }

  if (size > 0 && size < 500_000) {
    const sniffBytesLen = Math.min(2048, size);
    const b64Head = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: sniffBytesLen,
    });
    const sniffBytes = base64FirstBytesToUint8(b64Head, sniffBytesLen);
    let head = '';
    for (let i = 0; i < Math.min(800, sniffBytes.length); i++) {
      head += String.fromCharCode(sniffBytes[i]!);
    }
    const lower = head.trimStart().toLowerCase();
    if (lower.startsWith('<!doctype') || lower.startsWith('<html')) {
      throw new Error(
        'The downloaded file is HTML (not a model). Hugging Face may have served an error or login page — delete the file and try downloading again.',
      );
    }
    if (head.includes('https://git-lfs.github.com/spec/v1')) {
      throw new Error(
        'The downloaded file is a Git LFS pointer text file, not the real model. Delete it and use Download again (the app now requests the file with headers HF expects).',
      );
    }
  }

  if (size >= 500_000) {
    // `.litertlm` bundles are LiteRT-LM's own native container (not a zip); skip format validation.
    // `.safetensors` is used by SD checkpoints and is also non-zip binary.
    const isLiteRtLmByExt = /\.litertlm$/i.test(fileUri);
    const isSafeTensorsByExt = /\.safetensors$/i.test(fileUri);
    const b64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 128,
    });
    const prefix = base64FirstBytesToUint8(b64, 96);
    const isZipTask = looksLikeZipTaskPrefix(prefix);

    if (!isZipTask && !isLiteRtLmByExt && !isSafeTensorsByExt) {
      throw new Error(
        'This file is not a recognized MediaPipe `.task`, LiteRT-LM `.litertlm`, or `.safetensors` model. Delete it in Models and re-download.',
      );
    }

    if (isZipTask) {
      // Catch truncated/partial downloads: verify tail contains ZIP end-of-central-directory marker.
      const tailLen = Math.min(size, 70_000);
      const tailB64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
        position: Math.max(0, size - tailLen),
        length: tailLen,
      });
      const tail = base64FirstBytesToUint8(tailB64, tailLen);
      if (!hasZipEndOfCentralDirectory(tail)) {
        throw new Error(
          'This model file appears incomplete or corrupted (zip end marker missing). Delete it in Models and download again on stable Wi‑Fi.',
        );
      }
    }
  }
}

/** Android/iOS native MediaPipe expects a filesystem path, not a `file://` URI. */
export function uriToNativePath(uri: string): string {
  if (uri.startsWith('file://')) {
    return uri.replace(/^file:\/\//, '');
  }
  return uri;
}

export function getModelsDirectory(): string {
  const base = FileSystem.documentDirectory;
  if (!base) {
    throw new Error('documentDirectory is not available on this platform.');
  }
  return `${base}${MODEL_SUBDIR}/`;
}

export async function ensureModelsDirectory(): Promise<string> {
  const dir = getModelsDirectory();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export async function getLocalModelUriIfExists(
  filename: string,
  approxSizeBytes?: number,
): Promise<string | null> {
  const dir = getModelsDirectory();
  const path = `${dir}${filename}`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  // Guard against partial/interrupted downloads appearing as usable.
  if (approxSizeBytes && approxSizeBytes > 0) {
    const size = (info as { size?: number }).size ?? 0;
    if (size < approxSizeBytes * 0.9) {
      return null;
    }
  }
  return path;
}

export type DownloadProgress = {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
};

export async function downloadModelFile(
  downloadUrl: string,
  filename: string,
  onProgress?: (p: DownloadProgress) => void,
  approxSizeBytes?: number,
  onStatus?: (msg: string) => void,
): Promise<string> {
  await ensureModelsDirectory();
  const destUri = `${getModelsDirectory()}${filename}`;

  // Clear any partial/stale file from a prior failed attempt so the native
  // downloader writes from byte 0 instead of resuming against a bad state.
  try {
    await FileSystem.deleteAsync(destUri, { idempotent: true });
  } catch {
    /* ignore */
  }

  const callback = onProgress
    ? (downloadProgress: FileSystem.DownloadProgressData) => {
        onProgress({
          totalBytesWritten: downloadProgress.totalBytesWritten,
          totalBytesExpectedToWrite: downloadProgress.totalBytesExpectedToWrite,
        });
      }
    : undefined;

  const withQuery = withHuggingFaceDownloadQuery(downloadUrl);
  onStatus?.('starting native download');

  // Native downloader uses HttpURLConnection with a 120s read timeout (avoids
  // OkHttp's 10s default in expo-file-system) and follows redirects itself,
  // including HF's redirect to its Xet CDN. Resolving that redirect ahead of
  // time on the JS side (via a probing fetch) was removed: it consumed the
  // CDN's single-use pre-signed URL before the native downloader could use it,
  // causing the real download to fail with HTTP 403.
  if (Platform.OS !== 'android' || !NativeLLM) {
    throw new Error('Native downloader is only available on Android dev/release builds.');
  }

  const destPath = destUri.replace(/^file:\/\//, '');
  onStatus?.(`native HttpURLConnection download → ${destPath.slice(-60)}`);

  const emitter = new NativeEventEmitter(NativeModules.AISocialLiteRtLlm);
  const sub = emitter.addListener(
    'AISocialDownloadProgress',
    (ev: { written: number; total: number }) => {
      onProgress?.({
        totalBytesWritten: ev.written,
        totalBytesExpectedToWrite: ev.total > 0 ? ev.total : approxSizeBytes ?? 0,
      });
    },
  );

  let result: { uri: string; status?: number };
  try {
    const returnedPath = await NativeLLM.downloadFile(withQuery, destPath);
    result = { uri: `file://${returnedPath}`, status: 200 };
  } finally {
    sub.remove();
  }
  onStatus?.(`native download complete`);
  if (!result?.uri) {
    throw new Error('Download finished without a file URI.');
  }
  if (typeof result.status === 'number' && (result.status < 200 || result.status >= 300)) {
    try {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
    } catch {
      /* ignore */
    }
    throw new Error(`Download failed with HTTP status ${result.status}. Check your connection and try again.`);
  }
  try {
    await assertLooksLikeMediapipeTaskFile(result.uri, approxSizeBytes);
  } catch (e) {
    try {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
    } catch {
      /* ignore */
    }
    throw e;
  }
  return result.uri;
}
