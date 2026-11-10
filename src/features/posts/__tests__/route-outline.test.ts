import { routeOutline } from '../route-outline';

const at = (lat: number, lng: number) => ({ recordedAt: 0, lat, lng, altitudeM: null });

describe('routeOutline', () => {
  it('draws nothing without points', () => {
    expect(routeOutline([], 76, 8)).toBeNull();
  });

  it('puts a single spot in the middle', () => {
    expect(routeOutline([at(16.5, 120.9)], 76, 8)).toEqual({
      d: 'M38 38',
      start: { x: 38, y: 38 },
      end: { x: 38, y: 38 },
    });
  });

  it('keeps north up and fits the longer side inside the padding', () => {
    // Due north: a vertical line from the bottom edge to the top edge.
    const outline = routeOutline([at(0, 0), at(0.01, 0)], 76, 8)!;
    expect(outline.start).toEqual({ x: 38, y: 68 });
    expect(outline.end).toEqual({ x: 38, y: 8 });
    expect(outline.d).toBe('M38 68 L38 8');
  });

  it("doesn't stretch east-west far from the equator", () => {
    // At 60°N a degree of longitude is half as long as a degree of latitude.
    const outline = routeOutline([at(60, 0), at(60, 0.02), at(60.01, 0.02)], 100, 0)!;
    // As wide as it is tall: 0.02° × cos 60° = 0.01°.
    expect(outline.start.x).toBeCloseTo(0, 0);
    expect(outline.end).toEqual({ x: 100, y: 0 });
  });

  it('skips points on long routes but keeps the end', () => {
    const path = Array.from({ length: 1001 }, (_, i) => at(i * 0.0001, 0));
    const outline = routeOutline(path, 76, 8)!;
    const drawn = outline.d.split(' L').length;
    expect(drawn).toBeLessThanOrEqual(201); // at most ~200, plus the last point
    expect(drawn).toBeGreaterThan(100);
    expect(outline.end).toEqual({ x: 38, y: 8 });
  });
});
