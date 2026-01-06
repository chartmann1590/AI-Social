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
}

export interface Comment {
  id: string;
  author: User;
  content: string;
  createdAt: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  baseUrl: string;
  model: string;
  useStreaming: boolean;
  themePreference: ThemePreference;
}
