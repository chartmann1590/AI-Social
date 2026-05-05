export interface User {
  id: string;
  name: string;
  handle: string;
  avatar: string; // URL or seed for placeholder
}

export interface Post {
  id: string;
  author: User;
  content: string;
  createdAt: string;
  likes: number;
  commentsCount: number;
  media?: MediaAsset[];
}

export interface Comment {
  id: string;
  author: User;
  content: string;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  type: 'image' | 'video';
  uri: string;
  thumbnailUri?: string;
  source?: 'local' | 'pixabay' | 'ai';
  provider?: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';

/** Where inference runs: device MediaPipe/LiteRT, remote Ollama, or local-first with fallback. */
export type LlmMode = 'local' | 'remote' | 'hybrid';

export interface AppSettings {
  baseUrl: string;
  model: string;
  useStreaming: boolean;
  themePreference: ThemePreference;
  llmMode: LlmMode;
  /** When `hybrid`, use Ollama if on-device fails or is unavailable. */
  enableRemoteFallback: boolean;
  /** Absolute path to a MediaPipe-compatible `.task` model on the device (e.g. from adb push). */
  localModelPath: string;
  localImageModelPath: string;
  localMaxTokens: number;
  localTemperature: number;
  pixabayApiKey: string;
}

export interface UserProfile {
  name: string;
  handle: string;
  /** DiceBear seed used to render the avatar PNG. */
  avatarSeed: string;
  /** Optional one-line vibe set during onboarding. */
  bio: string;
}
