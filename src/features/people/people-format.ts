/** "7", "1,280". */
export function formatCount(count: number): string {
  return count.toLocaleString('en-US');
}

/** The search asks the server only from this many characters (see useUserSearch). */
export const MIN_SEARCH_LENGTH = 2;

export type SearchView =
  | { kind: 'hint' }
  | { kind: 'loading' }
  | { kind: 'results' }
  | { kind: 'none'; query: string }
  | { kind: 'error'; offline: boolean };

/**
 * What the people search shows for what's typed and where the request is.
 * Old results stay up while new ones load (keepPreviousData), so "loading"
 * only shows before the first results.
 */
export function searchView({
  text,
  isPending,
  isError,
  count,
  online,
}: {
  text: string;
  isPending: boolean;
  isError: boolean;
  /** Results on hand, possibly from the previous search. */
  count: number;
  online: boolean;
}): SearchView {
  const query = text.trim();
  if (query.length < MIN_SEARCH_LENGTH) return { kind: 'hint' };
  if (count > 0) return { kind: 'results' };
  // Offline, the request waits for signal instead of failing: say so rather than spin.
  if (!online) return { kind: 'error', offline: true };
  if (isError) return { kind: 'error', offline: false };
  if (isPending) return { kind: 'loading' };
  return { kind: 'none', query };
}
