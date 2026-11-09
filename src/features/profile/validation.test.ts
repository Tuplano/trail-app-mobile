import { initials, profileChanges, validateProfile } from './validation';

const saved = { username: 'maya', displayName: 'Maya Okafor' };

describe('validateProfile', () => {
  it('accepts the saved values', () => {
    expect(validateProfile(saved)).toEqual({});
  });

  it('applies the API username and name rules', () => {
    expect(validateProfile({ username: 'ma', displayName: '  ' })).toEqual({
      username: 'Use 3 to 30 characters.',
      displayName: 'Enter your name.',
    });
    expect(validateProfile({ username: 'maya.o', displayName: 'x'.repeat(51) })).toEqual({
      username: 'Use only letters, numbers, and underscores.',
      displayName: 'Use 50 characters or fewer.',
    });
  });
});

describe('profileChanges', () => {
  it('is empty when nothing changed, ignoring surrounding spaces', () => {
    expect(profileChanges({ username: ' maya ', displayName: 'Maya Okafor ' }, saved)).toEqual({});
  });

  it('sends only the changed fields, trimmed', () => {
    expect(profileChanges({ username: ' maya_o ', displayName: 'Maya Okafor' }, saved)).toEqual({
      username: 'maya_o',
    });
    expect(profileChanges({ username: 'maya', displayName: ' Maya O. ' }, saved)).toEqual({
      displayName: 'Maya O.',
    });
  });

  it('treats a change of case as a change', () => {
    expect(profileChanges({ ...saved, username: 'Maya' }, saved)).toEqual({ username: 'Maya' });
  });
});

describe('initials', () => {
  it('takes the first letter of up to two words', () => {
    expect(initials('Maya Okafor')).toBe('MO');
    expect(initials('  maya  ')).toBe('M');
    expect(initials('Ana María de la Cruz')).toBe('AM');
  });
});
