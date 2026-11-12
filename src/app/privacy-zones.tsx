import type { CameraRef } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/form-error';
import { Slider } from '@/components/ui/slider';
import { Stripes } from '@/components/ui/stripes';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { FALLBACK_CENTER } from '@/config/map';
import { MapSearch } from '@/features/map-search/map-search';
import type { Place } from '@/features/map-search/place-search';
import {
  addBlocker,
  draftChanged,
  draftFromZone,
  MAX_LABEL_LENGTH,
  newDraft,
  RADIUS_MAX_M,
  RADIUS_MIN_M,
  RADIUS_STEP_M,
  snapRadius,
  type Zone,
  type ZoneDraft,
  zoneName,
} from '@/features/privacy-zones/privacy-zones';
import {
  usePrivacyZones,
  useRemoveZone,
  useSaveZone,
} from '@/features/privacy-zones/privacy-zones-api';
import { ZoneList } from '@/features/privacy-zones/zone-list';
import { ZONE_MAP_HEIGHT, ZONE_ZOOM, ZoneMap } from '@/features/privacy-zones/zone-map';
import { useSyncStatusStore } from '@/sync/sync-status-store';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

/**
 * The design's Privacy zones screen: circles around places such as home.
 * The server hides the parts of your hikes inside them from everyone else.
 *
 * Pick a zone in the list (the first one to start with), drag the map to
 * move it and the slider to size it, then Save. "Add zone" starts a new one
 * where the map is. Zones live on the server only, so this needs signal.
 *
 * It sits over the tabs (like Search) so the new-post screen can open it
 * without losing the post being written.
 */
