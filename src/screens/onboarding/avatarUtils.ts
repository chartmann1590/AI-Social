/** DiceBear avatar URL helpers — lightweight identicon-style PNGs from the public API. */

const DICEBEAR_BASE = 'https://api.dicebear.com/7.x/adventurer/png';

export function avatarUrl(seed: string, size: number = 128): string {
  const safe = encodeURIComponent(seed || 'aisocial');
  return `${DICEBEAR_BASE}?seed=${safe}&size=${size}&radius=50&backgroundType=gradientLinear`;
}

const SEED_WORDS = [
  'nebula',
  'meadow',
  'ember',
  'pixel',
  'orbit',
  'fern',
  'glacier',
  'velvet',
  'mango',
  'comet',
  'koi',
  'lantern',
  'mosaic',
  'quill',
  'cobalt',
  'sienna',
  'aurora',
  'dune',
];

export function randomSeed(): string {
  const a = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)];
  const b = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)];
  const n = Math.floor(Math.random() * 900 + 100);
  return `${a}-${b}-${n}`;
}

export function makeSeedBatch(count: number = 6): string[] {
  const out = new Set<string>();
  while (out.size < count) {
    out.add(randomSeed());
  }
  return Array.from(out);
}
