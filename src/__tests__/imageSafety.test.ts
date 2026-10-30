import { buildSafeImagePrompt, checkImagePrompt } from '../services/imageSafety';

describe('checkImagePrompt', () => {
  test('blocks the class of prompt behind the 2026-10-28 Play suspension', () => {
    expect(checkImagePrompt('nude woman on a beach').allowed).toBe(false);
    expect(checkImagePrompt('a naked person').allowed).toBe(false);
    expect(checkImagePrompt('topless woman').allowed).toBe(false);
  });

  test('blocks sexualised prompts even when phrased indirectly', () => {
    expect(checkImagePrompt('sexy lingerie model').allowed).toBe(false);
    expect(checkImagePrompt('a seductive pose').allowed).toBe(false);
    expect(checkImagePrompt('sexually suggestive photo').allowed).toBe(false);
  });

  test('blocks punctuation and leet obfuscation', () => {
    expect(checkImagePrompt('n.u.d.e woman').allowed).toBe(false);
    expect(checkImagePrompt('nud3 woman on a beach').allowed).toBe(false);
    expect(checkImagePrompt('NUDE WOMAN').allowed).toBe(false);
  });

  test('blocks sexualised depictions of minors', () => {
    expect(checkImagePrompt('a girl in a bikini').allowed).toBe(false);
    expect(checkImagePrompt('a teen in underwear').allowed).toBe(false);
  });

  test('allows ordinary, non-sexual prompts', () => {
    expect(checkImagePrompt('a woman in a coat on a beach').allowed).toBe(true);
    expect(checkImagePrompt('a cat on a beach at sunset').allowed).toBe(true);
    expect(checkImagePrompt('a child playing soccer').allowed).toBe(true);
    expect(checkImagePrompt('a beach sunset').allowed).toBe(true);
  });

  test('rejects an empty prompt', () => {
    expect(checkImagePrompt('   ').allowed).toBe(false);
  });
});

describe('buildSafeImagePrompt', () => {
  test('throws for a blocked prompt instead of returning it', () => {
    expect(() => buildSafeImagePrompt('nude woman on a beach')).toThrow(/not allowed/i);
  });

  test('adds safe framing to an allowed prompt', () => {
    const safe = buildSafeImagePrompt('a cat on a beach');
    expect(safe).toContain('a cat on a beach');
    expect(safe).toMatch(/fully clothed/i);
    expect(safe).toMatch(/no nudity/i);
  });
});
