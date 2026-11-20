import { api } from '@/api/client';
import { toApiError } from '@/api/errors';
import { listUnownedHikes, setHikeOwner } from '@/db/hikes';
import type { Db } from '@/db/types';

/** What the server said when asked about one hike. */
export type HikeLookup =
  | { status: 'found'; ownerId: string }
  | { status: 'notFound' } // 404: not this account's hike (or deleted)
  | { status: 'error' }; // anything else: ask again next time

/**
 * Whether a hike saved before owners were recorded belongs to `userId`.
 * 'yes' and 'no' are final; 'unknown' means ask again on a later run.
 */
export function ownerVerdict(lookup: HikeLookup, userId: string): 'yes' | 'no' | 'unknown' {
  if (lookup.status === 'found') return lookup.ownerId === userId ? 'yes' : 'no';
  if (lookup.status === 'notFound') return 'no';
  return 'unknown';
}

/**
 * Gives the hikes saved before the app recorded owners (#13.1) to the
 * signed-in account, when they are its own.
 *
 * Only uploaded hikes can be checked: the server answers GET /hikes/{id}
 * only for its owner. Hikes that never reached the server can't be checked,
 * so they keep no owner: no account sees or uploads them. That's safer than
 * guessing, which could upload one person's hike to another person's account.
 *
 * Hikes that turn out to be another account's keep no owner here, so that
 * account claims them when it signs in. Returns how many were claimed.
 * Throws on a network failure; the next sync run carries on.
 */
export async function claimHikes(db: Db, userId: string): Promise<number> {
  const mine: string[] = [];
  for (const { id, uploaded } of await listUnownedHikes(db)) {
    if (!uploaded) continue;
    const { data, error, response } = await api.GET('/api/v1/hikes/{id}', {
      params: { path: { id } },
    });
    let lookup: HikeLookup;
    if (data) lookup = { status: 'found', ownerId: data.userId };
    else if (response.status === 404 || response.status === 403) lookup = { status: 'notFound' };
    else throw toApiError(error, response);
    if (ownerVerdict(lookup, userId) === 'yes') mine.push(id);
  }
  await setHikeOwner(db, mine, userId);
  return mine.length;
}
