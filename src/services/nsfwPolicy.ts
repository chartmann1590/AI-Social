/**
 * Policy for the on-device NSFW image check (native module AISocialSafety,
 * native-src/safety/NsfwClassifierModule.kt). Two independent models score
 * the whole image and a centre crop:
 *   - GantMan MobileNet V2 (porn / hentai / sexy / neutral / drawings, MIT)
 *   - Marqo nsfw-image-detection-384 (ViT-tiny, NSFW probability, Apache-2.0)
 *
 * Blocked when EITHER model is near-certain, or when BOTH lean NSFW.
 * Calibrated on Google's own evidence image (GantMan porn+hentai 0.99-1.0,
 * Marqo 0.63-0.95 -> blocked) and on ordinary Pollinations images of
 * people, where each model alone produced false alarms (GantMan up to
 * 0.87 on a yoga class, Marqo 0.95 on a woman in a red dress) but never
 * both together. The quadrant scores are kept for diagnostics only:
 * Pollinations' corner watermark makes them noisy. Any failure to
 * classify is handled by the caller as BLOCKED.
 */
export type NsfwScores = {
  drawings: number;
  hentai: number;
  neutral: number;
  porn: number;
  sexy: number;
  /** Marqo NSFW probability, when the second model ran on this region. */
  marqo?: number;
};

export type NsfwRegions = {
  full: NsfwScores;
  center?: NsfwScores;
  quadrants?: NsfwScores[];
};

export const NSFW_THRESHOLDS = {
  gantmanAlone: 0.95, // porn + hentai
  marqoAlone: 0.98,
  bothGantman: 0.5, // porn + hentai, together with...
  bothMarqo: 0.6, // ...Marqo NSFW
  sexyWithMarqo: 0.8, // GantMan "sexy", together with Marqo >= bothMarqo
} as const;

export type NsfwVerdict = { blocked: boolean; reason: string; scores?: NsfwScores };

/** Rule for one region. Without a Marqo score the GantMan-only fallback is stricter. */
export function evaluateNsfwScores(s: NsfwScores): NsfwVerdict {
  const t = NSFW_THRESHOLDS;
  const g = s.porn + s.hentai;
  if (g >= t.gantmanAlone) return { blocked: true, reason: 'gantman', scores: s };
  if (typeof s.marqo !== 'number' || !Number.isFinite(s.marqo)) {
    // Second model missing for this region: fall back to GantMan alone, strictly.
    if (g >= t.bothGantman || s.sexy >= t.sexyWithMarqo) return { blocked: true, reason: 'gantman-only', scores: s };
    return { blocked: false, reason: 'ok', scores: s };
  }
  if (s.marqo >= t.marqoAlone) return { blocked: true, reason: 'marqo', scores: s };
  if (s.marqo >= t.bothMarqo && g >= t.bothGantman) return { blocked: true, reason: 'both', scores: s };
  if (s.marqo >= t.bothMarqo && s.sexy >= t.sexyWithMarqo) return { blocked: true, reason: 'sexy+marqo', scores: s };
  return { blocked: false, reason: 'ok', scores: s };
}

export function evaluateNsfwRegions(r: NsfwRegions): NsfwVerdict {
  const whole = evaluateNsfwScores(r.full);
  if (whole.blocked) return whole;
  if (r.center) {
    const c = evaluateNsfwScores(r.center);
    if (c.blocked) return { ...c, reason: `center:${c.reason}` };
  }
  return { blocked: false, reason: 'ok', scores: r.full };
}

export function toScores(raw: unknown): NsfwScores | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const s: NsfwScores = {
    drawings: Number(o.drawings),
    hentai: Number(o.hentai),
    neutral: Number(o.neutral),
    porn: Number(o.porn),
    sexy: Number(o.sexy),
  };
  if ([s.hentai, s.porn, s.sexy].some((v) => !Number.isFinite(v))) return null;
  if (o.marqo !== undefined) {
    const m = Number(o.marqo);
    if (!Number.isFinite(m)) return null;
    s.marqo = m;
  }
  return s;
}
