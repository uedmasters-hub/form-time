import { Bell } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CalendarTheme } from '../calendar-theme';

/**
 * The quiet lists beside a day: a hairline-topped heading in small tracked
 * capitals, then rows of "■ KIND · WHEN" over a title. Shared by the
 * digital watch's "Up next" and the calendar's day panel, so both read the
 * same. 'end' sets everything flush right; 'start' mirrors it.
 */
type Align = 'start' | 'end';

/** "UP NEXT" on a hairline, with an aside (a count, controls) at the far side. */
export function InfoHeading({
  label,
  theme,
  align = 'end',
  scale = 1,
  aside,
}: {
  label: string;
  theme: CalendarTheme;
  align?: Align;
  scale?: number;
  aside?: ReactNode;
}) {
  const type = Math.min(scale, 1.35);
  const text = (
    <Text
      style={[styles.label, { color: theme.muted, fontSize: 10 * type }]}
      accessibilityRole="header"
    >
      {label.toLocaleUpperCase()}
    </Text>
  );
  const side = aside ?? <View />;
  return (
    <View
      style={[
        styles.heading,
        { borderColor: theme.hairline, paddingTop: 12 * scale, marginBottom: 4 * scale },
      ]}
    >
      {align === 'end' ? side : text}
      {align === 'end' ? text : side}
    </View>
  );
}

/** "+2 more", set beside a heading. */
export function InfoAside({
  text,
  theme,
  scale = 1,
}: {
  text: string;
  theme: CalendarTheme;
  scale?: number;
}) {
  return <Text style={{ color: theme.muted, fontSize: 12 * Math.min(scale, 1.35) }}>{text}</Text>;
}

/** One entry: a meta line in capitals, the title, and an optional detail line. */
export function InfoRow({
  kind,
  title,
  detail,
  theme,
  align = 'end',
  scale = 1,
  lead,
  kindColor,
  markColor,
  bell = false,
  titleLines = 1,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  /** "MEETING · 10:00 AM"; set in capitals. */
  kind: string;
  title: string;
  /** A place, a note; muted, below the title. */
  detail?: string;
  theme: CalendarTheme;
  align?: Align;
  scale?: number;
  /** An accent word before the meta line ("IN 5 MIN"). */
  lead?: string;
  kindColor?: string;
  markColor?: string;
  /** A reminder is set. */
  bell?: boolean;
  titleLines?: number;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
}) {
  const end = align === 'end';
  const type = Math.min(scale, 1.35);
  const bellIcon = bell ? <Bell size={11 * type} color={theme.muted} strokeWidth={2} /> : null;
  const meta = (
    <View style={[styles.meta, end && styles.metaEnd]}>
      {lead ? (
        <Text style={[styles.lead, { color: theme.accent, fontSize: 10 * type }]}>
          {lead.toLocaleUpperCase()}
        </Text>
      ) : null}
      {end ? bellIcon : null}
      <View
        style={[
          styles.mark,
          { backgroundColor: markColor ?? theme.ink, width: 5 * type, height: 5 * type },
        ]}
      />
      <Text
        style={[styles.kind, { color: kindColor ?? theme.muted, fontSize: 10 * type }]}
        numberOfLines={1}
      >
        {kind.toLocaleUpperCase()}
      </Text>
      {end ? null : bellIcon}
    </View>
  );
  const body = (
    <>
      {meta}
      <Text
        style={[
          styles.title,
          { color: theme.ink, fontSize: 16 * type, marginTop: 3 * scale },
          end && styles.textEnd,
        ]}
        numberOfLines={titleLines}
      >
        {title}
      </Text>
      {detail ? (
        <Text
          style={[
            styles.detail,
            { color: theme.muted, fontSize: 12 * type },
            end && styles.textEnd,
          ]}
          numberOfLines={titleLines}
        >
          {detail}
        </Text>
      ) : null}
    </>
  );
  const box = [styles.row, end ? styles.rowEnd : styles.rowStart, { paddingVertical: 7 * scale }];

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        box,
        (hovered || pressed) && { backgroundColor: theme.hover },
      ]}
    >
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={accessibilityLabel} style={box}>
      {body}
    </View>
  );
}

/** A muted line where a list is empty ("Nothing else today."), with an optional control. */
export function InfoEmpty({
  text,
  theme,
  align = 'end',
  scale = 1,
  children,
}: {
  text: string;
  theme: CalendarTheme;
  align?: Align;
  scale?: number;
  children?: ReactNode;
}) {
  const end = align === 'end';
  return (
    <View
      style={[
        styles.empty,
        end ? styles.emptyEnd : styles.emptyStart,
        // A trailing text button's padding overhangs, so its label meets the edge.
        children && end ? styles.emptyOverhang : null,
        { paddingVertical: children ? 0 : 7 * scale },
      ]}
    >
      <Text style={{ color: theme.muted, fontSize: 14 * Math.min(scale, 1.35) }}>{text}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: { fontWeight: '600', letterSpacing: 1.6 },
  row: {
    alignSelf: 'stretch',
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 10,
  },
  rowEnd: { alignItems: 'flex-end' },
  rowStart: { alignItems: 'flex-start' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaEnd: { justifyContent: 'flex-end' },
  mark: { width: 5, height: 5 },
  kind: { fontWeight: '600', letterSpacing: 1.4, flexShrink: 1 },
  lead: { fontWeight: '600', letterSpacing: 1.2 },
  title: {},
  detail: { marginTop: 1 },
  textEnd: { textAlign: 'right' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  emptyEnd: { alignSelf: 'flex-end' },
  emptyStart: { alignSelf: 'flex-start' },
  emptyOverhang: { marginRight: -12 },
});
