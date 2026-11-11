import { formatCount, searchView } from '../people-format';

const base = { text: 'maya', isPending: false, isError: false, count: 0, online: true };

describe('searchView', () => {
  it('asks for more letters below 2, spaces not counted', () => {
    expect(searchView({ ...base, text: 'm' })).toEqual({ kind: 'hint' });
    expect(searchView({ ...base, text: ' m ' })).toEqual({ kind: 'hint' });
  });

  it('spins before the first results arrive', () => {
    expect(searchView({ ...base, isPending: true })).toEqual({ kind: 'loading' });
  });

  it('keeps showing results while the next search loads, even offline', () => {
    expect(searchView({ ...base, isPending: true, count: 3 })).toEqual({ kind: 'results' });
    expect(searchView({ ...base, count: 3, online: false })).toEqual({ kind: 'results' });
  });

  it('says no one matched, with the trimmed words', () => {
    expect(searchView({ ...base, text: ' zed ' })).toEqual({ kind: 'none', query: 'zed' });
  });

  it('says offline instead of spinning while the request waits for signal', () => {
    expect(searchView({ ...base, isPending: true, online: false })).toEqual({
      kind: 'error',
      offline: true,
    });
  });

  it('reports a failed search when online', () => {
    expect(searchView({ ...base, isError: true })).toEqual({ kind: 'error', offline: false });
  });
});

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(7)).toBe('7');
    expect(formatCount(1280)).toBe('1,280');
  });
});
