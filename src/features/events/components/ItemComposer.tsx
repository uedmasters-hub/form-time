import {
  AlarmClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CornerUpRight,
  StickyNote,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { QuietIconButton } from '@/components/QuietIconButton';
import { Sheet, SheetSection, SheetSwitch } from '@/components/Sheet';
import {
  addDays,
  isSameDay,
  toISODate,
  type CalendarDate,
} from '@/features/calendar/calendar-date';
import { calendarSystemFor } from '@/features/calendar/calendar-system';
import { useToday } from '@/features/calendar/use-today';
import { useSettings } from '@/features/settings/SettingsProvider';

import { useEvents } from '../EventsProvider';
import {
  formatWallTime,
  newId,
  parseISODate,
  parseTime,
  scheduleFor,
  timeString,
  uses12Hour,
  type WallTime,
} from '../item-time';
import { requestNotificationPermission } from '../notifications';
import { ITEM_KINDS, REMINDERS, type CalendarItem, type ItemKind } from '../types';

/** What the composer opens with: a new item at a date/time, or an existing item. */
export type ComposerRequest =
  | { mode: 'new'; date: CalendarDate; time: WallTime | null; kind?: ItemKind; seconds?: boolean }
  | { mode: 'edit'; item: CalendarItem };

const KIND_ICONS: Record<ItemKind, LucideIcon> = {
  event: CalendarDays,
  meeting: Users,
  note: StickyNote,
  follow_up: CornerUpRight,
  alarm: AlarmClock,
};

/** Sensible reminder for each kind until the user picks one. */
const DEFAULT_REMINDER: Record<ItemKind, number | null> = {
  event: 15,
  meeting: 15,
  note: null,
  follow_up: 0,
  alarm: 0,
};

type Draft = {
  kind: ItemKind;
  title: string;
  notes: string;
  date: CalendarDate;
  timed: boolean;
  hours: number;
  minutes: number;
  seconds: number;
  showSeconds: boolean;
  reminder: number | null;
  reminderTouched: boolean;
};

function draftFrom(request: ComposerRequest): Draft {
  if (request.mode === 'edit') {
    const { item } = request;
    const time = item.time ? parseTime(item.time) : { hours: 9, minutes: 0, seconds: 0 };
    return {
      kind: item.kind,
      title: item.title,
      notes: item.notes,
      date: parseISODate(item.date),
      timed: item.time !== null,
      ...time,
      showSeconds: time.seconds !== 0,
      reminder: item.reminderMinutes,
      reminderTouched: true,
    };
  }
  const kind = request.kind ?? 'event';
  const time = request.time ?? { hours: 9, minutes: 0, seconds: 0 };
  return {
    kind,
    title: '',
    notes: '',
    date: request.date,
    timed: request.time !== null,
    ...time,
    showSeconds: Boolean(request.seconds) && time.seconds !== 0,
    reminder: DEFAULT_REMINDER[kind],
    reminderTouched: false,
  };
}

const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

type ItemComposerProps = {
  request: ComposerRequest | null;
  onClose: () => void;
};

/**
 * Add or edit one item. A single column, top to bottom: what it is, a
 * title, when, a reminder, notes. Closing with unsaved changes asks first;
 * deleting asks first.
 */
export function ItemComposer({ request, onClose }: ItemComposerProps) {
  const { uiTheme: ui, timeZone, settings } = useSettings();
  const { save, remove } = useEvents();
  const today = useToday(timeZone);
  const system = calendarSystemFor(settings.region, settings.nepalCalendar, today);
  const hour12 = uses12Hour();

  const [draft, setDraft] = useState<Draft | null>(null);
  const initial = useRef<Draft | null>(null);
  const [confirm, setConfirm] = useState<'discard' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const titleRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!request) return;
    const next = draftFrom(request);
    initial.current = next;
    setDraft(next);
    setConfirm(null);
    setError(null);
    setNotice(null);
    // Focus the title once the sheet has opened (web; native opens the keyboard).
    const t = setTimeout(() => titleRef.current?.focus(), 260);
    return () => clearTimeout(t);
  }, [request]);

  const editing = request?.mode === 'edit' ? request.item : null;
  const changed = draft && initial.current ? !sameDraft(draft, initial.current) : false;

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setError(null);
    setConfirm(null);
  };

  const close = () => {
    if (changed && confirm !== 'discard') {
      setConfirm('discard');
      return;
    }
    onClose();
  };

  const when = useMemo(() => {
    if (!draft) return null;
    return scheduleFor(
      draft.date,
      draft.timed ? { hours: draft.hours, minutes: draft.minutes, seconds: draft.seconds } : null,
      timeZone,
      draft.reminder,
    );
  }, [draft, timeZone]);

  // The last draft stays rendered while the sheet animates closed.
  if (!draft) return null;
  const open = request !== null;

  const kindInfo = ITEM_KINDS.find((k) => k.id === draft.kind) ?? ITEM_KINDS[0];
  const past = when?.startsAt ? Date.parse(when.startsAt) < Date.now() : false;
  const remindPast = when?.remindAt ? Date.parse(when.remindAt) < Date.now() : false;

  const submit = async () => {
    const title = draft.title.trim() || (draft.kind === 'alarm' ? 'Alarm' : '');
    if (!title) {
      setError('Add a title');
      titleRef.current?.focus();
      return;
    }
    const time = draft.timed
      ? timeString({ hours: draft.hours, minutes: draft.minutes, seconds: draft.seconds })
      : null;
    const now = new Date().toISOString();
    const item: CalendarItem = {
      id: editing?.id ?? newId(),
      kind: draft.kind,
      title,
      notes: draft.notes.trim(),
      date: toISODate(draft.date),
      time,
      // An edited item keeps its zone unless its date or time changed.
      timeZone:
        editing && editing.date === toISODate(draft.date) && editing.time === time
          ? editing.timeZone
          : timeZone,
      startsAt: when?.startsAt ?? null,
      remindAt: when?.remindAt ?? null,
      reminderMinutes: draft.reminder,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    };
    save(item);
    if (item.remindAt) {
      const permission = await requestNotificationPermission();
      if (permission === 'denied') {
        setNotice(
          'Saved. Browser notifications are off, so reminders show here while FORM / TIME is open.',
        );
        initial.current = draft;
        return;
      }
    }
    onClose();
  };

  const dateLabel = system.longDate(draft.date);
  const secondary = system.secondaryDate?.(draft.date);
  const isToday = isSameDay(draft.date, today);

  return (
    <Sheet
      visible={open}
      onClose={close}
      title={editing ? `Edit ${kindInfo.label.toLowerCase()}` : 'New'}
      anchor="center"
    >
      {/* What it is */}
      <View role="radiogroup" accessibilityLabel="Kind" style={styles.kinds}>
        {ITEM_KINDS.map((k) => {
          const selected = k.id === draft.kind;
          const Icon = KIND_ICONS[k.id];
          return (
            <Pressable
              key={k.id}
              accessibilityRole="radio"
              accessibilityLabel={k.label}
              aria-checked={selected}
              onPress={() =>
                update({
                  kind: k.id,
                  ...(draft.reminderTouched ? null : { reminder: DEFAULT_REMINDER[k.id] }),
                  ...(k.id === 'alarm' ? { timed: true } : null),
                })
              }
              style={({ hovered, pressed }) => [
                styles.kind,
                {
                  borderColor: selected ? ui.ink : ui.hairline,
                  borderWidth: selected ? 1.5 : 1,
                  backgroundColor: hovered || pressed ? ui.hover : 'transparent',
                },
              ]}
            >
              <Icon size={16} color={selected ? ui.ink : ui.muted} strokeWidth={1.5} />
              <Text
                style={[
                  styles.kindLabel,
                  { color: selected ? ui.ink : ui.muted, fontWeight: selected ? '600' : '400' },
                ]}
              >
                {k.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Title */}
      <TextInput
        ref={titleRef}
        value={draft.title}
        onChangeText={(title) => update({ title })}
        placeholder={kindInfo.placeholder}
        placeholderTextColor={ui.muted}
        accessibilityLabel="Title"
        maxLength={200}
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        style={[styles.title, { color: ui.ink, borderColor: error ? ui.accent : ui.hairline }]}
      />
      {error ? <Text style={[styles.error, { color: ui.accent }]}>{error}</Text> : null}

      {/* When */}
      <SheetSection label="When" aside={isToday ? 'Today' : undefined}>
        <View style={styles.dateRow}>
          <QuietIconButton
            icon={ChevronLeft}
            label="Previous day"
            onPress={() => update({ date: addDays(draft.date, -1) })}
            restOpacity={0.6}
            touchRestOpacity={0.75}
          />
          <View style={styles.dateText} accessible accessibilityLabel={`Date: ${dateLabel}`}>
            <Text style={[styles.date, { color: ui.ink }]}>{dateLabel}</Text>
            {secondary ? <Text style={[styles.sub, { color: ui.muted }]}>{secondary}</Text> : null}
          </View>
          <QuietIconButton
            icon={ChevronRight}
            label="Next day"
            onPress={() => update({ date: addDays(draft.date, 1) })}
            restOpacity={0.6}
            touchRestOpacity={0.75}
          />
        </View>

        {draft.kind !== 'alarm' ? (
          <SheetSwitch
            label="All day"
            value={!draft.timed}
            onChange={(allDay) => update({ timed: !allDay })}
            first
          />
        ) : null}

        {draft.timed ? (
          <TimeFields
            draft={draft}
            hour12={hour12}
            onChange={update}
            onToggleSeconds={() => update({ showSeconds: !draft.showSeconds, seconds: 0 })}
          />
        ) : null}
        {past ? (
          <Text style={[styles.sub, { color: ui.muted, marginTop: 6 }]}>
            This time has already passed.
          </Text>
        ) : null}
      </SheetSection>

      {/* Reminder */}
      <SheetSection
        label="Remind"
        aside={
          when?.remindAt && !remindPast
            ? formatReminder(when.remindAt, timeZone, hour12)
            : undefined
        }
      >
        <View role="radiogroup" accessibilityLabel="Reminder" style={styles.chips}>
          {REMINDERS.filter((r) => draft.kind !== 'alarm' || r.minutes !== null).map((r) => {
            const selected = r.minutes === draft.reminder;
            return (
              <Pressable
                key={String(r.minutes)}
                accessibilityRole="radio"
                accessibilityLabel={
                  r.minutes === null
                    ? 'No reminder'
                    : `Remind ${r.label}${r.minutes ? ' before' : ''}`
                }
                aria-checked={selected}
                onPress={() => update({ reminder: r.minutes, reminderTouched: true })}
                style={({ hovered, pressed }) => [
                  styles.chip,
                  {
                    borderColor: selected ? ui.ink : ui.hairline,
                    borderWidth: selected ? 1.5 : 1,
                    backgroundColor: hovered || pressed ? ui.hover : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: selected ? ui.ink : ui.muted, fontWeight: selected ? '600' : '400' },
                  ]}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!draft.timed && draft.reminder !== null ? (
          <Text style={[styles.sub, { color: ui.muted, marginTop: 6 }]}>
            All-day reminders count back from 9:00 that morning.
          </Text>
        ) : null}
        {remindPast && when?.remindAt ? (
          <Text style={[styles.sub, { color: ui.muted, marginTop: 6 }]}>
            That reminder time has passed, so it won’t ring.
          </Text>
        ) : null}
      </SheetSection>

      {/* Notes */}
      <TextInput
        value={draft.notes}
        onChangeText={(notes) => update({ notes })}
        placeholder="Notes"
        placeholderTextColor={ui.muted}
        accessibilityLabel="Notes"
        multiline
        maxLength={4000}
        style={[styles.notes, { color: ui.ink, borderColor: ui.hairline }]}
      />

      {notice ? <Text style={[styles.notice, { color: ui.ink }]}>{notice}</Text> : null}

      {/* Confirmations */}
      {confirm ? (
        <View style={[styles.confirm, { borderColor: ui.hairline }]}>
          <Text style={[styles.confirmText, { color: ui.ink }]}>
            {confirm === 'discard'
              ? 'Discard your changes?'
              : `Delete this ${kindInfo.label.toLowerCase()}?`}
          </Text>
          <View style={styles.actions}>
            <TextButton
              label={confirm === 'discard' ? 'Keep editing' : 'Cancel'}
              onPress={() => setConfirm(null)}
            />
            <TextButton
              label={confirm === 'discard' ? 'Discard' : 'Delete'}
              strong
              onPress={() => {
                if (confirm === 'delete' && editing) remove(editing.id);
                onClose();
              }}
            />
          </View>
        </View>
      ) : (
        <View style={styles.footer}>
          {editing ? <TextButton label="Delete" onPress={() => setConfirm('delete')} /> : <View />}
          <View style={styles.actions}>
            <TextButton label={notice ? 'Done' : 'Cancel'} onPress={notice ? onClose : close} />
            {notice ? null : <TextButton label="Save" strong onPress={() => void submit()} />}
          </View>
        </View>
      )}
    </Sheet>
  );
}

function formatReminder(remindAt: string, timeZone: string, hour12: boolean) {
  const f = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12,
    timeZone,
  });
  return f.format(new Date(remindAt));
}

/** Hours, minutes (and seconds when asked), as typed fields; AM/PM where the locale uses it. */
function TimeFields({
  draft,
  hour12,
  onChange,
  onToggleSeconds,
}: {
  draft: Draft;
  hour12: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onToggleSeconds: () => void;
}) {
  const { uiTheme: ui } = useSettings();
  const pm = draft.hours >= 12;
  const shownHour = hour12 ? (draft.hours % 12 === 0 ? 12 : draft.hours % 12) : draft.hours;

  const setHour = (value: number) => {
    if (!hour12) return onChange({ hours: clamp(value, 0, 23) });
    const h = clamp(value, 1, 12) % 12;
    onChange({ hours: pm ? h + 12 : h });
  };

  return (
    <View
      style={styles.timeRow}
      accessibilityLabel={`Time: ${formatWallTime(draft, draft.showSeconds, hour12)}`}
    >
      <NumberField label="Hours" value={shownHour} onCommit={setHour} />
      <Text style={[styles.colon, { color: ui.muted }]}>:</Text>
      <NumberField
        label="Minutes"
        value={draft.minutes}
        pad
        onCommit={(m) => onChange({ minutes: clamp(m, 0, 59) })}
      />
      {draft.showSeconds ? (
        <>
          <Text style={[styles.colon, { color: ui.muted }]}>:</Text>
          <NumberField
            label="Seconds"
            value={draft.seconds}
            pad
            onCommit={(s) => onChange({ seconds: clamp(s, 0, 59) })}
          />
        </>
      ) : null}
      {hour12 ? (
        <View role="radiogroup" accessibilityLabel="AM or PM" style={styles.meridiem}>
          {(['AM', 'PM'] as const).map((m) => {
            const selected = (m === 'PM') === pm;
            return (
              <Pressable
                key={m}
                accessibilityRole="radio"
                accessibilityLabel={m}
                aria-checked={selected}
                onPress={() => onChange({ hours: (draft.hours % 12) + (m === 'PM' ? 12 : 0) })}
                style={[styles.meridiemOption, selected && { backgroundColor: ui.lume }]}
              >
                <Text style={[styles.meridiemText, { color: selected ? ui.onLume : ui.muted }]}>
                  {m}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={styles.flex} />
      <TextButton label={draft.showSeconds ? 'No seconds' : 'Seconds'} onPress={onToggleSeconds} />
    </View>
  );
}

function NumberField({
  label,
  value,
  pad = false,
  onCommit,
}: {
  label: string;
  value: number;
  pad?: boolean;
  onCommit: (value: number) => void;
}) {
  const { uiTheme: ui } = useSettings();
  const shown = pad ? String(value).padStart(2, '0') : String(value);
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const commit = () => {
    const n = Number.parseInt(text, 10);
    if (Number.isFinite(n)) onCommit(n);
    else setText(shown);
  };
  return (
    <TextInput
      value={text}
      onChangeText={(t) => setText(t.replace(/[^0-9]/g, '').slice(0, 2))}
      onBlur={commit}
      onSubmitEditing={commit}
      onKeyPress={(e) => {
        // Arrow keys step the value on web.
        const key = e.nativeEvent.key;
        if (key === 'ArrowUp' || key === 'ArrowDown') {
          (e as unknown as { preventDefault?: () => void }).preventDefault?.();
          onCommit(value + (key === 'ArrowUp' ? 1 : -1));
        }
      }}
      selectTextOnFocus
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={2}
      accessibilityLabel={label}
      style={[styles.number, { color: ui.ink, borderColor: ui.hairline }]}
    />
  );
}

function TextButton({
  label,
  onPress,
  strong = false,
}: {
  label: string;
  onPress: () => void;
  strong?: boolean;
}) {
  const { uiTheme: ui } = useSettings();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.button,
        strong
          ? { backgroundColor: ui.ink, opacity: pressed ? 0.8 : 1 }
          : { backgroundColor: hovered || pressed ? ui.hover : 'transparent' },
      ]}
    >
      <Text style={[styles.buttonText, { color: strong ? ui.surface : ui.ink }]}>{label}</Text>
    </Pressable>
  );
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const styles = StyleSheet.create({
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  kind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  kindLabel: { fontSize: 13 },
  title: {
    fontSize: 20,
    fontWeight: '300',
    paddingVertical: 10,
    borderBottomWidth: 1,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  error: { fontSize: 12, marginTop: 6 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: -10, marginBottom: 8 },
  dateText: { flex: 1, alignItems: 'center' },
  date: { fontSize: 15 },
  sub: { fontSize: 12, marginTop: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  number: {
    width: 52,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  colon: { fontSize: 20, marginHorizontal: 2 },
  meridiem: { flexDirection: 'row', marginLeft: 10, gap: 2 },
  meridiemOption: { height: 32, paddingHorizontal: 10, borderRadius: 16, justifyContent: 'center' },
  meridiemText: { fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center' },
  chipLabel: { fontSize: 13 },
  notes: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  notice: { fontSize: 13, lineHeight: 18, marginTop: 14 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  actions: { flexDirection: 'row', gap: 8 },
  button: { height: 40, paddingHorizontal: 18, borderRadius: 20, justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '500' },
  confirm: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  confirmText: { fontSize: 14 },
});
