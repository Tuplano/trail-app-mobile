import { signOutBlocker } from '../sign-out-rules';

describe('signOutBlocker', () => {
  it('blocks signing out during a hike, recording or paused', () => {
    expect(signOutBlocker('recording')).toMatch(/Finish or discard it on Record first/);
    expect(signOutBlocker('paused')).toMatch(/Finish or discard it on Record first/);
  });

  it('allows it otherwise', () => {
    expect(signOutBlocker('idle')).toBeNull();
    expect(signOutBlocker('finished')).toBeNull();
  });
});
