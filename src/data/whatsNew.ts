export interface WhatsNewEntry {
  /** Bump whenever there's a new entry to show — not tied to the Play Store versionCode. */
  id: string;
  title: string;
  notes: string[];
}

/** Newest first. Only entries[0] is ever shown (see useWhatsNewStore). */
export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: '2026.07.20-reporting',
    title: "What's new",
    notes: [
      'Report any AI-generated post or comment straight from the feed.',
      'Fixed on-device model downloads for Gemma, Qwen, DeepSeek, and Stable Diffusion.',
      'Fixed a startup crash affecting some devices.',
      'Fixed the in-app Support & Feedback bug reporter.',
    ],
  },
];
