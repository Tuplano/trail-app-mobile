import type { LngLat } from '@maplibre/maplibre-react-native';

import { FOLLOW_ZOOM } from '@/config/map';

import { cameraMove } from '../follow-camera';

const HERE: LngLat = [121.03, 14.6128];

describe('cameraMove', () => {
  it('stays put while the position is unknown, even on Recenter', () => {
    expect(cameraMove({ here: null, following: true, placed: false })).toEqual({ type: 'none' });
    expect(cameraMove({ here: null, following: false, placed: true, recenter: true })).toEqual({
      type: 'none',
    });
  });

  it('jumps in to the following zoom the first time the position is known', () => {
    expect(cameraMove({ here: HERE, following: true, placed: false })).toEqual({
      type: 'jump',
      center: HERE,
      zoom: FOLLOW_ZOOM,
    });
  });

  it('glides along after that, keeping the zoom the hiker chose', () => {
    expect(cameraMove({ here: HERE, following: true, placed: true })).toEqual({
      type: 'ease',
      center: HERE,
    });
  });

  it("doesn't move once the hiker dragged the map away", () => {
    expect(cameraMove({ here: HERE, following: false, placed: true })).toEqual({ type: 'none' });
    expect(cameraMove({ here: HERE, following: false, placed: false })).toEqual({ type: 'none' });
  });

  it('Recenter flies back to the hiker and brings the zoom back', () => {
    expect(cameraMove({ here: HERE, following: false, placed: true, recenter: true })).toEqual({
      type: 'fly',
      center: HERE,
      zoom: FOLLOW_ZOOM,
    });
  });
});