export default function PrivacyZonesScreen() {
  const colors = useColors();
  const zonesQuery = usePrivacyZones();
  const zones = zonesQuery.data ?? [];
  const saveZone = useSaveZone();
  const removeZone = useRemoveZone();
  const online = useSyncStatusStore((s) => s.online) !== false;
  const cameraRef = useRef<CameraRef>(null);
  const mapCenter = useRef<{ lat: number; lng: number } | null>(null);
  // undefined while still asking the phone; null when it doesn't know.
  const [lastKnown, setLastKnown] = useState<[number, number] | null | undefined>(undefined);
  // The zone being edited. Until one is picked, it's the first zone, as in the design.
  const [picked, setPicked] = useState<ZoneDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Location.getLastKnownPositionAsync()
      .then((p) => (p ? ([p.coords.longitude, p.coords.latitude] as [number, number]) : null))
      .catch(() => null)
      .then((found) => {
        if (!cancelled) setLastKnown(found);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const draft = picked ?? (zones[0] ? draftFromZone(zones[0]) : null);
  const saved = draft?.id ? zones.find((zone) => zone.id === draft.id) : undefined;
  const draftIndex = saved ? zones.indexOf(saved) : zones.length;
  const changed = draft ? draftChanged(saved, draft) : false;
  const busy = saveZone.isPending || removeZone.isPending;
  const blocker = addBlocker(zones.length);

  // The map opens on the first zone, else where the phone last was.
  const ready = !zonesQuery.isPending && lastKnown !== undefined;
  const initialCenter: [number, number] = zones[0]
    ? [zones[0].lng, zones[0].lat]
    : (lastKnown ?? FALLBACK_CENTER);

  const edit = (change: Partial<ZoneDraft>) => {
    if (draft) setPicked({ ...draft, ...change });
  };

  const select = (zone: Zone) => {
    setMessage(null);
    setPicked(draftFromZone(zone));
    cameraRef.current?.easeTo({ center: [zone.lng, zone.lat], duration: 400 });
  };

  /**
   * A place picked in the search: the map flies there, and the zone being
   * edited goes with it (its center is always the middle of the map).
   */
  const goTo = (place: Place) => {
    const center = { lat: place.lat, lng: place.lng };
    mapCenter.current = center;
    if (draft) edit(center);
    cameraRef.current?.flyTo({ center: [place.lng, place.lat], zoom: ZONE_ZOOM, duration: 800 });
  };

  const add = () => {
    setMessage(blocker);
    if (blocker) return;
    const center = mapCenter.current ?? { lat: initialCenter[1], lng: initialCenter[0] };
    setPicked(newDraft(center, zones));
  };

  const save = () => {
    if (!draft) return;
    setMessage(null);
    saveZone.mutate(
      { draft, saved },
      {
        onSuccess: (result) => {
          setPicked(draftFromZone(result.zone));
          if (!result.oldRemoved) {
            setMessage("Saved. The zone's old copy couldn't be removed, so remove it from the list.");
          }
        },
        onError: (e) => setMessage(errorMessage(e)),
      },
    );
  };

  /**
   * Edits the first zone again (or nothing when there's none), moving the map
   * to it: the pin in the middle must always be the edited zone's center.
   */
  const backToFirst = (except?: string) => {
    const next = zones.find((zone) => zone.id !== except);
    if (next) select(next);
    else setPicked(null);
  };

  const cancelNew = () => {
    setMessage(null);
    backToFirst();
  };

  const confirmRemove = () => {
    if (!saved) return;
    const name = zoneName(saved.label, draftIndex);
    Alert.alert(name, 'Remove this zone? Your route inside it shows again to others.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setMessage(null);
          removeZone.mutate(saved.id, {
            onSuccess: () => backToFirst(saved.id),
            onError: (e) => setMessage(errorMessage(e)),
          });
        },
      },
    ]);
  };

  return (
    // The header (with the back button) sits under the status bar already.
    <SafeAreaView edges={['bottom']} style={[styles.page, { backgroundColor: colors.bg }]}>
      {/* The map stays put; what's under it scrolls, so dragging the map never scrolls the page. */}
      <View style={styles.top}>
        <View style={styles.heading}>
          <Text variant="title">Privacy zones</Text>
          <Text variant="small" color="muted2">
            Track points inside a zone are hidden on your public hikes and posts.
          </Text>
        </View>
        {ready ? (
          <ZoneMap
            cameraRef={cameraRef}
            initialCenter={initialCenter}
            zones={zones}
            draft={draft}
            onCenterChange={(center, byUser) => {
              mapCenter.current = center;
              if (byUser && draft) edit(center);
            }}
            overlay={
              <MapSearch
                getNear={() => (mapCenter.current ? [mapCenter.current.lng, mapCenter.current.lat] : null)}
                onPick={goTo}
                placeholder={draft ? 'Search a place to put the zone' : 'Search a place'}
                maxListHeight={ZONE_MAP_HEIGHT - 70}
              />
            }
          />
        ) : (
          <View style={[styles.mapPlaceholder, { borderColor: colors.line }]}>
            <Stripes id="zone-map-loading" size={24} />
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.below}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {draft ? (
          <>
            <View style={styles.radius}>
              <View style={styles.radiusTop}>
                <Text variant="small" style={styles.radiusLabel} numberOfLines={1}>
                  Radius · {zoneName(draft.label, draftIndex)}
                </Text>
                <Text variant="small" color="accentText" style={styles.tabular}>
                  {draft.radiusM} m
                </Text>
              </View>
              <Slider
                value={draft.radiusM}
                min={RADIUS_MIN_M}
                max={RADIUS_MAX_M}
                step={RADIUS_STEP_M}
                onChange={(m) => edit({ radiusM: snapRadius(m) })}
                disabled={busy}
                accessibilityLabel="Zone radius"
                valueText={`${draft.radiusM} meters`}
              />
            </View>
            <TextField
              label="Name"
              placeholder="e.g. Home"
              value={draft.label}
              onChangeText={(label) => edit({ label })}
              maxLength={MAX_LABEL_LENGTH}
              editable={!busy}
              returnKeyType="done"
            />
            <View style={styles.actions}>
              <Button
                label={online ? 'Save zone' : 'Needs signal'}
                onPress={save}
                loading={saveZone.isPending}
                disabled={!changed || !online || removeZone.isPending}
                style={styles.action}
              />
              {draft.id === null ? (
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={cancelNew}
                  disabled={busy}
                  style={styles.action}
                />
              ) : (
                <Button
                  label="Remove"
                  variant="secondary"
                  onPress={confirmRemove}
                  loading={removeZone.isPending}
                  disabled={!online || saveZone.isPending}
                  style={styles.action}
                />
              )}
            </View>
          </>
        ) : null}

        <FormError
          message={
            message ??
            (zonesQuery.isError && !zonesQuery.data ? errorMessage(zonesQuery.error) : null)
          }
        />
        {zonesQuery.isError && !zonesQuery.data ? (
          <Button label="Try again" variant="secondary" onPress={() => zonesQuery.refetch()} />
        ) : null}

        <ZoneList
          zones={zones}
          draft={draft}
          loading={zonesQuery.isPending}
          onSelect={select}
          onAdd={add}
          addDisabled={busy || !zonesQuery.data || (draft !== null && draft.id === null)}
        />
        {zonesQuery.data && zones.length === 0 && !draft ? (
          <Text variant="small" color="muted2" style={styles.empty}>
            No zones yet. Add one around places you start hikes from, such as your home.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  top: {
    gap: 16,
    paddingTop: 4,
    paddingHorizontal: 18,
  },
  heading: {
    gap: 6,
  },
  mapPlaceholder: {
    height: 250,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  below: {
    gap: 16,
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  radius: {
    gap: 8,
  },
  radiusTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  radiusLabel: {
    flex: 1,
    fontSize: 14,
  },
  tabular: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    flex: 1,
  },
  empty: {
    paddingHorizontal: 4,
  },
});
