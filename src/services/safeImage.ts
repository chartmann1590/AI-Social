import * as FileSystem from 'expo-file-system/legacy';
import { classifyLocalImage } from './nsfwClassifier';
import { BLOCKED_IMAGE_MESSAGE } from './imageSafety';

export class BlockedImageError extends Error {
  constructor(message: string = BLOCKED_IMAGE_MESSAGE) {
    super(message);
    this.name = 'BlockedImageError';
  }
}

const DIR = `${FileSystem.documentDirectory ?? ''}checked-images/`;
const MAX_BYTES = 15 * 1024 * 1024;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

/**
 * Downloads an image, classifies the downloaded pixels on-device, and
 * returns the LOCAL file uri only if it passed. The app then displays
 * that local file, so what is shown is exactly what was checked.
 * Flagged or uncheckable images are deleted and a BlockedImageError
 * ("Not allowed ...") is thrown.
 */
export async function fetchAndScreenImage(remoteUrl: string, idHint: string): Promise<string> {
  const url = remoteUrl.trim();
  if (!/^https:\/\//i.test(url)) {
    throw new BlockedImageError('Only https:// image links can be attached.');
  }
  await ensureDir();
  const safeId = idHint.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || `${Date.now()}`;
  const dest = `${DIR}${safeId}-${Date.now()}.img`;
  const res = await FileSystem.downloadAsync(url, dest);
  if (res.status < 200 || res.status >= 300) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    throw new Error(`Image request failed (${res.status}). Try again in a moment.`);
  }
  const ctype = (res.headers?.['Content-Type'] ?? res.headers?.['content-type'] ?? '').toLowerCase();
  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists || (info.size ?? 0) === 0 || (info.size ?? 0) > MAX_BYTES || (ctype && !ctype.startsWith('image/'))) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    throw new BlockedImageError('That link is not an image the app can check, so it was not attached.');
  }
  const verdict = await classifyLocalImage(dest);
  if (verdict.blocked) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    if (verdict.reason === 'classifier-unavailable' || verdict.reason === 'classifier-error') {
      throw new BlockedImageError(
        'The image safety check could not run, so the image was not shown. Please try again.',
      );
    }
    throw new BlockedImageError();
  }
  return dest;
}

/** Removes a previously checked local image (used when a user reports it). */
export async function deleteCheckedImage(uri: string): Promise<void> {
  if (uri.startsWith(DIR)) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
