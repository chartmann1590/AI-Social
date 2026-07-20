import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, Post, Comment, ThemePreference, LlmMode, UserProfile } from '../types';

function sortPostsByCreatedAtDesc(list: Post[]): Post[] {
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
import { DEFAULT_CONFIG } from '../config';
import { AD_REWARD_DAILY_LIMIT, getLocalDayKey } from '../rewards/adFreeRewards';
import { WHATS_NEW } from '../data/whatsNew';

interface SettingsState extends AppSettings {
  setBaseUrl: (url: string) => void;
  setModel: (model: string) => void;
  setUseStreaming: (use: boolean) => void;
  setThemePreference: (preference: ThemePreference) => void;
  setLlmMode: (mode: LlmMode) => void;
  setEnableRemoteFallback: (enable: boolean) => void;
  setLocalModelPath: (path: string) => void;
  setLocalImageModelPath: (path: string) => void;
  setLocalMaxTokens: (n: number) => void;
  setLocalTemperature: (t: number) => void;
  setPixabayApiKey: (key: string) => void;
  setDailyReminderEnabled: (enabled: boolean) => void;
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
      localImageModelPath: '',
      localMaxTokens: 1024,
      localTemperature: 0.8,
      pixabayApiKey: '',
      dailyReminderEnabled: false,
      setBaseUrl: (baseUrl) => set({ baseUrl }),
      setModel: (model) => set({ model }),
      setUseStreaming: (useStreaming) => set({ useStreaming }),
      setThemePreference: (themePreference) => set({ themePreference }),
      setLlmMode: (llmMode) => set({ llmMode }),
      setEnableRemoteFallback: (enableRemoteFallback) => set({ enableRemoteFallback }),
      setLocalModelPath: (localModelPath) => set({ localModelPath }),
      setLocalImageModelPath: (localImageModelPath) => set({ localImageModelPath }),
      setLocalMaxTokens: (localMaxTokens) => set({ localMaxTokens }),
      setLocalTemperature: (localTemperature) => set({ localTemperature }),
      setPixabayApiKey: (pixabayApiKey) => set({ pixabayApiKey }),
      setDailyReminderEnabled: (dailyReminderEnabled) => set({ dailyReminderEnabled }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 4,
      migrate: (persistedState: unknown, fromVersion: number) => {
        let s = (persistedState ?? {}) as Record<string, unknown>;
        if (fromVersion < 3) {
          s = {
            ...s,
            llmMode: (s.llmMode as LlmMode | undefined) ?? 'local',
            enableRemoteFallback: (s.enableRemoteFallback as boolean | undefined) ?? true,
            localModelPath: (s.localModelPath as string | undefined) ?? '',
            localImageModelPath: (s.localImageModelPath as string | undefined) ?? '',
            localMaxTokens: (s.localMaxTokens as number | undefined) ?? 1024,
            localTemperature: (s.localTemperature as number | undefined) ?? 0.8,
            pixabayApiKey: (s.pixabayApiKey as string | undefined) ?? '',
          };
        }
        if (fromVersion < 4) {
          s = { ...s, dailyReminderEnabled: (s.dailyReminderEnabled as boolean | undefined) ?? false };
        }
        return s;
      },
    },
  ),
);

interface UserState {
  onboardingComplete: boolean;
  profile: UserProfile;
  /** Timestamp (ms) of the moment onboarding was first completed. Used for the Profile "Joined …" line. */
  joinedAt: number;
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
    (set, get) => ({
      onboardingComplete: false,
      profile: EMPTY_PROFILE,
      joinedAt: 0,
      setProfile: (profile) =>
        set((state) => ({ profile: { ...state.profile, ...profile } })),
      setOnboardingComplete: (onboardingComplete) => {
        const existing = get().joinedAt;
        const isFirstCompletion = onboardingComplete && !existing;
        set({
          onboardingComplete,
          joinedAt: isFirstCompletion ? Date.now() : existing,
        });
        if (isFirstCompletion) {
          // Baseline "what's new" to the current entry so a brand-new install never
          // sees a changelog for the version it just installed with.
          const latest = WHATS_NEW[0];
          if (latest) useWhatsNewStore.getState().markSeen(latest.id);
        }
      },
      resetOnboarding: () =>
        set({ onboardingComplete: false, profile: EMPTY_PROFILE, joinedAt: 0 }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const s = (persistedState ?? {}) as Record<string, unknown>;
        if (fromVersion < 2) {
          return {
            ...s,
            joinedAt:
              typeof s.joinedAt === 'number' && s.joinedAt > 0
                ? s.joinedAt
                : s.onboardingComplete
                  ? Date.now()
                  : 0,
          };
        }
        return persistedState;
      },
    },
  ),
);

type RewardActionResult =
  | { ok: true; adFreeUntil?: number; credits?: number }
  | { ok: false; message: string };

