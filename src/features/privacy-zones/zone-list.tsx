import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Briefcase, Check, HouseLine, MapPin, PlusCircle } from '@/components/ui/icons';
import { Text } from '@/components/ui/text';
import { radius } from '@/theme/tokens';
import { useColors } from '@/theme/use-colors';

import { type Zone, type ZoneDraft, zoneKind, zoneName } from './privacy-zones';

const ICONS = { home: HouseLine, work: Briefcase, pin: MapPin } as const;

/**
 * The design's zone list: one row per zone (icon, name, radius, a check on
 * the one being edited) and "Add zone" at the bottom. A new zone that isn't
 * saved yet shows as an extra row.
 */
export function ZoneList({
  zones,
  draft,
  loading,
  onSelect,
  onAdd,
  addDisabled,
}: {
  zones: readonly Zone[];
  draft: ZoneDraft | null;
  loading: boolean;
  onSelect: (zone: Zone) => void;
  onAdd: () => void;
  addDisabled: boolean;
}) {
  const colors = useColors();
  const unsaved = draft && draft.id === null ? draft : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line2 }]}>
      {loading ? (
        <View style={[styles.row, styles.loading, { borderBottomColor: colors.line2 }]}>
          <ActivityIndicator color={colors.accentHi} />
        </View>
      ) : null}
      {zones.map((zone, i) => {
        const selected = draft?.id === zone.id;
        // The list shows what the zone will be once saved.
        const shown = selected ? { label: draft.label, radiusM: draft.radiusM } : zone;
        return (
          <ZoneRow
            key={zone.id}
            name={zoneName(shown.label, i)}
            radiusM={shown.radiusM}
            selected={selected}
            onPress={() => onSelect(zone)}
          />
        );
      })}
      {unsaved ? (
        <ZoneRow
          name={zoneName(unsaved.label, zones.length)}
          radiusM={unsaved.radiusM}
          selected
          note="Not saved"
        />
      ) : null}
      <Pressable
        onPress={onAdd}
        disabled={addDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: addDisabled }}
        style={({ pressed }) => [
          styles.row,
          pressed && { backgroundColor: colors.hover },
          addDisabled && styles.disabled,
        ]}>
        <PlusCircle size={19} color={colors.accentText} />
        <Text color="accentText">Add zone</Text>
      </Pressable>
    </View>
  );
}

function ZoneRow({
  name,
  radiusM,
  selected,
  note,
  onPress,
}: {
  name: string;
  radiusM: number;
  selected: boolean;
  note?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const Icon = ICONS[zoneKind(name)];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}, ${radiusM} meters${note ? `, ${note.toLowerCase()}` : ''}`}
      style={({ pressed }) => [
        styles.row,
        { borderBottomWidth: 1, borderBottomColor: colors.line2 },
        selected && { backgroundColor: colors.tint },
        pressed && !selected && { backgroundColor: colors.hover },
      ]}>
      <Icon size={19} color={colors.accentHi} />
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      {note ? (
        <Text variant="small" color="accentText">
          {note}
        </Text>
      ) : null}
      <Text variant="small" color="muted2">
        {radiusM} m
      </Text>
      <View style={styles.check}>
        {selected ? <Check size={16} color={colors.accentHi} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 54,
    paddingHorizontal: 16,
  },
  loading: {
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  name: {
    flex: 1,
  },
  check: {
    width: 16,
  },
  disabled: {
    opacity: 0.5,
  },
});
