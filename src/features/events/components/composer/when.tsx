import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { QuietIconButton } from '@/components/QuietIconButton';
import { SheetSwitch } from '@/components/Sheet';
import { addDays, isSameDay, type CalendarDate } from '@/features/calendar/calendar-date';
import type { CalendarSystem } from '@/features/calendar/calendar-system';
import { Numeral } from '@/features/clock/components/Numeral';
import { GLYPH_HEIGHT, layoutNumeral } from '@/features/clock/numerals';
import { useSettings } from '@/features/settings/SettingsProvider';

import { formatWallTime, type WallTime } from '../../item-time';
import type { Paper } from './paper';
import { TextButton } from './parts';

/** The date and time part of a draft. */
export type WhenValue = {
  date: CalendarDate;
  /** False: all day (or, for a note, no particular time). */
  timed: boolean;
  hours: number;
  minutes: number;
  seconds: number;
  showSeconds: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** "Today", "Tomorrow", "Yesterday", or null. */
function relativeDay(date: CalendarDate, today: CalendarDate): string | null {
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, addDays(today, 1))) return 'Tomorrow';
  if (isSameDay(date, addDays(today, -1))) return 'Yesterday';
  return null;
}

/**
 * The date and time at the top of the page, set like a rubber date stamp
 * with a strip of tape: the time in the dial's numerals, the date beside
 * it. Pressing it opens the date and time for changes.
 */
