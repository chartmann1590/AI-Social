import { NativeModules, Platform } from 'react-native';

import { evaluateNsfwRegions, NsfwScores, NsfwVerdict, toScores } from './nsfwPolicy';

export { evaluateNsfwScores, evaluateNsfwRegions, NSFW_THRESHOLDS } from './nsfwPolicy';
export type { NsfwScores, NsfwVerdict } from './nsfwPolicy';

type NativeSafety = {
  classifyImage(uri: string): Promise<NsfwScores & { full?: unknown; center?: unknown; quadrants?: unknown[] }>;
  isAvailable(): Promise<boolean>;
  selfTest(): Promise<boolean>;
};

function native(): NativeSafety | undefined {
  return (NativeModules as { AISocialSafety?: NativeSafety }).AISocialSafety;
}

/**
 * Classifies a LOCAL image file. Fails closed: if the classifier is not
 * available or errors, the verdict is "blocked".
 */
export async function classifyLocalImage(fileUri: string): Promise<NsfwVerdict> {
  const mod = native();
  if (Platform.OS !== 'android' || !mod) {
    return { blocked: true, reason: 'classifier-unavailable' };
  }
  try {
    const raw = await mod.classifyImage(fileUri);
    const full = toScores(raw.full);
    if (!full) return { blocked: true, reason: 'classifier-error' };
    const center = toScores(raw.center) ?? undefined;
    const quadrants: NsfwScores[] = [];
    for (const q of Array.isArray(raw.quadrants) ? raw.quadrants : []) {
      const s = toScores(q);
      if (!s) return { blocked: true, reason: 'classifier-error' };
      quadrants.push(s);
    }
    return evaluateNsfwRegions({ full, center, quadrants });
  } catch {
    return { blocked: true, reason: 'classifier-error' };
  }
}

/** Warms the model at startup and logs a self-test line (never throws). */
export function runClassifierSelfTest(): void {
  const mod = native();
  if (Platform.OS !== 'android' || !mod?.selfTest) return;
  mod.selfTest().catch(() => {});
}
