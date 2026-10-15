import { useEffect, useState } from 'react';

import { useSettingsStore } from '../store';
import {
  shouldSkipTranslation,
  subscribeTranslationReady,
  translateText,
  translationIsAvailable,
} from '../services/translation';

export interface TranslatedTextResult {
  /** The text to display: translated when available, otherwise the original. */
  text: string;
  /** True when this render is showing a non-English translation. */
  isTranslated: boolean;
  /** True while the native translation is still in flight. */
  isTranslating: boolean;
}

/**
 * Returns an on-device translation of `original` into the user's selected
 * language. Falls back to the original text when translation is disabled,
 * unsupported, the language pack isn't downloaded, or translation errors.
 *
 * Subscribe to `translationIsAvailable` readiness so text translates as soon as
 * the pack finishes downloading even while a screen is already mounted.
 */
export function useTranslatedText(original: string): TranslatedTextResult {
  const translateEnabled = useSettingsStore((s) => s.translateEnabled);
  const translationLanguage = useSettingsStore((s) => s.translationLanguage);

  // Separate from `text` so we always keep the original in memory and can
  // re-translate after language changes without double-translating.
  const [translated, setTranslated] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (
      !translateEnabled ||
      !translationIsAvailable ||
      translationLanguage === 'en' ||
      shouldSkipTranslation(original)
    ) {
      setTranslated(null);
      setIsTranslating(false);
      return;
    }

    setIsTranslating(true);

    const run = () => {
      translateText(original, translationLanguage).then((result) => {
        if (cancelled) return;
        setTranslated(result);
        setIsTranslating(false);
      });
    };

    run();
    const unsubscribe = subscribeTranslationReady(run);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [original, translateEnabled, translationLanguage]);

  const text = translated ?? original;
  const isTranslated = translated != null && translated !== original;

  return { text, isTranslated, isTranslating };
}