import { roundedHexagonLength, roundedHexagonPath } from '../emblem-shape';

describe('roundedHexagonPath', () => {
  it('is a closed path with six straight sides and six rounded corners', () => {
    const d = roundedHexagonPath(45);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/ L /g)).toHaveLength(6);
    expect(d.match(/ Q /g)).toHaveLength(6);
  });

  it('starts just right of the top point, so a dash fills from the top', () => {
    const [x, y] = roundedHexagonPath(45).slice(2).split(' ').map(Number);
    expect(x).toBeGreaterThan(50);
    expect(y).toBeLessThan(15);
  });
});

describe('roundedHexagonLength', () => {
  it('is a little shorter than the sharp hexagon, longer than the circle inside it', () => {
    const r = 48;
    const length = roundedHexagonLength(r);
    expect(length).toBeLessThan(6 * r);
    // The circle that touches the middle of each side.
    expect(length).toBeGreaterThan(2 * Math.PI * r * (Math.sqrt(3) / 2));
  });
});
