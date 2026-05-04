import { NativeModules, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import type { AppSettings, Comment, Post } from '../../../types';
import { assertLooksLikeMediapipeTaskFile } from '../../modelDownload';
import type { LlmProvider } from '../types';
import {
  buildCommentsPrompt,
  buildDraftPrompt,
  buildFeedPostsPrompt,
  buildFullPrompt,
  SYSTEM_PROMPT,
} from '../prompts';
import {
  ensureArray,
  extractDraftText,
  mapRawCommentsToComments,
  mapRawPostsToPosts,
  parseModelJson,
} from '../jsonUtils';

type NativeLiteRt = {
  initialize: (modelPath: string, maxTokens: number, temperature: number) => Promise<void>;
  isReady: () => Promise<boolean>;
  generate: (prompt: string) => Promise<string>;
  shutdown: () => Promise<void>;
};

function getNative(): NativeLiteRt | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  const mod = NativeModules.AISocialLiteRtLlm as NativeLiteRt | undefined;
  return mod ?? null;
}

function nativeModuleMissingMessage(): string {
  if (Platform.OS !== 'android') {
    return 'On-device LLM is only supported on Android.';
  }
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return (
      'This build is Expo Go, which cannot load custom native code (the LiteRT module). ' +
      'Install the development app: from the project folder run `npm run android` (or `npx expo run:android`), ' +
      'then start Metro with `npm start` and open the app from the dev client, not from Expo Go.'
    );
  }
  return (
    'The LiteRT native module is not in this APK. Rebuild Android so the config plugin runs: ' +
    '`npx expo prebuild` then `npx expo run:android`. Use `npm start` (dev client), not Expo Go.'
  );
}

let lastInitKey = '';

/** Call after switching model file so the next request re-initializes native LLM. */
export function resetLocalLlmInitCache(): void {
  lastInitKey = '';
}

function initKey(settings: AppSettings): string {
  return `${settings.localModelPath?.trim() ?? ''}|${settings.localMaxTokens}|${settings.localTemperature}`;
}

async function ensureInitialized(settings: AppSettings): Promise<NativeLiteRt> {
  const native = getNative();
  if (!native) {
    throw new Error(nativeModuleMissingMessage());
  }
  let path = settings.localModelPath?.trim() ?? '';
  if (path.startsWith('file://')) {
    path = path.replace(/^file:\/\//, '');
  }
  if (!path) {
    throw new Error('Set a local model file path in Settings (e.g. path to your .task model on device).');
  }
  const fileUri = path.startsWith('file://') ? path : `file://${path}`;
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) {
    throw new Error(
      `Model file not found at ${path}. Open Settings → Models, download a .task bundle, then tap "Use model".`,
    );
  }
  const size = (info as { size?: number }).size ?? 0;
  if (size < 10_000_000) {
    throw new Error(
      `Model file at ${path} is only ${Math.round(size / 1024)} KB — the download is incomplete or not a real model. ` +
        'Open Settings → Models and re-download the .task bundle on stable Wi‑Fi.',
    );
  }
  await assertLooksLikeMediapipeTaskFile(fileUri);

  const key = initKey(settings);
  if (key === lastInitKey) {
    const ready = await native.isReady();
    if (ready) {
      return native;
    }
  }
  await native.initialize(path, settings.localMaxTokens, settings.localTemperature);
  lastInitKey = key;
  const ready = await native.isReady();
  if (!ready) {
    throw new Error('Local LLM failed to initialize.');
  }
  return native;
}

async function generateJsonText(settings: AppSettings, userPrompt: string): Promise<string> {
  const native = await ensureInitialized(settings);
  const full = buildFullPrompt(SYSTEM_PROMPT, userPrompt);
  const text = await native.generate(full);
  return text;
}

export const localLiteRtProvider: LlmProvider = {
  id: 'local',

  async generateFeedPosts(settings: AppSettings, count: number = 5): Promise<Post[]> {
    const userPrompt = buildFeedPostsPrompt(count);
    const text = await generateJsonText(settings, userPrompt);
    const parsed = parseModelJson(text);
    const rawPosts = ensureArray(parsed, 'posts');
    return mapRawPostsToPosts(rawPosts);
  },

  async generateComments(
    settings: AppSettings,
    postContent: string,
    count: number = 3,
  ): Promise<Comment[]> {
    const userPrompt = buildCommentsPrompt(postContent, count);
    const text = await generateJsonText(settings, userPrompt);
    const parsed = parseModelJson(text);
    const rawComments = ensureArray(parsed, 'comments');
    return mapRawCommentsToComments(rawComments);
  },

  async generateDraft(settings: AppSettings, topic: string): Promise<string> {
    const userPrompt = buildDraftPrompt(topic);
    const text = await generateJsonText(settings, userPrompt);
    const draft = extractDraftText(text);
    if (!draft) {
      throw new Error('Invalid draft response from local model');
    }
    return draft;
  },

  async generateText(settings: AppSettings, prompt: string): Promise<string> {
    const native = await ensureInitialized(settings);
    const text = await native.generate(prompt);
    return text;
  },
};
