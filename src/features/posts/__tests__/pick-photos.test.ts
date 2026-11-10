import { checkPickedPhoto, describeSkipped } from '../pick-photos';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({}));

describe('checkPickedPhoto', () => {
  it('takes JPEG, PNG and WebP photos', () => {
    expect(
      checkPickedPhoto({ uri: 'file:///a.jpg', mimeType: 'image/jpeg', fileSize: 900 }),
    ).toEqual({
      ok: true,
      photo: { uri: 'file:///a.jpg', contentType: 'image/jpeg', sizeBytes: 900 },
    });
    expect(checkPickedPhoto({ uri: 'file:///b', mimeType: 'image/png' })).toMatchObject({
      ok: true,
    });
    expect(checkPickedPhoto({ uri: 'file:///c', mimeType: 'image/webp' })).toMatchObject({
      ok: true,
    });
  });

  it('works out the type from the extension when the picker leaves it out', () => {
    expect(checkPickedPhoto({ uri: 'file:///cache/IMG_1.JPEG', fileSize: 10 })).toMatchObject({
      ok: true,
      photo: { contentType: 'image/jpeg' },
    });
  });

  it('refuses types the API rejects', () => {
    expect(checkPickedPhoto({ uri: 'file:///a.heic', mimeType: 'image/heic' })).toEqual({
      ok: false,
      reason: 'type',
    });
    expect(checkPickedPhoto({ uri: 'file:///a.gif' })).toEqual({ ok: false, reason: 'type' });
  });

  it('refuses photos over 10 MB', () => {
    const tenMb = 10 * 1024 * 1024;
    expect(checkPickedPhoto({ uri: 'file:///a.jpg', fileSize: tenMb })).toMatchObject({ ok: true });
    expect(checkPickedPhoto({ uri: 'file:///a.jpg', fileSize: tenMb + 1 })).toEqual({
      ok: false,
      reason: 'size',
    });
  });
});

describe('describeSkipped', () => {
  it('says nothing when every photo was added', () => {
    expect(describeSkipped({ type: 0, size: 0 })).toBeNull();
  });

  it('says why photos were left out', () => {
    expect(describeSkipped({ type: 0, size: 1 })).toBe('That photo is over 10 MB.');
    expect(describeSkipped({ type: 0, size: 2 })).toBe('Those photos are over 10 MB.');
    expect(describeSkipped({ type: 1, size: 0 })).toBe(
      'Only JPEG, PNG and WebP photos can be added.',
    );
    expect(describeSkipped({ type: 1, size: 1 })).toBe("Some photos couldn't be added.");
  });
});
