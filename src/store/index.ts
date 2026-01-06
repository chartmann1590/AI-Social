import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, Post, Comment, ThemePreference } from '../types';
import { DEFAULT_CONFIG } from '../config';

interface SettingsState extends AppSettings {
  setBaseUrl: (url: string) => void;
  setModel: (model: string) => void;
  setUseStreaming: (use: boolean) => void;
  setThemePreference: (preference: ThemePreference) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      baseUrl: DEFAULT_CONFIG.OLLAMA_BASE_URL,
      model: DEFAULT_CONFIG.OLLAMA_MODEL,
      useStreaming: false,
      themePreference: 'system',
      setBaseUrl: (baseUrl) => set({ baseUrl }),
      setModel: (model) => set({ model }),
      setUseStreaming: (useStreaming) => set({ useStreaming }),
      setThemePreference: (themePreference) => set({ themePreference }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
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
