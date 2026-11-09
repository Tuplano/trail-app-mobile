import type { SyncSnapshot } from '@/sync/sync-status-store';

/** What the sync status card shows. */
export type SyncStatusView = {
  /** done: nothing left to upload. waiting: will upload by itself. problem: needs the hiker. */
  tone: 'done' | 'waiting' | 'problem';
  title: string;
  detail: string | null;
  /** Show a spinner: an upload is happening right now. */
  busy: boolean;
  /** Show the Retry button. */
  canRetry: boolean;
};

const hikes = (n: number) => (n === 1 ? '1 hike' : `${n} hikes`);

/**
 * Turns the upload counts into what the hiker sees. Kept free of React so the
 * wording for every case can be unit-tested.
 *
 * The title stays "N hikes waiting to upload" while they wait, and only the
 * line under it changes (offline, uploading, retrying), so the card doesn't
 * jump around each time a sync starts and stops.
 */
export function describeSyncStatus(s: SyncSnapshot): SyncStatusView {
  // Retry can't do anything offline: the hikes go up once the internet is back.
  const canRetry = s.online !== false;

  if (s.failed > 0) {
    const one = s.failed === 1;
    const others = s.waiting > 0 ? ` ${s.waiting} more waiting to upload.` : '';
    return {
      tone: 'problem',
      title: `${hikes(s.failed)} couldn't upload`,
      detail: `The server didn't accept ${one ? 'it' : 'them'}. ${one ? "It's" : "They're"} still saved on this phone.${others}`,
      busy: false,
      canRetry,
    };
  }

  if (s.waiting === 0) {
    return { tone: 'done', title: 'All hikes uploaded', detail: null, busy: false, canRetry: false };
  }

  const title = `${hikes(s.waiting)} waiting to upload`;
  if (s.online === false) {
    return {
      tone: 'waiting',
      title,
      detail: "No internet. They'll upload when you're back online.",
      busy: false,
      canRetry: false,
    };
  }
  // Some are due now (not all are waiting out a backoff): this run uploads them.
  if (s.syncing && s.waiting > s.backingOff) {
    return { tone: 'waiting', title, detail: 'Uploading…', busy: true, canRetry: false };
  }
  if (s.backingOff > 0) {
    return {
      tone: 'problem',
      title,
      detail: "The last try didn't work. Trail will try again by itself.",
      busy: false,
      canRetry,
    };
  }
  return { tone: 'waiting', title, detail: 'Uploading soon.', busy: false, canRetry: false };
}
