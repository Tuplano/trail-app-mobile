import { BACKGROUND_LOCATION_DISCLOSURE, locationAccessCopy } from '../location-access-card';

// Google Play rejects apps whose in-app message before "Allow all the time"
// lacks its required words (Notion task 51). These keep them in place.
describe('background location disclosure', () => {
  it("uses Google's required words", () => {
    expect(BACKGROUND_LOCATION_DISCLOSURE).toContain('location');
    expect(BACKGROUND_LOCATION_DISCLOSURE).toContain('even when the app is closed or not in use');
    expect(BACKGROUND_LOCATION_DISCLOSURE).toMatch(/record your hike/);
  });

  it.each(['android', 'ios'] as const)(
    'comes first, before each location request (%s)',
    (os) => {
      for (const access of ['ask-foreground', 'ask-background', 'background-blocked'] as const) {
        expect(locationAccessCopy(access, os).body.startsWith(BACKGROUND_LOCATION_DISCLOSURE)).toBe(
          true,
        );
      }
    },
  );

  it('names the app as the phone does: Trailing', () => {
    for (const os of ['android', 'ios'] as const) {
      for (const access of [
        'services-off',
        'ask-foreground',
        'foreground-blocked',
        'approximate',
        'ask-background',
        'background-blocked',
      ] as const) {
        const { title, body } = locationAccessCopy(access, os);
        expect(`${title} ${body}`).not.toMatch(/\bTrail\b/);
      }
    }
  });
});
