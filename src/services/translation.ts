import { NativeModules, Platform } from 'react-native';

/**
 * On-device translation backed by Google ML Kit (Android). Wrapped through the
 * custom `AISocialTranslate` native module added by `plugins/withMLKitTranslate.js`.
 *
 * Everything runs on-device: text never leaves the phone and language packs are
 * stored locally. Quality is best-effort — see the disclaimer surfaced in the
 * onboarding and Settings screens.
 */

export const SOURCE_LANGUAGE_CODE = 'en';

export interface TranslationLanguage {
  /** ML Kit language tag (BCP-47 style). */
  code: string;
  /** English name. */
  name: string;
  /** The name in its own language. */
  nativeName: string;
  /** Emoji flag. */
  flag: string;
}

export const TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', flag: '🇸🇰' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', flag: '🇭🇷' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски', flag: '🇷🇸' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'fil', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  { code: 'nb', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', flag: '🇱🇹' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', flag: '🇱🇻' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti', flag: '🇪🇪' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', flag: '🇸🇮' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip', flag: '🇦🇱' },
  { code: 'mk', name: 'Macedonian', nativeName: 'Македонски', flag: '🇲🇰' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪' },
];

export function getTranslationLanguage(code: string): TranslationLanguage | undefined {
  return TRANSLATION_LANGUAGES.find((l) => l.code === code);
}

export function getTranslationLanguageName(code: string): string {
  const lang = getTranslationLanguage(code);
  return lang ? `${lang.flag} ${lang.nativeName}` : code;
}

type NativeTranslator = {
  translate(text: string, targetLanguage: string, sourceLanguage: string): Promise<string>;
  downloadLanguage(source: string, target: string): Promise<boolean>;
  isLanguageDownloaded(source: string, target: string): Promise<boolean>;
  getDownloadedModels(): Promise<string[]>;
  deleteLanguage(source: string, target: string): Promise<null>;
  reset(): Promise<null>;
  isAvailable(): Promise<boolean>;
};

const NativeTranslator = (NativeModules as { AISocialTranslate?: NativeTranslator })
  .AISocialTranslate;

/** Only the Android dev/release build ships the ML Kit native module. */
export const translationIsAvailable: boolean =
  Platform.OS === 'android' && NativeTranslator != null;

// ---------------------------------------------------------------------------
// In-memory translation cache (bounded). Translations are deterministic per
// (target, text) pair, so caching avoids hammering the native module when the
// same post/comment re-renders.
// ---------------------------------------------------------------------------
const CACHE_MAX_ENTRIES = 4000;
const TRANSLATION_CACHE = new Map<string, { text: string; at: number }>();

function cacheKey(target: string, text: string): string {
  return `${target}\u0001${text}`;
}

function cacheGet(target: string, text: string): string | null {
  const entry = TRANSLATION_CACHE.get(cacheKey(target, text));
  return entry ? entry.text : null;
}

function cacheSet(target: string, text: string, translated: string) {
  if (TRANSLATION_CACHE.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = TRANSLATION_CACHE.keys().next().value;
    if (oldestKey != null) TRANSLATION_CACHE.delete(oldestKey);
  }
  TRANSLATION_CACHE.set(cacheKey(target, text), { text: translated, at: Date.now() });
}

// ---------------------------------------------------------------------------
// Language-pack readiness + download tracking.
// ---------------------------------------------------------------------------
const readyTargets = new Set<string>([SOURCE_LANGUAGE_CODE]);
const downloadPromises = new Map<string, Promise<boolean>>();
const readyListeners = new Set<() => void>();

export function isTranslationModelReady(target: string): boolean {
  if (!translationIsAvailable) return false;
  if (target === SOURCE_LANGUAGE_CODE) return true;
  return readyTargets.has(target);
}

export function subscribeTranslationReady(listener: () => void): () => void {
  readyListeners.add(listener);
  return () => {
    readyListeners.delete(listener);
  };
}

