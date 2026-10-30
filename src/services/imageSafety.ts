/**
 * Content safety filters for AI Social (prompts and AI text).
 *
 * Why this exists: Google Play suspended com.charles.aisocial on
 * 2026-10-28 for a Sexual Content / AI-Generated Content violation:
 * the Compose screen's image generator produced a nude image from a
 * reviewer's prompt. AI Social has ZERO tolerance for nude or sexual
 * images, so image generation is guarded in layers:
 *
 *  1. Prompt filter (this file) runs BEFORE any network request. It
 *     normalises the prompt (case, accents, look-alike Unicode letters,
 *     symbol and digit leetspeak, spaced-out letters, repeated letters)
 *     and blocks sexual, nudity, revealing-clothing and fetish language
 *     in several languages, plus any sexualised framing of minors.
 *  2. Allowed prompts are sent with the provider's strict safe filter
 *     (`safe=true`) and a "fully clothed, no nudity" suffix.
 *  3. Every generated or attached image is downloaded and classified
 *     ON-DEVICE (src/services/nsfwClassifier.ts) before it is shown.
 *     Anything flagged is deleted and never displayed. If the classifier
 *     cannot run, the image is blocked (fail closed).
 *  4. Every AI post, comment and image can be reported; reporting hides
 *     it immediately and records the report (src/store/moderation.ts).
 *
 * False positives (an innocent prompt blocked) are the accepted failure
 * mode. The term lists below are blocklist entries only.
 */

export type ImagePromptCheck = {
  allowed: boolean;
  reason?: string;
};

export const BLOCKED_IMAGE_MESSAGE =
  'Not allowed: AI Social never creates nude, sexual or revealing images. Try a different, fully clothed, family-friendly idea.';

export const BLOCKED_TEXT_MESSAGE =
  'Not allowed: AI Social does not write sexual or explicit content. Try a different topic.';

// Look-alike letters from other scripts and fullwidth forms that NFKD
// does not fold to ASCII on its own.
const HOMOGLYPHS: Record<string, string> = {
  а: 'a', е: 'e', ё: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', к: 'k', м: 'm',
  т: 't', в: 'b', н: 'h', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ɡ: 'g', ո: 'n', ս: 'u',
  α: 'a', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x',
};

const SYMBOL_LEET: Record<string, string> = {
  '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't', '€': 'e', '£': 'l', '¡': 'i',
};

const DIGIT_LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g',
};

function foldUnicode(input: string): string {
  let s = input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[\u200b-\u200f\u2060\ufeff\u00ad]/g, '');
  s = Array.from(s.toLowerCase())
    .map((ch) => HOMOGLYPHS[ch] ?? ch)
    .join('');
  return s;
}

