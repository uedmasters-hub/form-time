import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '@/features/settings/SettingsProvider';
import { useSound } from '@/features/sound/SoundProvider';

import { useEvents } from '../EventsProvider';
import { formatWallTime, placeIn } from '../item-time';
import { showSystemNotification } from '../notifications';
import { readFired, writeFired } from '../reminder-state';
import { KIND_LABEL, type CalendarItem } from '../types';

/**
 * Rings reminders while FORM / TIME is open: a quiet card at the top of the
 * screen, a system notification where the browser allows it, and a sound
 * (Settings → Sound): a short phrase, repeated for alarms, or one soft note
 * for missed ones. Reminders that came due while the app was closed (within the
 * last 12 hours) show as missed when it opens; older ones are let go.
 */
const CATCH_UP_MS = 12 * 3600_000;
const LATE_MS = 2 * 60_000;
const SNOOZE_MS = 5 * 60_000;
const MAX_WAIT_MS = 30_000;

type Ringing = { item: CalendarItem; missed: boolean };

export function ReminderHost() {
  const { items, loaded, save } = useEvents();
  const { uiTheme: ui, timeZone } = useSettings();
  const { ring, notify, willSound } = useSound();
  const insets = useSafeAreaInsets();
  // Phones: below the region code in the corner. Wide screens: at the top edge.
  const { width } = useWindowDimensions();
  const top = insets.top + (width >= 720 ? 16 : 64);
  const [ringing, setRinging] = useState<Ringing[]>([]);
  const fired = useRef<Record<string, string>>({});
  const stops = useRef(new Map<string, () => void>());
  const [tick, setTick] = useState(0);

  const check = useCallback(() => {
    if (!loaded) return;
    // Re-read: items joining an account carry their rung reminders across.
    fired.current = readFired();
    const now = Date.now();
    const due: Ringing[] = [];
    for (const item of items) {
      if (!item.remindAt || fired.current[item.id] === item.remindAt) continue;
      const at = Date.parse(item.remindAt);
      if (at > now) continue;
      fired.current[item.id] = item.remindAt;
      if (now - at > CATCH_UP_MS) continue; // long gone: let it go quietly
      due.push({ item, missed: now - at > LATE_MS });
    }
    if (due.length === 0) return;
    writeFired(fired.current);
    setRinging((current) => [
      ...current.filter((r) => !due.some((d) => d.item.id === r.item.id)),
      ...due,
    ]);
    // One sound for everything that came due together: a ring (repeated
    // if an alarm is among them), else a soft note for missed ones.
    const live = due.filter((d) => !d.missed);
    const cue = live.length > 0 ? 'reminder' : 'notification';
    const ownSound = willSound(cue);
    for (const { item, missed } of due) {
      const placed = placeIn(item, timeZone);
      const when = placed.time ? formatWallTime(placed.time) : 'Today';
      showSystemNotification(
        item.title,
        `${missed ? 'Missed · ' : ''}${KIND_LABEL[item.kind]} · ${when}`,
        `formtime-${item.id}`,
        ownSound,
      );
    }
    if (live.length > 0) {
      const stop = ring(live.some((d) => d.item.kind === 'alarm'));
      for (const { item } of live) stops.current.set(item.id, stop);
    } else {
      notify();
    }
  }, [items, loaded, timeZone, ring, notify, willSound]);

  // Check now, then again at the next reminder (or within 30 s).
  useEffect(() => {
    check();
    const now = Date.now();
    const next = items
      .map((item) => (item.remindAt ? Date.parse(item.remindAt) : Infinity))
      .filter((at) => at > now)
      .reduce((min, at) => Math.min(min, at), Infinity);
    const wait = Math.max(250, Math.min(MAX_WAIT_MS, next - now + 50));
    const timer = setTimeout(() => setTick((t) => t + 1), wait);
    return () => clearTimeout(timer);
  }, [check, items, tick]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  const dismiss = (id: string) => {
    stops.current.get(id)?.();
    stops.current.delete(id);
    setRinging((current) => current.filter((r) => r.item.id !== id));
  };

  const snooze = (item: CalendarItem) => {
    dismiss(item.id);
    save({ ...item, remindAt: new Date(Date.now() + SNOOZE_MS).toISOString() });
  };

  if (ringing.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.stack, { top }]}>
      {ringing.slice(-3).map(({ item, missed }) => {
        const placed = placeIn(item, timeZone);
        const when = placed.time ? formatWallTime(placed.time) : 'All day';
        return (
          <View
            key={item.id}
            role="alert"
            aria-live="assertive"
            style={[
              styles.card,
              ui.flat ? styles.flatCard : styles.raised,
              { backgroundColor: ui.surface, borderColor: ui.hairline },
            ]}
          >
            <View
              style={[
                styles.bar,
                { backgroundColor: item.kind === 'alarm' ? ui.accent : ui.lumeEdge },
              ]}
            />
            <View style={styles.text}>
              <Text style={[styles.meta, { color: missed ? ui.muted : ui.accent }]}>
                {`${missed ? 'Missed · ' : ''}${KIND_LABEL[item.kind]} · ${when}`.toLocaleUpperCase()}
              </Text>
              <Text style={[styles.title, { color: ui.ink }]} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
            <View style={styles.actions}>
              {!missed ? (
                <Action
                  label="Snooze 5 min"
                  onPress={() => snooze(item)}
                  color={ui.ink}
                  hover={ui.hover}
                />
              ) : null}
              <Action
                label="Dismiss"
                onPress={() => dismiss(item.id)}
                color={ui.ink}
                hover={ui.hover}
                strong
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Action({
  label,
  onPress,
  color,
  hover,
  strong = false,
}: {
  label: string;
  onPress: () => void;
  color: string;
  hover: string;
  strong?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.action,
        { backgroundColor: hovered || pressed ? hover : 'transparent' },
      ]}
    >
      <Text style={[styles.actionText, { color, fontWeight: strong ? '600' : '400' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 8 },
  card: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 8,
    paddingLeft: 0,
    borderRadius: 18,
    overflow: 'hidden',
  },
  /** Flat: a crisp 1 pt edge stands in for the shadow. */
  flatCard: { borderWidth: 1 },
  raised: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginLeft: 10 },
  text: { flex: 1 },
  meta: { fontSize: 10, fontWeight: '600', letterSpacing: 1.4 },
  title: { fontSize: 15, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 2 },
  action: { height: 36, paddingHorizontal: 10, borderRadius: 18, justifyContent: 'center' },
  actionText: { fontSize: 13 },
});
