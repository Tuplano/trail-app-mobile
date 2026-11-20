import type { LngLat } from '@maplibre/maplibre-react-native';

import { FOLLOW_ZOOM } from '@/config/map';

/** What the Record map's camera should do next. */
export type CameraMove =
  | { type: 'none' }
  /** Straight there, no animation: the first time the map learns where the hiker is. */
  | { type: 'jump'; center: LngLat; zoom: number }
  /** A short glide that keeps the hiker's zoom: following them as they walk. */
  | { type: 'ease'; center: LngLat }
  /** Back to the hiker at the following zoom: the Recenter button. */
  | { type: 'fly'; center: LngLat; zoom: number };

/**
 * Where the Record map's camera goes when the hiker's position changes or
 * Recenter is pressed.
 *
 * - `here`: where the phone is, or null while it isn't known yet.
 * - `following`: the map follows the hiker; dragging the map turns it off.
 * - `placed`: the camera has already been put on the hiker once since the
 *   map opened, so later moves glide instead of jumping.
 * - `recenter`: the hiker pressed Recenter. It also brings the zoom back,
 *   since they may have zoomed far out while looking around.
 */
export function cameraMove({
  here,
  following,
  placed,
  recenter = false,
}: {
  here: LngLat | null;
  following: boolean;
  placed: boolean;
  recenter?: boolean;
}): CameraMove {
  if (!here) return { type: 'none' };
  if (recenter) return { type: 'fly', center: here, zoom: FOLLOW_ZOOM };
  if (!following) return { type: 'none' };
  if (!placed) return { type: 'jump', center: here, zoom: FOLLOW_ZOOM };
  return { type: 'ease', center: here };
}