interface AdRewardsState {
  credits: number;
  dayKey: string;
  earnedToday: number;
  redeemedToday: number;
  adFreeUntil: number;
  hasSeenRewardsIntro: boolean;
  earnCredit: () => RewardActionResult;
  redeemCredits: (credits: number, durationMs: number) => RewardActionResult;
  markRewardsIntroSeen: () => void;
  refreshDailyLimits: () => void;
}

function normalizeRewardsDay(state: AdRewardsState): AdRewardsState {
  const today = getLocalDayKey();

  if (state.dayKey === today) {
    return state;
  }

  return {
    ...state,
    dayKey: today,
    earnedToday: 0,
    redeemedToday: 0,
  };
}

export const useAdRewardsStore = create<AdRewardsState>()(
  persist(
    (set, get) => ({
      credits: 0,
      dayKey: getLocalDayKey(),
      earnedToday: 0,
      redeemedToday: 0,
      adFreeUntil: 0,
      hasSeenRewardsIntro: false,
      earnCredit: () => {
        const normalized = normalizeRewardsDay(get());

        if (normalized.earnedToday >= AD_REWARD_DAILY_LIMIT) {
          set({
            dayKey: normalized.dayKey,
            earnedToday: normalized.earnedToday,
            redeemedToday: normalized.redeemedToday,
          });
          return {
            ok: false,
            message: `You can earn up to ${AD_REWARD_DAILY_LIMIT} credits per day. Come back tomorrow for more.`,
          };
        }

        const credits = normalized.credits + 1;

        set({
          credits,
          dayKey: normalized.dayKey,
          earnedToday: normalized.earnedToday + 1,
          redeemedToday: normalized.redeemedToday,
        });

        return { ok: true, credits };
      },
      redeemCredits: (creditsToRedeem, durationMs) => {
        const normalized = normalizeRewardsDay(get());

        if (creditsToRedeem <= 0) {
          return { ok: false, message: 'Choose a valid redemption option.' };
        }

        if (normalized.credits < creditsToRedeem) {
          return {
            ok: false,
            message: 'You do not have enough credits for that option yet.',
          };
        }

        if (normalized.redeemedToday + creditsToRedeem > AD_REWARD_DAILY_LIMIT) {
          return {
            ok: false,
            message: `You can redeem up to ${AD_REWARD_DAILY_LIMIT} credits per day.`,
          };
        }

        const now = Date.now();
        const adFreeUntil = Math.max(now, normalized.adFreeUntil) + durationMs;

        set({
          credits: normalized.credits - creditsToRedeem,
          dayKey: normalized.dayKey,
          earnedToday: normalized.earnedToday,
          redeemedToday: normalized.redeemedToday + creditsToRedeem,
          adFreeUntil,
        });

        return { ok: true, adFreeUntil };
      },
      markRewardsIntroSeen: () => set({ hasSeenRewardsIntro: true }),
      refreshDailyLimits: () => {
        const normalized = normalizeRewardsDay(get());

        set({
          dayKey: normalized.dayKey,
          earnedToday: normalized.earnedToday,
          redeemedToday: normalized.redeemedToday,
        });
      },
    }),
    {
      name: 'ad-rewards-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: unknown) => {
        const s = (persistedState ?? {}) as Partial<AdRewardsState>;

        return {
          credits: typeof s.credits === 'number' ? s.credits : 0,
          dayKey: typeof s.dayKey === 'string' ? s.dayKey : getLocalDayKey(),
          earnedToday: typeof s.earnedToday === 'number' ? s.earnedToday : 0,
          redeemedToday: typeof s.redeemedToday === 'number' ? s.redeemedToday : 0,
          adFreeUntil: typeof s.adFreeUntil === 'number' ? s.adFreeUntil : 0,
          hasSeenRewardsIntro:
            typeof s.hasSeenRewardsIntro === 'boolean' ? s.hasSeenRewardsIntro : false,
        };
      },
    },
  ),
);

interface FeedState {
  posts: Post[];
  addPost: (post: Post) => void;
  setPosts: (posts: Post[]) => void;
  prependPosts: (posts: Post[]) => void;
  appendPosts: (posts: Post[]) => void;
  updatePostLikes: (postId: string, likes: number) => void;
  updatePostCommentCount: (postId: string, commentsCount: number) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  posts: [],
  addPost: (post) =>
    set((state) => ({ posts: sortPostsByCreatedAtDesc([post, ...state.posts]) })),
  setPosts: (posts) => set({ posts }),
  prependPosts: (newPosts) => set((state) => ({ posts: [...newPosts, ...state.posts] })),
  appendPosts: (newPosts) =>
    set((state) => ({ posts: sortPostsByCreatedAtDesc([...state.posts, ...newPosts]) })),
  updatePostLikes: (postId, likes) =>
    set((state) => ({
      posts: state.posts.map((post) => (post.id === postId ? { ...post, likes } : post)),
    })),
  updatePostCommentCount: (postId, commentsCount) =>
    set((state) => ({
      posts: state.posts.map((post) =>
        post.id === postId ? { ...post, commentsCount } : post,
      ),
    })),
}));

