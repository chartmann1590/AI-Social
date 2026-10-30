import type { AppSettings, Comment, Post } from '../../types';
import type { LlmMode } from '../../types';
import { localLiteRtProvider } from './providers/localLiteRt';
import { remoteOllamaProvider } from './providers/remoteOllama';
import { BLOCKED_TEXT_MESSAGE, checkTextSafety, isTextSafe } from '../imageSafety';

/**
 * Client-side safety layer on every piece of AI text. The app can be
 * pointed at ANY Ollama server and model, so the model's own guardrails
 * cannot be relied on: posts/comments that fail the filter are dropped
 * before they reach the screen, and unsafe drafts are refused.
 */
function safePost(p: Post): boolean {
  return isTextSafe(p.content) && isTextSafe(`${p.author.name} ${p.author.handle}`);
}
function safeComment(c: Comment): boolean {
  return isTextSafe(c.content) && isTextSafe(`${c.author.name} ${c.author.handle}`);
}

function shouldTryLocal(mode: LlmMode): boolean {
  return mode === 'local' || mode === 'hybrid';
}

function shouldTryRemote(mode: LlmMode, settings: AppSettings): boolean {
  if (mode === 'remote') {
    return true;
  }
  if (mode === 'hybrid' && settings.enableRemoteFallback) {
    return true;
  }
  return false;
}

async function withFallback<T>(
  mode: LlmMode,
  settings: AppSettings,
  runLocal: () => Promise<T>,
  runRemote: () => Promise<T>,
): Promise<T> {
  const tryLocal = shouldTryLocal(mode);
  const tryRemote = shouldTryRemote(mode, settings);

  if (tryLocal) {
    try {
      return await runLocal();
    } catch (e) {
      if (tryRemote) {
        console.warn('[LlmService] Local inference failed, falling back to remote:', e);
        return await runRemote();
      }
      throw e;
    }
  }

  if (tryRemote) {
    return await runRemote();
  }

  throw new Error('No LLM backend configured for current mode.');
}

/**
 * Unified LLM entry: on-device (LiteRT/MediaPipe) when enabled, with optional Ollama fallback.
 */
const MAX_FEED_ATTEMPTS = 4;

function oldestCreatedAtMs(posts: Post[]): number {
  let min = Infinity;
  for (const p of posts) {
    const t = new Date(p.createdAt).getTime();
    if (!Number.isNaN(t) && t < min) {
      min = t;
    }
  }
  return min === Infinity ? Date.now() : min;
}

async function generateAtLeastPosts(
  settings: AppSettings,
  target: number,
  runOne: (n: number, baseTime: number) => Promise<Post[]>,
  initialBaseTime?: number,
): Promise<Post[]> {
  const all: Post[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  let lastError: unknown = null;
  let nextBaseTime = initialBaseTime ?? Date.now();
  while (all.length < target && attempts < MAX_FEED_ATTEMPTS) {
    const need = target - all.length;
    try {
      const batch = await runOne(Math.max(need, 3), nextBaseTime);
      for (const post of batch.filter(safePost)) {
        const key = `${post.author.handle}|${post.content}`.trim();
        if (!seen.has(key) && post.content) {
          seen.add(key);
          all.push(post);
          if (all.length >= target) break;
        }
      }
      if (all.length > 0) {
        nextBaseTime = oldestCreatedAtMs(all) - 60_000;
      }
    } catch (e) {
      lastError = e;
      break;
    }
    attempts += 1;
  }
  if (all.length === 0 && lastError) throw lastError;
  return all;
}

export const LlmService = {
  async generateFeedPosts(
    settings: AppSettings,
    count: number = 5,
    baseTime?: number,
  ): Promise<Post[]> {
    const target = Math.max(5, count);
    return withFallback(
      settings.llmMode,
      settings,
      () =>
        generateAtLeastPosts(
          settings,
          target,
          (n, bt) => localLiteRtProvider.generateFeedPosts(settings, n, bt),
          baseTime,
        ),
      () =>
        generateAtLeastPosts(
          settings,
          target,
          (n, bt) => remoteOllamaProvider.generateFeedPosts(settings, n, bt),
          baseTime,
        ),
    );
  },

  async generateComments(
    settings: AppSettings,
    postContent: string,
    count: number = 3,
  ): Promise<Comment[]> {
    const comments = await withFallback(
      settings.llmMode,
      settings,
      () => localLiteRtProvider.generateComments(settings, postContent, count),
      () => remoteOllamaProvider.generateComments(settings, postContent, count),
    );
    return comments.filter(safeComment);
  },

  async generateDraft(settings: AppSettings, topic: string): Promise<string> {
    if (!checkTextSafety(topic).allowed) {
      throw new Error(BLOCKED_TEXT_MESSAGE);
    }
    const draft = await withFallback(
      settings.llmMode,
      settings,
      () => localLiteRtProvider.generateDraft(settings, topic),
      () => remoteOllamaProvider.generateDraft(settings, topic),
    );
    if (!isTextSafe(draft)) {
      throw new Error(BLOCKED_TEXT_MESSAGE);
    }
    return draft;
  },

  async generateText(settings: AppSettings, prompt: string): Promise<string> {
    if (!checkTextSafety(prompt).allowed) {
      throw new Error(BLOCKED_TEXT_MESSAGE);
    }
    const text = await withFallback(
      settings.llmMode,
      settings,
      () => localLiteRtProvider.generateText(settings, prompt),
      () => remoteOllamaProvider.generateText(settings, prompt),
    );
    if (!isTextSafe(text)) {
      throw new Error(BLOCKED_TEXT_MESSAGE);
    }
    return text;
  },
};

/** @deprecated Use `LlmService` */
export const OllamaService = LlmService;
