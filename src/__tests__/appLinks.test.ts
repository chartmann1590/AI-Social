import { APP_LINKS } from '../appLinks';

describe('APP_LINKS', () => {
  test('points to the Driftfeed website', () => {
    expect(APP_LINKS.website).toBe('https://chartmann1590.github.io/driftfeed-site/');
  });

  test('points to the Driftfeed privacy policy', () => {
    expect(APP_LINKS.privacy).toBe('https://chartmann1590.github.io/driftfeed-site/privacy/');
  });

  test('has no external payment or donation links', () => {
    expect(Object.keys(APP_LINKS).sort()).toEqual(['privacy', 'website']);
  });

  test('all links use https', () => {
    for (const url of Object.values(APP_LINKS)) {
      expect(url).toMatch(/^https:\/\//);
    }
  });
});
