import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local moderation state: what the user reported or hid, and authors they
 * muted. Reporting something hides it immediately on this phone, whether or
 * not the copy sent to the developer goes through, and the report is kept
 * here (most recent 200) so nothing reported ever reappears.
 */
export type ReportedType = 'post' | 'comment' | 'image';

export interface StoredReport {
  id: string;
  type: ReportedType;
  contentId: string;
  reason: string;
  note?: string;
  excerpt: string;
  authorHandle?: string;
  at: string;
  sentToDeveloper: boolean;
}

interface ModerationState {
  hiddenIds: string[];
  mutedAuthors: string[];
  reports: StoredReport[];
  recordReport: (r: Omit<StoredReport, 'id' | 'at' | 'sentToDeveloper'>) => string;
  markSent: (reportId: string) => void;
  hide: (contentId: string) => void;
  muteAuthor: (handle: string) => void;
  unmuteAuthor: (handle: string) => void;
}

function normHandle(h: string): string {
  return h.trim().replace(/^@/, '').toLowerCase();
}

export const useModerationStore = create<ModerationState>()(
  persist(
    (set, get) => ({
      hiddenIds: [],
      mutedAuthors: [],
      reports: [],
      recordReport: (r) => {
        const id = `rep-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
        const entry: StoredReport = { ...r, id, at: new Date().toISOString(), sentToDeveloper: false };
        const hidden = r.contentId && !get().hiddenIds.includes(r.contentId)
          ? [...get().hiddenIds, r.contentId]
          : get().hiddenIds;
        set({ reports: [entry, ...get().reports].slice(0, 200), hiddenIds: hidden.slice(-2000) });
        return id;
      },
      markSent: (reportId) =>
        set({
          reports: get().reports.map((r) => (r.id === reportId ? { ...r, sentToDeveloper: true } : r)),
        }),
      hide: (contentId) => {
        if (!contentId || get().hiddenIds.includes(contentId)) return;
        set({ hiddenIds: [...get().hiddenIds, contentId].slice(-2000) });
      },
      muteAuthor: (handle) => {
        const h = normHandle(handle);
        if (!h || get().mutedAuthors.includes(h)) return;
        set({ mutedAuthors: [...get().mutedAuthors, h] });
      },
      unmuteAuthor: (handle) => {
        const h = normHandle(handle);
        set({ mutedAuthors: get().mutedAuthors.filter((x) => x !== h) });
      },
    }),
    {
      name: 'moderation-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

export function isHiddenContent(
  state: Pick<ModerationState, 'hiddenIds' | 'mutedAuthors'>,
  contentId: string,
  authorHandle?: string,
): boolean {
  if (contentId && state.hiddenIds.includes(contentId)) return true;
  if (authorHandle && state.mutedAuthors.includes(normHandle(authorHandle))) return true;
  return false;
}
