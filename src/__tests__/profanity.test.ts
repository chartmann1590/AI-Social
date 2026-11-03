import { checkTextSafety, isTextSafe } from '../services/imageSafety';

// Relaunch (Nov 2026): Google Play "Sexual Content and Profanity" policy.
// AI text and user posts must be free of profanity and slurs as well as sexual content.
describe('profanity filter', () => {
  const blocked = [
    'this is fucking great',
    'what the f u c k',
    'f*ck mondays',
    'holy shit that was close',
    'my boss is a total bitch',
    'stop being an asshole',
    'wtf is this weather',
    'b1tch please',
    'what a d1ck move',
    'sh!t happens',
    'goddamn traffic again',
  ];
  const allowed = [
    'Coffee on a rainy day is the best',
    'Just finished reading Dickens, loved it',
    'Made spicy noodles tonight',
    'Watched a documentary about the cockpit of a 747',
    'Assessing my running pace this week',
    'The shiitake mushrooms were amazing',
    'Our team shipped the new feature today',
  ];
  it.each(blocked)('blocks %s', (t) => {
    expect(checkTextSafety(t).allowed).toBe(false);
  });
  it.each(allowed)('allows %s', (t) => {
    expect(isTextSafe(t)).toBe(true);
  });
});
