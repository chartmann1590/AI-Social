import type { AppSettings, Comment, Post } from '../../../types';
import type { LlmProvider } from '../types';
import {
  buildCommentsPrompt,
  buildDraftPrompt,
  buildFeedPostsPrompt,
  SYSTEM_PROMPT,
} from '../prompts';
import {
  ensureArray,
  extractDraftText,
  getBaseUrl,
  mapRawCommentsToComments,
  mapRawPostsToPosts,
  parseModelJson,
} from '../jsonUtils';

const parseOllamaResponse = (data: { response: string }) => parseModelJson(data.response);

function ensureOllamaConfigured(settings: AppSettings): void {
  if (!settings.baseUrl?.trim()) {
    throw new Error(
      'Ollama is not configured. Open Settings and enter your Ollama Base URL, or switch LLM mode to On-device.',
    );
  }
  if (!settings.model?.trim()) {
    throw new Error(
      'Ollama model name is empty. Open Settings and set a model pulled on your Ollama server (e.g. llama3.2), or switch LLM mode to On-device.',
    );
  }
}

async function readOllamaErrorDetail(response: Response): Promise<string> {
  try {
    const text = await response.text();
    const trimmed = text.slice(0, 280);
    return trimmed || response.statusText;
  } catch {
    return response.statusText;
  }
}

export const remoteOllamaProvider: LlmProvider = {
  id: 'remote',

  async generateFeedPosts(settings: AppSettings, count: number = 5): Promise<Post[]> {
    ensureOllamaConfigured(settings);
    const prompt = buildFeedPostsPrompt(count);
    const url = `${getBaseUrl(settings.baseUrl)}/api/generate`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model,
          system: SYSTEM_PROMPT,
          prompt,
          stream: false,
          format: 'json',
          options: { temperature: 0.8 },
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Cannot reach Ollama at ${url} (${msg}). Check Wi‑Fi/VPN, server is up, and OLLAMA_HOST=0.0.0.0 if remote.`,
      );
    }

    if (!response.ok) {
      const detail = await readOllamaErrorDetail(response);
      throw new Error(`Ollama HTTP ${response.status}: ${detail}`);
    }

    const data = await response.json();
    const parsed = parseOllamaResponse(data);
    const rawPosts = ensureArray(parsed, 'posts');
    return mapRawPostsToPosts(rawPosts);
  },

  async generateComments(
    settings: AppSettings,
    postContent: string,
    count: number = 3,
  ): Promise<Comment[]> {
    ensureOllamaConfigured(settings);
    const prompt = buildCommentsPrompt(postContent, count);
    const response = await fetch(`${getBaseUrl(settings.baseUrl)}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.model,
        system: SYSTEM_PROMPT,
        prompt,
        stream: false,
        format: 'json',
      }),
    });

    if (!response.ok) {
      throw new Error('Ollama API request failed');
    }

    const data = await response.json();
    const parsed = parseOllamaResponse(data);
    const rawComments = ensureArray(parsed, 'comments');
    return mapRawCommentsToComments(rawComments);
  },

  async generateText(settings: AppSettings, prompt: string): Promise<string> {
    ensureOllamaConfigured(settings);
    const url = `${getBaseUrl(settings.baseUrl)}/api/generate`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model,
          prompt,
          stream: false,
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Cannot reach Ollama at ${url} (${msg}).`);
    }
    if (!response.ok) {
      const detail = await readOllamaErrorDetail(response);
      throw new Error(`Ollama HTTP ${response.status}: ${detail}`);
    }
    const data = await response.json();
    const text = typeof data?.response === 'string' ? data.response.trim() : '';
    if (!text) throw new Error('Empty text response from Ollama');
    return text;
  },

  async generateDraft(settings: AppSettings, topic: string): Promise<string> {
    ensureOllamaConfigured(settings);
    const prompt = buildDraftPrompt(topic);
    const url = `${getBaseUrl(settings.baseUrl)}/api/generate`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model,
          system: SYSTEM_PROMPT,
          prompt,
          stream: false,
          format: 'json',
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Cannot reach Ollama at ${url} (${msg}).`);
    }

    if (!response.ok) {
      const detail = await readOllamaErrorDetail(response);
      throw new Error(`Ollama HTTP ${response.status}: ${detail}`);
    }

    const data = await response.json();
    const draft = extractDraftText(data.response);
    if (!draft) {
      throw new Error('Invalid draft response');
    }
    return draft;
  },
};
