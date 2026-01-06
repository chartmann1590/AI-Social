import { AppSettings, Post, Comment, User } from '../types';

const SYSTEM_PROMPT = `You are the backend engine for a simulated social media app called AISocial. 

Your job is to generate realistic, engaging, and safe (PG-13) social media content.

Always return valid JSON arrays or objects as requested.

Do not include markdown formatting (like \`\`\`json) in your response, just the raw JSON.`;

const getBaseUrl = (url: string) => url.replace(/\/$/, ''); // Remove trailing slash

const parseOllamaJson = (value: unknown) => {
  if (typeof value === 'string') {
    return JSON.parse(value);
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

const normalizeCount = (
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

const ensureArray = (value: unknown, label: string) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidate = record.items
      ?? record.posts
      ?? record.comments
      ?? record.data
      ?? record.results;
    if (Array.isArray(candidate)) {
      return candidate;
    }
    if (candidate && typeof candidate === 'object') {
      const nested = candidate as Record<string, unknown>;
      const nestedCandidate = nested.items
        ?? nested.posts
        ?? nested.comments
        ?? nested.data
        ?? nested.results;
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
  throw new Error(`Expected ${label} array from Ollama response`);
};

export const OllamaService = {
  async generateFeedPosts(settings: AppSettings, count: number = 5): Promise<Post[]> {
    const prompt = `Generate ${count} distinct social media posts.
    Each post should have a random author (name, handle).
    The content should be varied (tech, life, jokes, news, thoughts).
    Return a JSON array of objects with these keys: "authorName", "authorHandle", "content", "likes" (number 0-500), "commentsCount" (number 0-50).`;

    try {
      const response = await fetch(`${getBaseUrl(settings.baseUrl)}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model,
          system: SYSTEM_PROMPT,
          prompt: prompt,
          stream: false,
          format: 'json',
          options: {
            temperature: 0.8,
          }
        }),
      });

      if (!response.ok) throw new Error('Ollama API request failed');

      const data = await response.json();
      const parsed = parseOllamaJson(data.response);
      const rawPosts = ensureArray(parsed, 'posts');

      // Map to our internal type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rawPosts.map((p: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        author: {
          id: Math.random().toString(36).substr(2, 9),
          name: p.authorName,
          handle: p.authorHandle.startsWith('@') ? p.authorHandle : `@${p.authorHandle}`,
          avatar: `https://api.dicebear.com/7.x/avataaars/png?seed=${p.authorHandle}`,
        },
        content: p.content,
        createdAt: new Date().toISOString(),
        likes: normalizeCount(p.likes ?? p.likeCount ?? p.favorites ?? p.hearts, 0, 500),
        commentsCount: normalizeCount(
          p.commentsCount ?? p.commentCount ?? p.comments ?? p.replies,
          0,
          50,
        ),
      }));
    } catch (error) {
      console.error('generateFeedPosts error:', error);
      throw error;
    }
  },

  async generateComments(settings: AppSettings, postContent: string, count: number = 3): Promise<Comment[]> {
    const prompt = `Generate ${count} realistic comments for this post: "${postContent}".
    Return a JSON array of objects with keys: "authorName", "authorHandle", "content".`;

    try {
      const response = await fetch(`${getBaseUrl(settings.baseUrl)}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model,
          system: SYSTEM_PROMPT,
          prompt: prompt,
          stream: false,
          format: 'json',
        }),
      });

      if (!response.ok) throw new Error('Ollama API request failed');

      const data = await response.json();
      const parsed = parseOllamaJson(data.response);
      const rawComments = ensureArray(parsed, 'comments');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rawComments.map((c: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        author: {
          id: Math.random().toString(36).substr(2, 9),
          name: c.authorName,
          handle: c.authorHandle,
          avatar: `https://api.dicebear.com/7.x/avataaars/png?seed=${c.authorHandle}`,
        },
        content: c.content,
        createdAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('generateComments error:', error);
      throw error;
    }
  },

  async generateDraft(settings: AppSettings, topic: string): Promise<string> {
    const prompt = `Write a short, engaging social media post about: ${topic}.
    Return a JSON object with a single key: "content".`;

    try {
      const response = await fetch(`${getBaseUrl(settings.baseUrl)}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model,
          system: SYSTEM_PROMPT,
          prompt: prompt,
          stream: false,
          format: 'json',
        }),
      });

      if (!response.ok) throw new Error('Ollama API request failed');

      const data = await response.json();
      const parsed = JSON.parse(data.response);
      return parsed.content;
    } catch (error) {
      console.error('generateDraft error:', error);
      throw error;
    }
  }
};
