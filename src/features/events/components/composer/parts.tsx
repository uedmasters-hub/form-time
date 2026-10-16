import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useSettings } from '@/features/settings/SettingsProvider';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

/**
 * Small pieces of the composer page: the reveal for a new step, a folded
 * step, choice chips, quiet text buttons, the Save action and progress.
 */

/**
 * Fades a newly revealed step in, a few points below where it settles.
 * (A plain animated style, not a layout animation: on web those take the
 * element out of the flow, and the page no longer grows to fit it.)
 */
export function Reveal({ children, subtle = false }: { children: ReactNode; subtle?: boolean }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) progress.set(1);
    else progress.set(withTiming(1, { duration: subtle ? 180 : 260, easing: EASE_OUT }));
  }, [progress, reduced, subtle]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * (subtle ? 0 : 8) }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * A finished step, folded to one line: a small label, its value, and the
 * whole line a button that opens it again.
 */
export function FoldedStep({
  label,
  value,
  detail,
  icon: Icon,
  muted = false,
  rule,
  onPress,
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: LucideIcon;
  /** Shown faintly ("Not set"). */
  muted?: boolean;
  rule: string;
  onPress: () => void;
}) {
  const { uiTheme: ui } = useSettings();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
      accessibilityHint="Opens it to change"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.folded,
        { borderColor: rule },
        (hovered || pressed) && { backgroundColor: ui.hover },
      ]}
    >
      {({ hovered }) => (
        <>
          <Text style={[styles.foldedLabel, { color: ui.muted }]}>{label.toLocaleUpperCase()}</Text>
          <View style={styles.foldedValue}>
            {Icon ? <Icon size={15} color={muted ? ui.muted : ui.ink} strokeWidth={1.5} /> : null}
            <Text
              style={[styles.foldedText, { color: muted ? ui.muted : ui.ink }]}
              numberOfLines={1}
            >
              {value}
            </Text>
            {detail ? (
              <Text style={[styles.foldedDetail, { color: ui.muted }]} numberOfLines={1}>
                {detail}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.change, { color: ui.accent, opacity: hovered ? 1 : 0 }]}>
            Change
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** The heading over an open step: small tracked caps, with an optional aside. */
export function StepHeading({ label, aside }: { label: string; aside?: string }) {
  const { uiTheme: ui } = useSettings();
  return (
    <View style={styles.heading}>
      <Text style={[styles.headingText, { color: ui.muted }]} accessibilityRole="header">
        {label.toLocaleUpperCase()}
      </Text>
      {aside ? <Text style={[styles.aside, { color: ui.ink }]}>{aside}</Text> : null}
    </View>
  );
}

export type Choice<T> = { value: T; label: string; a11yLabel?: string; icon?: LucideIcon };

/** One-of-many chips; the chosen one is filled like the selected day. */
export function ChoiceChips<T extends string | number | null>({
  label,
  choices,
  value,
  onChoose,
}: {
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  onChoose: (value: T) => void;
}) {
  const { uiTheme: ui } = useSettings();
  return (
    <View role="radiogroup" accessibilityLabel={label} style={styles.chips}>
      {choices.map((c) => {
        const selected = c.value === value;
        const Icon = c.icon;
        return (
          <Pressable
            key={String(c.value)}
            accessibilityRole="radio"
            accessibilityLabel={c.a11yLabel ?? c.label}
            aria-checked={selected}
            onPress={() => onChoose(c.value)}
            style={({ hovered, pressed }) => [
              styles.chip,
              selected
                ? { backgroundColor: ui.lume, borderColor: ui.lumeEdge }
                : {
                    borderColor: ui.hairline,
                    backgroundColor: hovered || pressed ? ui.hover : 'transparent',
                  },
              pressed && styles.pressed,
            ]}
          >
            {Icon ? (
              <Icon size={15} color={selected ? ui.onLume : ui.muted} strokeWidth={1.5} />
            ) : null}
            <Text
              style={[
                styles.chipText,
                {
                  color: selected ? ui.onLume : ui.ink,
                  fontWeight: selected ? '600' : '400',
                },
              ]}
            >
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A quiet text button ("Next", "Done", "+ Notes"). */
export function TextButton({
  label,
  onPress,
  a11yLabel,
  tone = 'ink',
}: {
  label: string;
  onPress: () => void;
  a11yLabel?: string;
  tone?: 'ink' | 'accent' | 'muted';
}) {
  const { uiTheme: ui } = useSettings();
  const color = tone === 'accent' ? ui.accent : tone === 'muted' ? ui.muted : ui.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.textButton,
        { backgroundColor: hovered || pressed ? ui.hover : 'transparent' },
      ]}
    >
      <Text style={[styles.textButtonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** The one strong action on the page. Faint until there's something to save. */
export function SaveButton({
  label,
  ready,
  onPress,
}: {
  label: string;
  ready: boolean;
  onPress: () => void;
}) {
  const { uiTheme: ui } = useSettings();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.save,
        { backgroundColor: ui.ink, opacity: ready ? (pressed ? 0.85 : 1) : 0.35 },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.saveText, { color: ui.surface }]}>{label}</Text>
    </Pressable>
  );
}

/** Small squares, one per step; finished ones are filled. */
export function Progress({ done, total }: { done: number; total: number }) {
  const { uiTheme: ui } = useSettings();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${Math.min(done + 1, total)} of ${total}`}
      accessibilityValue={{ min: 0, max: total, now: done }}
      style={styles.progress}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.pip,
            i < done
              ? { backgroundColor: ui.accent, borderColor: ui.accent }
              : { borderColor: ui.hairline },
          ]}
        />
      ))}
    </View>
  );
}

/** Focuses a field once, after it has been revealed. */
export function useFocusOnReveal<T extends { focus: () => void }>(when: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!when) return;
    const t = setTimeout(() => ref.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [when]);
  return ref;
}

const styles = StyleSheet.create({
  folded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 2,
  },
  foldedLabel: { width: 64, fontSize: 10, fontWeight: '600', letterSpacing: 1.4 },
  foldedValue: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  foldedText: { fontSize: 15, flexShrink: 1 },
  foldedDetail: { fontSize: 12, flexShrink: 1 },
  change: { fontSize: 12 },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headingText: { fontSize: 10, fontWeight: '600', letterSpacing: 1.4 },
  aside: { fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
  pressed: { transform: [{ scale: 0.97 }] },
  textButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    justifyContent: 'center',
  },
  textButtonText: { fontSize: 13, fontWeight: '500' },
  save: {
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveText: { fontSize: 15, fontWeight: '500', letterSpacing: 0.2 },
  progress: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  pip: { width: 7, height: 7, borderWidth: 1 },
});