interface UserPostsState {
  posts: Post[];
  addPost: (post: Post) => void;
  removePost: (id: string) => void;
  clearAll: () => void;
  updatePostLikes: (postId: string, likes: number) => void;
  updatePostCommentCount: (postId: string, commentsCount: number) => void;
}

/**
 * Posts authored by the user (via Compose). Persisted to AsyncStorage so the Profile
 * page survives cold starts even though the AI-generated feed is in-memory only.
 */
export const useUserPostsStore = create<UserPostsState>()(
  persist(
    (set) => ({
      posts: [],
      addPost: (post) =>
        set((state) => {
          if (state.posts.some((p) => p.id === post.id)) return state;
          return { posts: [post, ...state.posts] };
        }),
      removePost: (id) =>
        set((state) => ({ posts: state.posts.filter((p) => p.id !== id) })),
      clearAll: () => set({ posts: [] }),
      updatePostLikes: (postId, likes) =>
        set((state) => ({
          posts: state.posts.map((post) => (post.id === postId ? { ...post, likes } : post)),
        })),
      updatePostCommentCount: (postId, commentsCount) =>
        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === postId ? { ...post, commentsCount } : post,
          ),
        })),
    }),
    {
      name: 'user-posts-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

interface PostEngagementState {
  likesByPostId: Record<string, number>;
  ensureLikeCount: (postId: string, min?: number, max?: number) => number;
  growLikeCount: (postId: string, minInc?: number, maxInc?: number) => number;
  getLikeCount: (postId: string) => number;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Persisted per-post likes so each post gets a stable random baseline and likes can
 * grow over time while surviving navigation and app relaunches.
 */
export const usePostEngagementStore = create<PostEngagementState>()(
  persist(
    (set, get) => ({
      likesByPostId: {},
      ensureLikeCount: (postId, min = 6, max = 180) => {
        const existing = get().likesByPostId[postId];
        if (typeof existing === 'number') {
          return existing;
        }
        const likes = randomInt(min, max);
        set((state) => ({
          likesByPostId: {
            ...state.likesByPostId,
            [postId]: likes,
          },
        }));
        return likes;
      },
      growLikeCount: (postId, minInc = 1, maxInc = 7) => {
        const current = get().likesByPostId[postId] ?? get().ensureLikeCount(postId);
        const next = current + randomInt(minInc, maxInc);
        set((state) => ({
          likesByPostId: {
            ...state.likesByPostId,
            [postId]: next,
          },
        }));
        return next;
      },
      getLikeCount: (postId) => get().likesByPostId[postId] ?? 0,
    }),
    {
      name: 'post-engagement-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

interface PostCommentsState {
  commentsByPostId: Record<string, Comment[]>;
  setCommentsForPost: (postId: string, comments: Comment[]) => void;
  appendCommentsForPost: (postId: string, comments: Comment[]) => void;
}

/**
 * Persisted comment threads keyed by post id so returning to PostDetail does not
 * regenerate comments and so counts can stay in sync with Feed/Profile cards.
 */
export const usePostCommentsStore = create<PostCommentsState>()(
  persist(
    (set) => ({
      commentsByPostId: {},
      setCommentsForPost: (postId, comments) =>
        set((state) => ({
          commentsByPostId: {
            ...state.commentsByPostId,
            [postId]: comments,
          },
        })),
      appendCommentsForPost: (postId, comments) =>
        set((state) => ({
          commentsByPostId: {
            ...state.commentsByPostId,
            [postId]: [...(state.commentsByPostId[postId] ?? []), ...comments],
          },
        })),
    }),
    {
      name: 'post-comments-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

interface WhatsNewState {
  /** id of the newest WHATS_NEW entry the user has already dismissed, or null if never shown. */
  lastSeenId: string | null;
  markSeen: (id: string) => void;
}

export const useWhatsNewStore = create<WhatsNewState>()(
  persist(
    (set) => ({
      lastSeenId: null,
      markSeen: (id) => set({ lastSeenId: id }),
    }),
    {
      name: 'whats-new-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

/**
 * True once there's a WHATS_NEW entry the user hasn't dismissed. `lastSeenId` starts
 * `null` for everyone; onboarding completion immediately marks the current latest
 * entry as seen (see useUserStore.setOnboardingComplete) so brand-new installs never
 * see a "what's new" for the version they just installed — only existing users
 * (whose lastSeenId predates the new entry, including previously-null) see it.
 */
export function hasUnseenWhatsNew(lastSeenId: string | null): boolean {
  const latest = WHATS_NEW[0];
  return latest != null && lastSeenId !== latest.id;
}
