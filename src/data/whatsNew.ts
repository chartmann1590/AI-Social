export interface WhatsNewEntry {
  /** Bump whenever there's a new entry to show — not tied to the Play Store versionCode. */
  id: string;
  title: string;
  notes: string[];
}

/** Newest first. Only entries[0] is ever shown (see useWhatsNewStore). */
export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: '2026.11.03-textonly',
    title: "What's new",
    notes: [
      'The feed is now text only: no image generation, image links or media imports.',
      'AI posts, comments and your own posts are filtered for sexual content, swearing and slurs.',
      'Tap the flag on any AI post or comment to report it: it is hidden right away. You can also hide an AI author.',
    ],
  },
];
