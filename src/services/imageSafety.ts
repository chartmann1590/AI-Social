/**
 * Pre-generation safety filter for AI Social's image generation.
 *
 * Why this exists: Google Play suspended com.charles.aisocial on
 * 2026-10-28 for a Sexual Content / AI-Generated Content violation
 * (version code 262071745, in-app experience). The Compose screen was
 * sending the user's image prompt verbatim to the image provider, with
 * no prompt check and no provider-side safe filter, so a prompt asking
 * for a nude person produced exactly that image in the app.
 *
 * Defense in depth, in order:
 *  1. This local check runs BEFORE any network request is made, so a
 *     blocked prompt never reaches the provider at all.
 *  2. Allowed prompts are sent with the provider's strict safe filter
 *     (`safe=true`) and a "fully clothed, no nudity, no sexual content"
 *     suffix (see ComposeScreen.generateImageAsset).
 *  3. Posts already carry in-app reporting (PostCard / PostDetailScreen
 *     -> ReportContentDialog -> contentReport.ts), which is the
 *     user-reporting half of the AI-Generated Content policy.
 *
 * This is a prompt filter, not an image classifier: it cannot inspect
 * pixels, so it is deliberately broad on sexual/nudity language and
 * on sexualised depictions of minors. False positives (a blocked
 * innocent prompt) are the safe failure mode here.
 */

export type ImagePromptCheck = {
  allowed: boolean;
  reason?: string;
};

const BLOCKED_MESSAGE =
  'This image prompt is blocked: AI Social does not generate sexual, nude, or explicit content. Try a fully clothed, non-sexual prompt instead.';

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeLeet(input: string): string {
  return input
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b');
}

// Word/phrase patterns, tested against the space-normalised prompt.
// Deliberately clinical wording only; these are blocklist entries,
// not content the app will ever generate or display.
const BLOCKED_PATTERNS: RegExp[] = [
  /\bnude\b/,
  /\bnaked\b/,
  /\bnudity\b/,
  /\btopless\b/,
  /\bbottomless\b/,
  /\bundressed\b/,
  /\bunclothed\b/,
  /\bwithout clothes\b/,
  /\bwithout clothing\b/,
  /\bno clothes\b/,
  /\bno clothing\b/,
  /\bin the nude\b/,
  /\bbirthday suit\b/,
  /\bporn\b/,
  /\bpornography\b/,
  /\berotic\b/,
  /\berotica\b/,
  /\bnsfw\b/,
  /\bsex\b/,
  /\bsexual\b/,
  /\bsexually\b/,
  /\bsex act\b/,
  /\bintercourse\b/,
  /\bmasturbat\w*\b/,
  /\borgasm\b/,
  /\bgenital\w*\b/,
  /\bpenis\b/,
  /\bvagina\b/,
  /\bbare breast\w*\b/,
  /\bexposed breast\w*\b/,
  /\bnude breast\w*\b/,
  /\bseductive\b/,
  /\bsexy\b/,
  /\blingerie\b/,
  /\bthong\b/,
  /\bstrip club\b/,
  /\bstripping\b/,
  /\bonlyfans\b/,
  /\bsuggestive pose\b/,
  /\bsexually suggestive\b/,
];

// Single-word substrings, tested against the punctuation-stripped,
// leet-decoded prompt, so "n.u.d.e" or "nud3" do not slip through.
const BLOCKED_WORDS: string[] = [
  'nude',
  'naked',
  'nudity',
  'topless',
  'porn',
  'erotic',
  'nsfw',
  'sexact',
  'intercourse',
  'onlyfans',
];

const MINOR_PATTERN =
  /\b(child|children|minor|teen|teenager|teenagers|kid|kids|boy|girl|schoolgirl|schoolboy|underage|toddler)\b/;
const MINOR_REVEALING_PATTERN = /\b(bikini|swimsuit|lingerie|underwear|topless|nude|naked)\b/;

export function checkImagePrompt(prompt: string): ImagePromptCheck {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { allowed: false, reason: 'Enter a prompt first.' };
  }

  const spaced = normalize(trimmed);
  const flat = decodeLeet(spaced.replace(/ /g, ''));

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(spaced)) {
      return { allowed: false, reason: BLOCKED_MESSAGE };
    }
  }

  for (const word of BLOCKED_WORDS) {
    if (flat.includes(word)) {
      return { allowed: false, reason: BLOCKED_MESSAGE };
    }
  }

  // Sexualised depictions of minors are blocked even when the wording
  // is not itself an explicit term (e.g. a minor in swimwear/underwear
  // presented as image subject). Ordinary, non-sexual prompts about
  // minors (e.g. "a child playing soccer") do not hit this rule.
  if (MINOR_PATTERN.test(spaced) && MINOR_REVEALING_PATTERN.test(spaced)) {
    return { allowed: false, reason: BLOCKED_MESSAGE };
  }

  return { allowed: true };
}

/**
 * Returns the prompt that may actually be sent to the provider:
 * the user's prompt plus a safe framing suffix. Throws with a
 * user-facing message when the prompt is blocked, so callers can
 * surface it directly (ComposeScreen already shows thrown errors
 * in an alert).
 */
export function buildSafeImagePrompt(prompt: string): string {
  const check = checkImagePrompt(prompt);
  if (!check.allowed) {
    throw new Error(check.reason ?? BLOCKED_MESSAGE);
  }
  return (
    `${prompt.trim()}, fully clothed in ordinary clothing suitable ` +
    `for a public setting, no nudity, no sexual content`
  );
}