function notifyReady(target: string) {
  readyTargets.add(target);
  readyListeners.forEach((l) => l());
}

/**
 * Non-null assertion helper: `NativeTranslator` is only reached after the
 * `translationIsAvailable` guard, which guarantees the module exists.
 */
function translator(): NativeTranslator {
  return NativeTranslator!;
}

/** Re-checks on-device model state (e.g. app boot) for a target language. */
export async function refreshTranslationReady(target: string): Promise<boolean> {
  if (!translationIsAvailable || target === SOURCE_LANGUAGE_CODE) {
    return true;
  }
  try {
    const downloaded = await translator().isLanguageDownloaded(
      SOURCE_LANGUAGE_CODE,
      target,
    );
    if (downloaded) {
      readyTargets.add(target);
    }
    return downloaded;
  } catch {
    return false;
  }
}

/**
 * Downloads the ML Kit language pack so a given target language can be
 * translated on-device. Idempotent and shared across callers.
 */
export async function downloadModelForLanguage(target: string): Promise<boolean> {
  if (!translationIsAvailable) return false;
  if (target === SOURCE_LANGUAGE_CODE) {
    readyTargets.add(target);
    return true;
  }
  if (readyTargets.has(target)) return true;

  const inflight = downloadPromises.get(target);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      await translator().downloadLanguage(SOURCE_LANGUAGE_CODE, target);
      notifyReady(target);
      return true;
    } catch {
      return false;
    } finally {
      downloadPromises.delete(target);
    }
  })();
  downloadPromises.set(target, p);
  return p;
}

export async function deleteModelForLanguage(target: string): Promise<void> {
  if (!translationIsAvailable || target === SOURCE_LANGUAGE_CODE) return;
  try {
    await translator().deleteLanguage(SOURCE_LANGUAGE_CODE, target);
  } catch {
    /* ignore */
  } finally {
    readyTargets.delete(target);
  }
}

// ---------------------------------------------------------------------------
// Translation.
// ---------------------------------------------------------------------------

/** Fast-path: strings that never need to hit the native module. */
export function shouldSkipTranslation(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed.length < 3) return true;
  // URLs / images / pure symbols with no letters.
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true;
  const hasAsciiLetter = /[a-zA-Z]/.test(trimmed);
  const hasNonAsciiLetter = /[^\x00-\x7F]/.test(trimmed);
  return !hasAsciiLetter && !hasNonAsciiLetter;
}

/**
 * Translates `text` into `target` using on-device ML Kit. Returns the original
 * text untouched if translation isn't available, the pack isn't downloaded yet,
 * or an error occurs.
 */
export async function translateText(text: string, target: string): Promise<string> {
  if (!translationIsAvailable || shouldSkipTranslation(text)) {
    return text;
  }
  if (target === SOURCE_LANGUAGE_CODE) return text;

  const cached = cacheGet(target, text);
  if (cached != null) return cached;

  // Wait for any in-flight pack download so the first frame after selecting a
  // language can translate immediately.
  const inflight = downloadPromises.get(target);
  if (inflight) {
    await inflight.catch(() => {});
  }
  if (!readyTargets.has(target)) {
    return text;
  }

  try {
    const result = await translator().translate(text, target, '');
    if (result && result.trim()) {
      cacheSet(target, text, result);
    }
    return result || text;
  } catch {
    return text;
  }
}

/** Counts downloaded translation language packs (for the Settings screen). */
export async function getDownloadedModelCount(): Promise<number> {
  if (!translationIsAvailable) return 0;
  try {
    const models = await translator().getDownloadedModels();
    return models.length;
  } catch {
    return 0;
  }
}

/** Resets the native translator cache (e.g. after changing language). */
export async function resetTranslationNative(): Promise<void> {
  if (!translationIsAvailable) return;
  try {
    await translator().reset();
  } catch {
    /* ignore */
  }
}