export function WhenStamp({
  value,
  system,
  today,
  hour12,
  paper,
  open,
  onPress,
}: {
  value: WhenValue;
  system: CalendarSystem;
  today: CalendarDate;
  hour12: boolean;
  paper: Paper;
  open: boolean;
  onPress: () => void;
}) {
  const { uiTheme: ui } = useSettings();
  const time = { hours: value.hours, minutes: value.minutes, seconds: value.seconds };
  const relative = relativeDay(value.date, today);
  const longDate = system.longDate(value.date);
  const secondary = system.secondaryDate?.(value.date);
  const timeText = value.timed ? formatWallTime(time, value.showSeconds, hour12) : 'All day';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Date and time: ${longDate}, ${timeText}`}
      accessibilityHint={open ? 'Closes the date and time' : 'Opens the date and time to change'}
      aria-expanded={open}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.stamp,
        {
          borderColor: paper.stamp,
          backgroundColor: hovered || pressed || open ? ui.hover : 'transparent',
        },
      ]}
    >
      <View style={[styles.tape, { backgroundColor: paper.tape }]} />
      <View style={styles.timeBlock}>
        {value.timed ? (
          <>
            <TimeNumerals
              time={time}
              hour12={hour12}
              withSeconds={value.showSeconds}
              color={ui.ink}
            />
            {hour12 ? (
              <Text style={[styles.meridiem, { color: ui.accent }]}>
                {value.hours >= 12 ? 'PM' : 'AM'}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={[styles.allDay, { color: ui.ink }]}>All day</Text>
        )}
      </View>
      <View style={[styles.divider, { backgroundColor: paper.stamp }]} />
      <View style={styles.dateBlock}>
        {relative ? (
          <Text style={[styles.relative, { color: ui.accent }]}>
            {relative.toLocaleUpperCase()}
          </Text>
        ) : null}
        <Text style={[styles.date, { color: ui.ink }]} numberOfLines={2}>
          {longDate}
        </Text>
        {secondary ? (
          <Text style={[styles.secondary, { color: ui.muted }]}>{secondary}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** "3:00" or "15:00:28" in the dial's numerals, with a two-dot colon. */
function TimeNumerals({
  time,
  hour12,
  withSeconds,
  color,
  height = 28,
}: {
  time: WallTime;
  hour12: boolean;
  withSeconds: boolean;
  color: string;
  height?: number;
}) {
  const stroke = Math.max(2.4, height * 0.11);
  const hour = hour12 ? time.hours % 12 || 12 : time.hours;
  const parts = [String(hour), pad(time.minutes), ...(withSeconds ? [pad(time.seconds)] : [])];
  const widths = parts.map((p) => (layoutNumeral(p).width / GLYPH_HEIGHT) * height);
  const colon = height * 0.36;
  const width = widths.reduce((a, b) => a + b, 0) + colon * (parts.length - 1) + stroke * 2;
  const svgHeight = height + stroke * 2;
  const mid = svgHeight / 2;

  let x = stroke;
  const nodes = parts.map((text, i) => {
    const w = widths[i];
    const numeral = (
      <Numeral
        key={`n${i}`}
        text={text}
        x={x + w / 2}
        y={mid}
        height={height}
        strokeWidth={stroke}
        color={color}
      />
    );
    x += w;
    if (i === parts.length - 1) return numeral;
    const cx = x + colon / 2;
    x += colon;
    return [
      numeral,
      <Circle key={`a${i}`} cx={cx} cy={mid - height * 0.2} r={stroke * 0.6} fill={color} />,
      <Circle key={`b${i}`} cx={cx} cy={mid + height * 0.2} r={stroke * 0.6} fill={color} />,
    ];
  });

  return (
    <Svg width={width} height={svgHeight} accessibilityElementsHidden>
      {nodes}
    </Svg>
  );
}

/** The date and time, opened for changes below the stamp. */
export function WhenEditor({
  value,
  system,
  hour12,
  allowAllDay,
  allDayLabel,
  past,
  onChange,
  onDone,
}: {
  value: WhenValue;
  system: CalendarSystem;
  hour12: boolean;
  allowAllDay: boolean;
  /** "All day", or for notes "No particular time". */
  allDayLabel: string;
  past: boolean;
  onChange: (patch: Partial<WhenValue>) => void;
  onDone: () => void;
}) {
  const { uiTheme: ui } = useSettings();
  const longDate = system.longDate(value.date);
  const secondary = system.secondaryDate?.(value.date);

  return (
    <View style={styles.editor}>
      <View style={styles.dateRow}>
        <QuietIconButton
          icon={ChevronLeft}
          label="Previous day"
          onPress={() => onChange({ date: addDays(value.date, -1) })}
          restOpacity={0.6}
          touchRestOpacity={0.75}
        />
        <View style={styles.dateText} accessible accessibilityLabel={`Date: ${longDate}`}>
          <Text style={[styles.editorDate, { color: ui.ink }]}>{longDate}</Text>
          {secondary ? (
            <Text style={[styles.secondary, { color: ui.muted }]}>{secondary}</Text>
          ) : null}
        </View>
        <QuietIconButton
          icon={ChevronRight}
          label="Next day"
          onPress={() => onChange({ date: addDays(value.date, 1) })}
          restOpacity={0.6}
          touchRestOpacity={0.75}
        />
      </View>

      {allowAllDay ? (
        <SheetSwitch
          label={allDayLabel}
          value={!value.timed}
          onChange={(off) => onChange({ timed: !off })}
          first
        />
      ) : null}

      {value.timed ? (
        <TimeFields
          value={value}
          hour12={hour12}
          onChange={onChange}
          onToggleSeconds={() => onChange({ showSeconds: !value.showSeconds, seconds: 0 })}
        />
      ) : null}

      <View style={styles.editorFoot}>
        <Text style={[styles.note, { color: ui.muted }]}>
          {past ? 'This time has already passed.' : ''}
        </Text>
        <TextButton label="Done" a11yLabel="Done with date and time" onPress={onDone} />
      </View>
    </View>
  );
}

/** Hours, minutes (and seconds when asked) as typed fields; AM/PM where the locale uses it. */
function TimeFields({
  value,
  hour12,
  onChange,
  onToggleSeconds,
}: {
  value: WhenValue;
  hour12: boolean;
  onChange: (patch: Partial<WhenValue>) => void;
  onToggleSeconds: () => void;
}) {
  const { uiTheme: ui } = useSettings();
  const pm = value.hours >= 12;
  const shownHour = hour12 ? value.hours % 12 || 12 : value.hours;

  const setHour = (n: number) => {
    if (!hour12) return onChange({ hours: clamp(n, 0, 23) });
    const h = clamp(n, 1, 12) % 12;
    onChange({ hours: pm ? h + 12 : h });
  };

  return (
    <View
      style={styles.timeRow}
      accessibilityLabel={`Time: ${formatWallTime(value, value.showSeconds, hour12)}`}
    >
      <NumberField label="Hours" value={shownHour} onCommit={setHour} />
      <Text style={[styles.colon, { color: ui.muted }]}>:</Text>
      <NumberField
        label="Minutes"
        value={value.minutes}
        pad
        onCommit={(m) => onChange({ minutes: clamp(m, 0, 59) })}
      />
      {value.showSeconds ? (
        <>
          <Text style={[styles.colon, { color: ui.muted }]}>:</Text>
          <NumberField
            label="Seconds"
            value={value.seconds}
            pad
            onCommit={(s) => onChange({ seconds: clamp(s, 0, 59) })}
          />
        </>
      ) : null}
      {hour12 ? (
        <View role="radiogroup" accessibilityLabel="AM or PM" style={styles.ampm}>
          {(['AM', 'PM'] as const).map((m) => {
            const selected = (m === 'PM') === pm;
            return (
              <Pressable
                key={m}
                accessibilityRole="radio"
                accessibilityLabel={m}
                aria-checked={selected}
                onPress={() => onChange({ hours: (value.hours % 12) + (m === 'PM' ? 12 : 0) })}
                style={[styles.ampmOption, selected && { backgroundColor: ui.lume }]}
              >
                <Text style={[styles.ampmText, { color: selected ? ui.onLume : ui.muted }]}>
                  {m}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View style={styles.flex} />
      <TextButton
        label={value.showSeconds ? '− sec' : '+ sec'}
        a11yLabel={value.showSeconds ? 'No seconds' : 'Seconds'}
        tone="muted"
        onPress={onToggleSeconds}
      />
    </View>
  );
}

function NumberField({
  label,
  value,
  pad: padded = false,
  onCommit,
}: {
  label: string;
  value: number;
  pad?: boolean;
  onCommit: (value: number) => void;
}) {
  const { uiTheme: ui } = useSettings();
  const shown = padded ? pad(value) : String(value);
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

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const styles = StyleSheet.create({
  stamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderRadius: 6,
    marginTop: 10,
    transform: [{ rotate: '-0.8deg' }],
  },
  tape: {
    position: 'absolute',
    top: -9,
    left: 26,
    width: 58,
    height: 17,
    opacity: 0.85,
    transform: [{ rotate: '-5deg' }],
  },
  timeBlock: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  meridiem: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2, marginBottom: 3 },
  allDay: { fontSize: 22, fontWeight: '300' },
  divider: { width: 1, alignSelf: 'stretch', opacity: 0.45 },
  dateBlock: { flex: 1, minWidth: 0 },
  relative: { fontSize: 10, fontWeight: '600', letterSpacing: 1.6, marginBottom: 2 },
  date: { fontSize: 14, lineHeight: 19 },
  secondary: { fontSize: 12, marginTop: 1 },
  editor: { marginTop: 14 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: -10, marginBottom: 6 },
  dateText: { flex: 1, alignItems: 'center' },
  editorDate: { fontSize: 15 },
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
  ampm: { flexDirection: 'row', marginLeft: 10, gap: 2 },
  ampmOption: { height: 32, paddingHorizontal: 10, borderRadius: 16, justifyContent: 'center' },
  ampmText: { fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  flex: { flex: 1 },
  editorFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  note: { fontSize: 12, flexShrink: 1 },
});
