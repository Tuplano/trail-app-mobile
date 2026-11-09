import { uuidv7 } from '../ids';

const zeros = new Uint8Array(10);
const ones = new Uint8Array(10).fill(0xff);

describe('uuidv7', () => {
  it('is a valid version 7 UUID', () => {
    const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(uuidv7(Date.now(), zeros)).toMatch(UUID_V7);
    expect(uuidv7(Date.now(), ones)).toMatch(UUID_V7);
  });

  it('starts with the time in milliseconds', () => {
    const now = Date.UTC(2026, 10, 9, 8, 30);
    const hex = uuidv7(now, zeros).replace(/-/g, '');
    expect(parseInt(hex.slice(0, 12), 16)).toBe(now);
  });

  it('sorts by creation time', () => {
    const earlier = uuidv7(1_700_000_000_000, ones);
    const later = uuidv7(1_700_000_000_001, zeros);
    expect(earlier < later).toBe(true);
  });

  it('uses the random bytes for the rest', () => {
    expect(uuidv7(0, zeros)).toBe('00000000-0000-7000-8000-000000000000');
    expect(uuidv7(0, ones)).toBe('00000000-0000-7fff-bfff-ffffffffffff');
  });
});
