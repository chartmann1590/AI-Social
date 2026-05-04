import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, Post, Comment, ThemePreference, LlmMode, UserProfile } from '../types';
import { DEFAULT_CONFIG } from '../config';

interface SettingsState extends AppSettings {
  setBaseUrl: (url: string) => void;
  setModel: (model: string) => void;
  setUseStreaming: (use: boolean) => void;
  setThemePreference: (preference: ThemePreference) => void;
  setLlmMode: (mode: LlmMode) => void;
  setEnableRemoteFallback: (enable: boolean) => void;
  setLocalModelPath: (path: string) => void;
  setLocalMaxTokens: (n: number) => void;
  setLocalTemperature: (t: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      baseUrl: DEFAULT_CONFIG.OLLAMA_BASE_URL,
      model: DEFAULT_CONFIG.OLLAMA_MODEL,
      useStreaming: false,
      themePreference: 'system',
      llmMode: 'local',
      enableRemoteFallback: true,
      localModelPath: '',
      localMaxTokens: 1024,
      localTemperature: 0.8,
      setBaseUrl: (baseUrl) => set({ baseUrl }),
      setModel: (model) => set({ model }),
      setUseStreaming: (useStreaming) => set({ useStreaming }),
      setThemePreference: (themePreference) => set({ themePreference }),
      setLlmMode: (llmMode) => set({ llmMode }),
      setEnableRemoteFallback: (enableRemoteFallback) => set({ enableRemoteFallback }),
      setLocalModelPath: (localModelPath) => set({ localModelPath }),
      setLocalMaxTokens: (localMaxTokens) => set({ localMaxTokens }),
      setLocalTemperature: (localTemperature) => set({ localTemperature }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const s = (persistedState ?? {}) as Record<string, unknown>;
        if (fromVersion < 2) {
          return {
            ...s,
            llmMode: (s.llmMode as LlmMode | undefined) ?? 'local',
            enableRemoteFallback: (s.enableRemoteFallback as boolean | undefined) ?? true,
            localModelPath: (s.localModelPath as string | undefined) ?? '',
            localMaxTokens: (s.localMaxTokens as number | undefined) ?? 1024,
            localTemperature: (s.localTemperature as number | undefined) ?? 0.8,
          };
        }
        return persistedState;
      },
    },
  ),
);

interface UserState {
  onboardingComplete: boolean;
  profile: UserProfile;
  setProfile: (profile: Partial<UserProfile>) => void;
  setOnboardingComplete: (done: boolean) => void;
  resetOnboarding: () => void;
}

const EMPTY_PROFILE: UserProfile = {
  name: '',
  handle: '',
  avatarSeed: '',
  bio: '',
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      onboardingComplete: false,
      profile: EMPTY_PROFILE,
      setProfile: (profile) =>
        set((state) => ({ profile: { ...state.profile, ...profile } })),
      setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
      resetOnboarding: () => set({ onboardingComplete: false, profile: EMPTY_PROFILE }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

interface FeedState {
  posts: Post[];
  addPost: (post: Post) => void;
  setPosts: (posts: Post[]) => void;
  prependPosts: (posts: Post[]) => void;
  appendPosts: (posts: Post[]) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  posts: [],
  addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
  setPosts: (posts) => set({ posts }),
  prependPosts: (newPosts) => set((state) => ({ posts: [...newPosts, ...state.posts] })),
  appendPosts: (newPosts) => set((state) => ({ posts: [...state.posts, ...newPosts] })),
}));
