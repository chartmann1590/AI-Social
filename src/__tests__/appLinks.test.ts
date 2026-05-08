import { APP_LINKS } from '../appLinks';

describe('APP_LINKS', () => {
  test('points to the AI-Social GitHub repository', () => {
    expect(APP_LINKS.github).toBe('https://github.com/chartmann1590/AI-Social');
  });

  test('points to the GitHub Pages marketing site', () => {
    expect(APP_LINKS.website).toBe('https://chartmann1590.github.io/AI-Social/');
  });

  test('points to the correct Buy Me a Coffee profile', () => {
    // Locked in to prevent regression to old chartmann1590 BMC handle.
    expect(APP_LINKS.buyMeACoffee).toBe('https://buymeacoffee.com/charleshartmann');
  });

  test('all links use https', () => {
    for (const url of Object.values(APP_LINKS)) {
      expect(url).toMatch(/^https:\/\//);
    }
  });
});