function spaced(input: string): string {
  return input.replace(/[^a-z0-9\u0400-\u04ff\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function collapseRepeats(input: string): string {
  return input.replace(/([a-z])\1+/g, '$1');
}

/**
 * Every normalised spelling of the input the filters test against:
 * plain, symbol-leet decoded, digit-leet decoded (1 -> i and 1 -> l),
 * each also with repeated letters collapsed.
 */
export function normalizedVariants(input: string): { spacedForms: string[]; flatForms: string[] } {
  const base = foldUnicode(input);
  const symbolDecoded = Array.from(base)
    .map((ch) => SYMBOL_LEET[ch] ?? ch)
    .join('');
  const digitI = Array.from(symbolDecoded)
    .map((ch) => DIGIT_LEET[ch] ?? ch)
    .join('');
  const digitL = digitI.replace(/i/g, (m, offset) => (symbolDecoded[offset] === '1' ? 'l' : m));
  const raw = [base, symbolDecoded, digitI, digitL];
  const spacedSet = new Set<string>();
  for (const r of raw) {
    const s = spaced(r);
    spacedSet.add(s);
    spacedSet.add(collapseRepeats(s));
  }
  const spacedForms = Array.from(spacedSet);
  const flatSet = new Set<string>();
  for (const s of spacedForms) {
    flatSet.add(s.replace(/ /g, ''));
  }
  // Letters spelled out one by one ("n u d e", "n.u.d.e") join up here.
  for (const s of spacedForms) {
    flatSet.add(s.replace(/\b([a-z]) (?=[a-z]\b)/g, '$1'));
  }
  return { spacedForms, flatForms: Array.from(flatSet) };
}

// ---------------------------------------------------------------------
// Image prompt terms (tested on whole words / phrases of the spaced form)
// ---------------------------------------------------------------------
const IMAGE_PHRASES: RegExp[] = [
  // nudity
  /\bnud(e|es|ity|ist|ists|ism|ie|ies|ey|y)\b/,
  /\bnaked\b/, /\bnakid\b/, /\bnekkid\b/, /\bnakd\b/, /\bnood(s|z)?\b/, /\bnudez\b/,
  /\btopless\b/, /\bbottomless\b/, /\bshirtless\b/, /\bpantsless\b/, /\bunclothed\b/,
  /\bundress(ed|ing)?\b/, /\bdisrob(e|ed|ing)\b/, /\bunclad\b/, /\bbare ?(skin|body|chest|breast|breasts|bottom|butt|naked)\b/,
  /\b(without|no|zero|minus|remove|removed|removing|take off|taking off|took off|strip off|out of)( (her|his|their|the|any|all|of))? (clothes|clothing|outfit|garments|shirt|top|bra|dress|pants|underwear)\b/,
  /\bclothes off\b/, /\bclothing optional\b/, /\bin the nude\b/, /\bbirthday suit\b/, /\bau naturel\b/,
  /\bnaturist(s)?\b/, /\bskinny ?dip(ping)?\b/, /\bstreak(ing|er)\b/, /\bflash(ing|er)\b/,
  /\b(implied|artistic|tasteful|classical|renaissance|figure|art) nud(e|ity)\b/, /\blife drawing model\b/,
  /\bx ?ray (vision|clothes|filter)\b/, /\bsee ?through\b/, /\bsheer (dress|top|shirt|fabric|clothes|clothing|lingerie|nightgown)\b/,
  /\btransparent (dress|top|shirt|clothes|clothing)\b/, /\bwet (t ?shirt|shirt|dress)\b/, /\bbody ?paint(ed|ing)?\b/,
  /\bcensor(ed|ship)? bars?\b/, /\buncensored\b/, /\bstrategically (placed|covered)\b/, /\bcovering (herself|himself|themselves)\b/,
  /\b(in|taking|takes|having) (a|the) (shower|bath)\b/, /\bshowering\b/, /\bbath ?tub\b/, /\bbubble bath\b/,
  /\bsauna\b/, /\bsunbath(e|ing)\b/, /\bnipples?\b/, /\bareola(e|s)?\b/,
  /\bwearing (nothing|only|just)\b/, /\bnothing on\b/, /\bwith nothing\b/, /\bfig lea(f|ves)\b/, /\blady godiva\b/,
  /\bvenus\b.*\b(birth|statue|sculpture|painting|goddess|botticelli|titian|milo|urbino|reclining)\b/,
  /\b(birth|statue|sculpture|painting|goddess|botticelli|titian|reclining) of venus\b/, /\breclining (venus|woman|nude|figure)\b/,
  /\badam and eve\b/, /\bstatue of david\b/, /\bmichelangelo'?s? david\b/, /\baphrodite\b/, /\bgarden of eden\b/,
  /\b(greek|roman|classical|ancient|marble|nude) (goddess|god) (statue|sculpture)\b/, /\b(hot tub|jacuzzi|towel|bathrobe)\b/,
  /\b(silk|satin) sheets\b/, /\bmassage\b/, /\btiny (outfit|clothes|dress|shorts|top)\b/, /\bbooty shorts\b/,
  // anatomy / sexual body terms
  /\bgenital(s|ia)?\b/, /\bpenis(es)?\b/, /\bvagina(s|l)?\b/, /\bvulva\b/, /\bdick(s)?\b/, /\bcock(s)?\b/, /\bpussy\b/,
  /\btits?\b/, /\btitties\b/, /\bboob(s|ies|y)?\b/, /\bbreast(s)?\b(?<!\b(chicken|turkey|duck) breasts?\b)/,
  /\bbutt(ocks|s)?\b/, /\bass(es)?\b/, /\barse\b/, /\bbooty\b/, /\bbum\b/, /\bcamel ?toe\b/, /\bcleavage\b/, /\bcrotch\b/, /\bgroin\b/,
  /\bbusty\b/, /\bthicc\b/, /\bvoluptuous\b/, /\bcurvaceous\b/, /\bwell endowed\b/, /\bhuge (chest|bust)\b/,
  // revealing clothing (zero tolerance: none of it)
  /\bbikini(s)?\b/, /\bswim ?(suit|suits|wear)\b/, /\bbathing suit\b/, /\bspeedo(s)?\b/, /\bmonokini\b/,
  /\blingerie\b/, /\bunderwear\b/, /\bunderpants\b/, /\bpant(y|ies)\b/, /\bknickers\b/, /\bbra(s)?\b/, /\bbralette\b/,
  /\bthong(s)?\b/, /\bg ?string\b/, /\bcorset\b/, /\bgarter(s)?\b/, /\bstockings\b/, /\bfishnet(s)?\b/, /\bnegligee\b/,
  /\bnightie\b/, /\bteddy lingerie\b/, /\bbriefs\b/, /\bboxers\b/, /\bjockstrap\b/, /\blatex (suit|outfit|catsuit)\b/,
  /\bmicro ?(skirt|bikini|dress)\b/, /\bskimpy\b/, /\brevealing\b/, /\bscantily\b/, /\bbarely (dressed|clothed|covered)\b/,
  /\bhalf ?(naked|dressed)\b/, /\bpartially (clothed|dressed|nude)\b/, /\bunder ?boob\b/, /\bside ?boob\b/, /\bpasties\b/,
  // sexual acts, content and industry
  /\bsex(y|ier|iest|ily|ual|ually|uality|ualized|ualised|ting)?\b/, /\bsexx+\b/, /\bseggs\b/, /\bsmut\b/,
  /\bporn(o|ographic|ography|star|hub)?\b/, /\bpr0n\b/, /\bprn\b/, /\bxxx\b/, /\bnsfw\b/, /\bnsf w\b/, /\badult (content|film|movie|video|star|model|site)\b/,
  /\berotic(a|ism)?\b/, /\bsensual(ly|ity)?\b/, /\bseduc(e|tive|tively|tress|ing)\b/, /\bprovocative(ly)?\b/, /\bsultry\b/, /\bsteamy\b/,
  /\blewd\b/, /\bexplicit\b/, /\bobscene\b/, /\bindecent\b/, /\braunchy\b/, /\bnaughty\b/, /\bkinky\b/, /\bkink\b/,
  /\bhorny\b/, /\baroused\b/, /\barousal\b/, /\borgasm(s|ic)?\b/, /\borgy\b/, /\bintercourse\b/, /\bcoitus\b/,
  /\bmasturbat\w*\b/, /\bfondl(e|ing)\b/, /\bgrop(e|ing)\b/, /\bfingering\b/, /\bblow ?job\b/, /\bhand ?job\b/, /\bcum\b/,
  /\bcumshot\b/, /\bejaculat\w*\b/, /\bcreampie\b/, /\bthreesome\b/, /\bfoursome\b/, /\bgangbang\b/, /\bmaking out\b/,
  /\bfrench kiss(ing)?\b/, /\bmake love\b/, /\blovemaking\b/, /\bfore ?play\b/, /\bhook ?up\b/, /\bone night stand\b/,
  /\bin bed (together|with)\b/, /\bunder the sheets\b/, /\bbedroom (eyes|scene|pose)\b/, /\bspread (legs|eagle)\b/, /\blegs (apart|spread)\b/,
  /\bon all fours\b/, /\bbent over\b/, /\bstraddl(e|ing)\b/, /\btwerk(ing)?\b/, /\blap ?danc(e|er|ing)\b/, /\bpole danc(e|er|ing)\b/,
  /\bstrip(per|pers|ping|tease| tease| club| show| down)\b/, /\bburlesque\b/, /\bpin ?up\b/, /\bboudoir\b/, /\bplayboy\b/,
  /\bplaymate\b/, /\bpenthouse (pet|magazine)\b/, /\bcentrefold\b/, /\bcenterfold\b/, /\bglamour (model|shoot|shot)\b/,
  /\bonly ?fans\b/, /\bfansly\b/, /\bcam ?girl\b/, /\bcam ?boy\b/, /\bescort(s)?\b/, /\bhooker(s)?\b/, /\bprostitut\w*\b/,
  /\bbrothel\b/, /\bred light district\b/, /\bwhore\b/, /\bslut(ty)?\b/, /\bmilf\b/, /\bdilf\b/, /\bgilf\b/,
  /\bfetish\w*\b/, /\bbdsm\b/, /\bbondage\b/, /\bdominatrix\b/, /\bsubmissive\b/, /\bshibari\b/, /\bspank(ing|ed)?\b/,
  /\bgag ball\b/, /\bball gag\b/, /\bcollar and leash\b/, /\bfoot fetish\b/, /\bfeet pics\b/, /\bahegao\b/,
  /\bhentai\b/, /\becchi\b/, /\boppai\b/, /\bfutanari\b/, /\byaoi\b/, /\byuri\b/, /\brule ?34\b/, /\br34\b/, /\blewds\b/,
  /\bcondom(s)?\b/, /\bdildo(s)?\b/, /\bvibrator(s)?\b/, /\bsex ?toy(s)?\b/, /\bbutt ?plug\b/,
  /\brap(e|ed|ing|ist)\b/, /\bincest\b/, /\bmolest\w*\b/, /\bbestiality\b/, /\bzoophil\w*\b/, /\bvoyeur\w*\b/, /\bupskirt\b/,
  /\bdownblouse\b/, /\bpeeping\b/, /\bhidden cam(era)?\b/, /\bdeep ?fake\b/, /\bundress (app|ai)\b/, /\bnudify\b/,
  // child sexual content (always blocked)
  /\bloli(con|ta)?\b/, /\bshota(con)?\b/, /\bjail ?bait\b/, /\bbarely legal\b/, /\bunderage\b/, /\bunder ?age\b/, /\bcsam\b/, /\bpedo\w*\b/, /\bpaedo\w*\b/,
  // other languages
  /\bdesnud(o|a|os|as)\b/, /\bdesnudez\b/, /\bencuerad(o|a)\b/, /\bsin ropa\b/, /\bnackt(e|en|er|heit)?\b/, /\bnue(s)?\b/, /\bnudit(e|a)\b/,
  /\bsans vetements\b/, /\bnud(o|a|i|e)\b/, /\bpelad(a|o) desnud\w*\b/, /\bpelad(a|inha)\b/, /\bsem roupa\b/, /\bgol(y|aya|ye)\b/,
  /\btelanjang\b/, /\bbugil\b/, /\bhubad\b/, /\bnaakt\b/, /\bnagi\b/, /\bnaga\b/, /\bnahy\b/, /\bnaken\b/, /\bmeztelen\b/,
  /\bciplak\b/, /\bseks\b/, /\bsexo\b/, /\bsesso\b/, /\bporno\b/, /\berotico\b/, /\berotisch\b/, /\bnangi\b/, /\bnanga\b/,
];

// Non-Latin scripts are tested on the original text (NFC, lowercased),
// before look-alike folding turns Cyrillic letters into Latin ones.
const NON_LATIN_PATTERNS: RegExp[] = [
  /голы[йея]|голая|обнаж|раздет|порн|секс|эрот|сиськ/,
  /裸|ヌード|エロ|色情|性爱|性愛|成人|黄色图片|下着|헨타이|누드|야한|섹스|알몸/,
  /عاري|عارية|إباحي|جنس/,
];

function nonLatinHit(input: string): boolean {
  const raw = input.normalize('NFC').toLowerCase().replace(/[\u200b-\u200f\u2060\ufeff\u00ad\s]/g, '');
  return NON_LATIN_PATTERNS.some((p) => p.test(raw));
}

// Substring checks on the flattened (space-free) forms, for words that
// are unlikely to appear inside innocent words. Catches "n-u-d-e",
// "n u d e", "nakedwoman" and similar.
const IMAGE_FLAT_WORDS: string[] = [
  'nude', 'nudes', 'naked', 'nudity', 'nudist', 'topless', 'porn', 'pr0n', 'erotic', 'nsfw',
  'hentai', 'onlyfans', 'lingerie', 'bikini', 'nipple', 'genital', 'penis', 'vagina', 'masturbat',
  'orgasm', 'intercourse', 'blowjob', 'handjob', 'striptease', 'stripper', 'boobs', 'titties', 'sexy',
  'sexual', 'xxx', 'rule34', 'loli', 'shota', 'jailbait', 'underage', 'bdsm', 'bondage', 'fetish',
  'nekkid', 'nakid', 'undress', 'unclothed', 'seductive', 'cleavage', 'thong', 'desnud', 'nackt', 'telanjang',
];

const MINOR_TERMS =
  /\b(child|children|kid|kids|minor|minors|teen|teens|teenage|teenager|teenagers|boy|boys|girl|girls|schoolgirl|schoolboy|toddler|baby|babies|infant|preteen|tween|little (girl|boy)|young (girl|boy)|daughter|son|student|students|school uniform|\d{1,2} ?(yo|y o|year old|years old|yr old))\b/;
const MINOR_RISK_TERMS =
  /\b(bath|bathing|shower|swim|swimming|pool|beach|bed|bedroom|pajamas|pyjamas|nightgown|kiss|kissing|cute pose|pose|posing|model|modeling|photoshoot|tight|short shorts|skirt|dress up|makeup|lipstick|adult|mature|romantic|romance|date|dating|boyfriend|girlfriend|wife|husband|love)\b/;

function firstHit(forms: string[], patterns: RegExp[]): boolean {
  for (const f of forms) {
    for (const p of patterns) {
      if (p.test(f)) return true;
    }
  }
  return false;
}

export function checkImagePrompt(prompt: string): ImagePromptCheck {
  const trimmed = (prompt ?? '').trim();
  if (!trimmed) {
    return { allowed: false, reason: 'Enter a prompt first.' };
  }
  if (trimmed.length > 600) {
    return { allowed: false, reason: 'That prompt is too long. Keep it under 600 characters.' };
  }
  const { spacedForms, flatForms } = normalizedVariants(trimmed);

  if (nonLatinHit(trimmed) || firstHit(spacedForms, IMAGE_PHRASES)) {
    return { allowed: false, reason: BLOCKED_IMAGE_MESSAGE };
  }
  for (const flat of flatForms) {
    for (const w of IMAGE_FLAT_WORDS) {
      if (flat.includes(w)) return { allowed: false, reason: BLOCKED_IMAGE_MESSAGE };
    }
  }
  // Any prompt about a minor combined with a setting or framing that
  // could be sexualised is refused outright. Ordinary prompts about
  // children ("a child playing soccer") still work.
  for (const s of spacedForms) {
    if (MINOR_TERMS.test(s) && MINOR_RISK_TERMS.test(s)) {
      return { allowed: false, reason: BLOCKED_IMAGE_MESSAGE };
    }
  }
  return { allowed: true };
}

/**
 * Returns the prompt that may actually be sent to the provider:
 * the user's prompt plus a safe framing suffix. Throws with a
 * user-facing message when the prompt is blocked.
 */
export function buildSafeImagePrompt(prompt: string): string {
  const check = checkImagePrompt(prompt);
  if (!check.allowed) {
    throw new Error(check.reason ?? BLOCKED_IMAGE_MESSAGE);
  }
  return (
    `${prompt.trim()}, fully clothed in modest everyday clothing suitable ` +
    `for a public setting, family friendly, no nudity, no sexual content`
  );
}

// ---------------------------------------------------------------------
// AI text (posts, comments, drafts) and text the user sends to the AI.
// Narrower than the image list so ordinary posts ("chicken breast",
// "beach day", "bikini season sale") are not thrown away; anything
// sexually explicit or sexualising minors is.
// ---------------------------------------------------------------------
const TEXT_PATTERNS: RegExp[] = [
  /\bnud(e|es|ity|ist|ism|ie|ies)\b/, /\bnaked\b(?! eye)/, /\bnekkid\b/, /\btopless\b/, /\bundress(ed|ing)?\b/,
  /\bsex(ual|ually|y|ting)?\b/, /\bseggs\b/, /\bporn(o|ographic|ography|star|hub)?\b/, /\bxxx\b/, /\bnsfw\b/,
  /\berotic(a)?\b/, /\bsmut\b/, /\blewd\b/, /\bexplicit (sex|scene|content|photo|pic|image)s?\b/, /\bhorny\b/, /\baroused\b/,
  /\borgasm\w*\b/, /\borgy\b/, /\bintercourse\b/, /\bmasturbat\w*\b/, /\bblow ?job\b/, /\bhand ?job\b/, /\bcum(shot)?\b/,
  /\bejaculat\w*\b/, /\bgenital\w*\b/, /\bpenis\b/, /\bvagina\b/, /\bvulva\b/, /\bdick pic(s)?\b/, /\bcock\b/, /\bpussy\b/,
  /\btits\b/, /\btitties\b/, /\bboobs\b/, /\bnipple(s)?\b/, /\bonly ?fans\b/, /\bhentai\b/, /\brule ?34\b/, /\bfetish\w*\b/,
  /\bbdsm\b/, /\bbondage\b/, /\bstripper(s)?\b/, /\bstrip ?club\b/, /\bstriptease\b/, /\blap ?dance\b/, /\bescort service\b/,
  /\bhooker(s)?\b/, /\bprostitut\w*\b/, /\bwhore\b/, /\bslut\w*\b/, /\bmilf\b/, /\bthreesome\b/, /\bgangbang\b/,
  /\bdildo(s)?\b/, /\bvibrator(s)?\b/, /\bsex ?toy(s)?\b/, /\brap(e|ed|ing|ist)\b/, /\bincest\b/, /\bmolest\w*\b/,
  /\bbestiality\b/, /\bloli(con)?\b/, /\bshota(con)?\b/, /\bjail ?bait\b/, /\bpedo\w*\b/, /\bcsam\b/, /\bnudes\b/, /\bsend nudes\b/,
  /\bmake love\b/, /\blovemaking\b/, /\bone night stand\b/, /\bhook ?up\b/,
];

const TEXT_FLAT_WORDS: string[] = ['porn', 'nsfw', 'hentai', 'onlyfans', 'masturbat', 'blowjob', 'handjob', 'rule34', 'jailbait'];

export function checkTextSafety(text: string): ImagePromptCheck {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return { allowed: true };
  const { spacedForms, flatForms } = normalizedVariants(trimmed);
  if (nonLatinHit(trimmed) || firstHit(spacedForms, TEXT_PATTERNS)) {
    return { allowed: false, reason: BLOCKED_TEXT_MESSAGE };
  }
  for (const flat of flatForms) {
    for (const w of TEXT_FLAT_WORDS) {
      if (flat.includes(w)) return { allowed: false, reason: BLOCKED_TEXT_MESSAGE };
    }
  }
  for (const s of spacedForms) {
    if (MINOR_TERMS.test(s) && /\b(sexy|sexual|naked|nude|lingerie|seductive|hot body|aroused)\b/.test(s)) {
      return { allowed: false, reason: BLOCKED_TEXT_MESSAGE };
    }
  }
  return { allowed: true };
}

/** True when a piece of AI-generated text may be shown in the app. */
export function isTextSafe(text: string): boolean {
  return checkTextSafety(text).allowed;
}
