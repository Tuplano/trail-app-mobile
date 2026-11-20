import type { RecorderStatus } from '@/tracking/recorder-store';

/**
 * Why Sign out isn't possible right now, or null when it is. A hike in
 * progress belongs to the signed-in account and GPS keeps saving to it, so
 * signing out mid-hike would leave it to whoever signs in next.
 */
export function signOutBlocker(recorder: RecorderStatus): string | null {
  if (recorder === 'recording' || recorder === 'paused') {
    return 'You have a hike in progress. Finish or discard it on Record first.';
  }
  return null;
}
