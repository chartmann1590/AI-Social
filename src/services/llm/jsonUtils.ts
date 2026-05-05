import { Post, Comment } from '../../types';

export const getBaseUrl = (url: string) => url.replace(/\/$/, '');

/** Pulls the first balanced JSON object or array from noisy LLM output (preamble, markdown, etc.). */
function extractFirstBalancedJson(text: string): string | null {
  const start = text.search(/[\[{]/);
  if (start === -1) {
    return null;
  }
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === '"') {
        inStr = false;
      }
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '{' || c === '[') {
      stack.push(c);
      continue;
    }
    if (c === '}' || c === ']') {
      const open = stack.pop();
      if (!open) {
        return null;
      }
      const ok = (open === '{' && c === '}') || (open === '[' && c === ']');
      if (!ok) {
        return null;
      }
      if (stack.length === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

/** Best-effort extraction of a plain-text draft from noisy model output.
 * Strips code fences, then tries JSON with a `content` key, then falls back to
 * the first non-empty line. Used by generateDraft where small models often
 * ignore the "return JSON" instruction. */
export const extractDraftText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const unfenced = value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!unfenced) {
    return null;
  }
  try {
    const parsed = JSON.parse(unfenced);
    if (parsed && typeof parsed === 'object' && typeof (parsed as { content?: unknown }).content === 'string') {
      return (parsed as { content: string }).content;
    }
  } catch {
    const extracted = extractFirstBalancedJson(unfenced);
    if (extracted) {
      try {
        const parsed = JSON.parse(extracted);
        if (parsed && typeof parsed === 'object' && typeof (parsed as { content?: unknown }).content === 'string') {
          return (parsed as { content: string }).content;
        }
      } catch {
        // fall through
      }
    }
  }
  const firstLine = unfenced.split('\n').map((l) => l.trim()).find(Boolean);
  return firstLine ?? unfenced;
};

export const parseModelJson = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const unfenced = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    try {
      return JSON.parse(unfenced);
    } catch {
      const extracted = extractFirstBalancedJson(unfenced);
      if (extracted) {
        return JSON.parse(extracted);
      }
      throw new Error(
        'Model output was not valid JSON. Try again, or switch LLM mode / remote fallback in Settings.',
      );
    }
  }
  return value;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const parseCount = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number.parseInt(trimmed.replace(/[^\d-]/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  return null;
};

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const normalizeCount = (
  value: unknown,
  fallbackMin: number,
  fallbackMax: number,
) => {
  const parsed = parseCount(value);
  if (parsed === null) {
    return randomInt(fallbackMin, fallbackMax);
  }
  return clamp(parsed, fallbackMin, fallbackMax);
};

export const ensureArray = (value: unknown, label: string) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidate =
      record.items ??
      record.posts ??
      record.comments ??
      record.data ??
      record.results;
    if (Array.isArray(candidate)) {
      return candidate;
    }
    if (candidate && typeof candidate === 'object') {
      const nested = candidate as Record<string, unknown>;
      const nestedCandidate =
        nested.items ??
        nested.posts ??
        nested.comments ??
        nested.data ??
        nested.results;
      if (Array.isArray(nestedCandidate)) {
        return nestedCandidate;
      }
    }

    const arrayValues = Object.values(record).filter(Array.isArray);
    if (arrayValues.length > 0) {
      return arrayValues[0] as unknown[];
    }

    const objectValues = Object.values(record).filter(
      (entry) => entry && typeof entry === 'object' && !Array.isArray(entry),
    ) as Record<string, unknown>[];
    if (objectValues.length > 0) {
      const looksLikeItem = (entry: Record<string, unknown>) =>
        typeof entry.content === 'string' ||
        typeof entry.authorName === 'string' ||
        typeof entry.authorHandle === 'string';
      if (objectValues.every(looksLikeItem)) {
        return objectValues;
      }
    }

    const looksLikeSingle = (entry: Record<string, unknown>) =>
      typeof entry.content === 'string' ||
      typeof entry.authorName === 'string' ||
      typeof entry.authorHandle === 'string';
    if (looksLikeSingle(record)) {
      return [record];
    }
  }
  throw new Error(`Expected ${label} array from model response`);
};

/** Realistic social-feed engagement counts: most posts get few likes, a few go viral.
 * Power-law-ish: ~60% single/double digits, ~30% low hundreds, ~10% up to a few thousand. */
function realisticLikes(): number {
  const r = Math.random();
  if (r < 0.6) return Math.floor(Math.random() * 40);
  if (r < 0.9) return 40 + Math.floor(Math.random() * 260);
  return 300 + Math.floor(Math.random() * 2700);
}

function realisticComments(likes: number): number {
  // Comments roughly 3-15% of likes, plus noise, clipped.
  const ratio = 0.03 + Math.random() * 0.12;
  const raw = Math.round(likes * ratio + Math.random() * 3);
  return Math.max(0, Math.min(999, raw));
}

/** Index 0 = newest in batch (near `baseTime`), later items progressively older. */
function staggeredCreatedAtMs(baseTime: number, index: number): number {
  const minStepMs = 2 * 60 * 1000;
  const maxStepMs = 12 * 60 * 1000;
  let offset = 0;
  for (let j = 0; j < index; j++) {
    offset += randomInt(minStepMs, maxStepMs);
  }
  offset += randomInt(0, 90_000);
  return baseTime - offset;
}

export function mapRawPostsToPosts(rawPosts: unknown[], baseTime: number = Date.now()): Post[] {
  return rawPosts.map((p: unknown, index: number) => {
    const row = p as Record<string, unknown>;
    const handleRaw = String(row.authorHandle ?? '').replace(/^@+/, '');
    const likes = realisticLikes();
    return {
      id: Math.random().toString(36).substring(2, 11),
      author: {
        id: Math.random().toString(36).substring(2, 11),
        name: String(row.authorName ?? 'User'),
        handle: handleRaw ? `@${handleRaw}` : '@user',
        avatar: `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(handleRaw || 'user')}`,
      },
      content: String(row.content ?? ''),
      createdAt: new Date(staggeredCreatedAtMs(baseTime, index)).toISOString(),
      likes,
      commentsCount: realisticComments(likes),
    };
  });
}

export function mapRawCommentsToComments(
  rawComments: unknown[],
  baseTime: number = Date.now(),
): Comment[] {
  return rawComments.map((c: unknown, index: number) => {
    const row = c as Record<string, unknown>;
    const handleRaw = String(row.authorHandle ?? '');
    return {
      id: Math.random().toString(36).substring(2, 11),
      author: {
        id: Math.random().toString(36).substring(2, 11),
        name: String(row.authorName ?? 'User'),
        handle: handleRaw.startsWith('@') ? handleRaw : `@${handleRaw}`,
        avatar: `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(handleRaw || 'user')}`,
      },
      content: String(row.content ?? ''),
      createdAt: new Date(staggeredCreatedAtMs(baseTime, index)).toISOString(),
    };
  });
}
