import { getRandomBytes } from 'expo-crypto';

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/**
 * A UUIDv7: 48 bits of millisecond time, then random bits (RFC 9562).
 *
 * The phone makes ids for hikes, posts, and photos itself, so they exist
 * before the server sees them and an upload can be retried safely. Because
 * the time comes first, ids sort in creation order, which keeps the database
 * index tidy.
 */
export function uuidv7(now: number = Date.now(), random: Uint8Array = getRandomBytes(10)): string {
  const bytes = new Uint8Array(16);

  // Bytes 0–5: the timestamp, big-endian. Division instead of bit shifts,
  // because JavaScript bit operators only work on 32 bits.
  let time = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = time % 256;
    time = Math.floor(time / 256);
  }

  // Bytes 6–15: random, then overwrite the version and variant bits.
  bytes.set(random.subarray(0, 10), 6);
  bytes[6] = 0x70 | (bytes[6] & 0x0f); // version 7
  bytes[8] = 0x80 | (bytes[8] & 0x3f); // variant 10xx

  const hex = Array.from(bytes, (b) => HEX[b]).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
