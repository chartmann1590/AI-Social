/** Shared system prompt for all LLM backends (Ollama + on-device). */
export const SYSTEM_PROMPT = `You are the backend engine for a simulated social media app called AISocial.

Your job is to generate realistic, engaging, and safe (PG-13) social media content.

Always return valid JSON arrays or objects as requested.

Do not include markdown formatting (like \`\`\`json) in your response, just the raw JSON.`;

const POST_THEMES = [
  'a small daily-life moment (coffee, commute, cooking, pets)',
  'an unpopular opinion or hot take',
  'a tiny life win or accomplishment',
  'a self-deprecating joke or relatable complaint',
  'a piece of tech news or a new gadget reaction',
  'a travel observation or photo caption',
  'a book, movie, or show recommendation',
  'a fitness, running, or gym update',
  'a food discovery or recipe mishap',
  'a work-from-home or office anecdote',
  'a random shower thought or philosophical question',
  'an announcement (new job, move, side project launch)',
  'a music discovery or concert reaction',
  'a weather or seasonal comment',
  'a pet or family-member story',
];

const POST_TONES = ['funny', 'sincere', 'sarcastic', 'enthusiastic', 'cynical', 'reflective', 'excited'];

function pickN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
}

export function buildFeedPostsPrompt(count: number): string {
  const themes = pickN(POST_THEMES, Math.max(count, 3));
  const tone = POST_TONES[Math.floor(Math.random() * POST_TONES.length)];
  const seed = Math.random().toString(36).slice(2, 8);
  const themeLines = themes.slice(0, count).map((t, i) => `${i + 1}. ${t}`).join('\n    ');
  return `Generate ${count} distinct social media posts for a realistic feed (seed: ${seed}).
    Use a ${tone} overall tone, but vary voice, punctuation, and length across posts.
    Each post should feel like a real human wrote it — some short (one line), some longer (2-4 sentences). Include occasional hashtags, emojis, abbreviations, lowercase starts, or typos where natural. NO two posts should use the same opener or sentence structure.
    Each author has a realistic handle (firstname_lastname, initials+numbers, or a nickname — NOT always "firstname_1234567890"). Vary nationalities and name origins.
    Use each of these themes once, in order:
    ${themeLines}
    Return ONLY a JSON array (no prose, no markdown) of objects with keys: "authorName" (string), "authorHandle" (string, no @ prefix), "content" (string).`;
}

export function buildCommentsPrompt(postContent: string, count: number): string {
  return `Generate ${count} realistic comments for this post: "${postContent}".
    Return a JSON array of objects with keys: "authorName", "authorHandle", "content".`;
}

export function buildDraftPrompt(topic: string): string {
  return `Write a short, engaging social media post about: ${topic}.
    Return a JSON object with a single key: "content".`;
}

/** Full prompt sent to models that expect a single user message (e.g. on-device). */
export function buildFullPrompt(system: string, user: string): string {
  return `${system}\n\n${user}`;
}
