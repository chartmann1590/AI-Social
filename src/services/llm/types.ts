import type { AppSettings, Comment, Post } from '../../types';

/** Subset of settings the LLM layer reads (extends as AppSettings grows). */
export type LlmSettings = AppSettings;

export interface LlmProvider {
  readonly id: 'local' | 'remote';
  /** `baseTime` ms: newest post in the batch is stamped near this instant (staggered older per item). */
  generateFeedPosts(settings: LlmSettings, count: number, baseTime?: number): Promise<Post[]>;
  generateComments(settings: LlmSettings, postContent: string, count: number): Promise<Comment[]>;
  generateDraft(settings: LlmSettings, topic: string): Promise<string>;
  /** Free-form text generation — no JSON wrapping. Used by onboarding tour and similar narrative prompts. */
  generateText(settings: LlmSettings, prompt: string): Promise<string>;
}
