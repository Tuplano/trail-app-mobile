import { INITIAL_SYNC_SNAPSHOT, type SyncSnapshot } from '@/sync/sync-status-store';

import { describeSyncStatus } from '../sync-status';

const snap = (patch: Partial<SyncSnapshot>): SyncSnapshot => ({
  ...INITIAL_SYNC_SNAPSHOT,
  online: true,
  ...patch,
});

describe('describeSyncStatus', () => {
  it('says all is uploaded when nothing waits or failed', () => {
    expect(describeSyncStatus(snap({}))).toEqual({
      tone: 'done',
      title: 'All hikes uploaded',
      detail: null,
      busy: false,
      canRetry: false,
    });
  });

  it('shows the upload in progress', () => {
    expect(describeSyncStatus(snap({ waiting: 2, syncing: true }))).toMatchObject({
      tone: 'waiting',
      title: '2 hikes waiting to upload',
      detail: 'Uploading…',
      busy: true,
      canRetry: false,
    });
  });

  it('explains that waiting hikes need internet', () => {
    expect(describeSyncStatus(snap({ waiting: 1, online: false }))).toMatchObject({
      title: '1 hike waiting to upload',
      detail: "No internet. They'll upload when you're back online.",
      canRetry: false,
    });
  });

  it('offers Retry when the last try failed', () => {
    expect(describeSyncStatus(snap({ waiting: 1, backingOff: 1 }))).toMatchObject({
      tone: 'problem',
      busy: false,
      canRetry: true,
    });
  });

  it("doesn't show a spinner for a sync run that only finds hikes still backing off", () => {
    // Every app foreground starts a run; it mustn't flash "Uploading…".
    expect(describeSyncStatus(snap({ waiting: 1, backingOff: 1, syncing: true }))).toMatchObject({
      busy: false,
      canRetry: true,
    });
  });

  it('puts hikes the server rejected first, with Retry, and mentions the rest', () => {
    expect(describeSyncStatus(snap({ failed: 1, waiting: 2 }))).toEqual({
      tone: 'problem',
      title: "1 hike couldn't upload",
      detail: "The server didn't accept it. It's still saved on this phone. 2 more waiting to upload.",
      busy: false,
      canRetry: true,
    });
  });

  it('hides Retry while offline: it could not do anything', () => {
    expect(describeSyncStatus(snap({ failed: 2, online: false })).canRetry).toBe(false);
  });

  it('assumes Retry may work before the network was first checked', () => {
    expect(describeSyncStatus(snap({ failed: 1, online: null })).canRetry).toBe(true);
  });
});
