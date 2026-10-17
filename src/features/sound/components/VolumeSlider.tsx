import { useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { CalendarTheme } from '@/features/calendar/calendar-theme';

import { VOLUME_STEP } from '../sound-settings';

type VolumeSliderProps = {
  value: number;
  onChange: (value: number) => void;
  /** After a drag ends, or a key changes it: e.g. to play a sample. */
  onCommit?: (value: number) => void;
  disabled?: boolean;
  ui: CalendarTheme;
};

const THUMB = 18;
const RING = 30;
/** The whole row takes touches, not just the 2 pt line. */
const TARGET = 44;

const clamp = (v: number) => Math.min(1, Math.max(0, Math.round(v / VOLUME_STEP) * VOLUME_STEP));

/**
 * A quiet slider: a hairline track, the filled part in the accent colour,
 * and a plain round thumb. Drag or tap anywhere along it; arrow keys,
 * Page Up/Down, Home and End step it; screen readers adjust it as a slider.
 */
export function VolumeSlider({
  value,
  onChange,
  onCommit,
  disabled = false,
  ui,
}: VolumeSliderProps) {
  const [width, setWidth] = useState(0);
  const [focusVisible, setFocusVisible] = useState(false);
  const latest = useRef(value);
  const percent = Math.round(value * 100);

  const set = (next: number) => {
    const v = Number(clamp(next).toFixed(2));
    latest.current = v;
    if (v !== value) onChange(v);
    return v;
  };
  const fromTouch = (event: GestureResponderEvent) => {
    if (width > 0) set(event.nativeEvent.locationX / width);
  };

  const onKeyDown = (event: { key: string; preventDefault: () => void }) => {
    if (disabled) return;
    const keys: Record<string, number> = {
      ArrowRight: value + VOLUME_STEP,
      ArrowUp: value + VOLUME_STEP,
      ArrowLeft: value - VOLUME_STEP,
      ArrowDown: value - VOLUME_STEP,
      PageUp: value + 0.3,
      PageDown: value - 0.3,
      Home: 0,
      End: 1,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    setFocusVisible(true); // working it from the keyboard: show where focus is
    onCommit?.(set(keys[event.key]));
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const delta = event.nativeEvent.actionName === 'increment' ? VOLUME_STEP : -VOLUME_STEP;
    onCommit?.(set(value + delta));
  };

  const onFocus = (event: NativeSyntheticEvent<unknown>) => {
    const target = event.target as unknown as { matches?: (selector: string) => boolean };
    setFocusVisible(Platform.OS !== 'web' || Boolean(target?.matches?.(':focus-visible')));
  };

  return (
    <View
      role="slider"
      accessibilityRole="adjustable"
      accessibilityLabel="Volume"
      accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent}%` }}
      accessibilityState={{ disabled }}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%`}
      aria-disabled={disabled}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
      focusable={!disabled}
      onFocus={onFocus}
      onBlur={() => setFocusVisible(false)}
      {...({ onKeyDown } as object)}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={fromTouch}
      onResponderMove={fromTouch}
      onResponderRelease={() => onCommit?.(latest.current)}
      style={[styles.target, styles.noOutline, { opacity: disabled ? 0.35 : 1 }]}
    >
      <View pointerEvents="none" style={[styles.track, { backgroundColor: ui.hairline }]} />
      <View
        pointerEvents="none"
        style={[styles.fill, { backgroundColor: ui.accent, width: `${percent}%` }]}
      />
      {focusVisible ? (
        // Keyboard focus: a ring around the thumb, like the other controls.
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            { left: (width - THUMB) * value - (RING - THUMB) / 2, borderColor: ui.accent },
          ]}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          { left: (width - THUMB) * value, backgroundColor: ui.surface, borderColor: ui.ink },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  target: {
    height: TARGET,
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 2,
    borderRadius: 1,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 1.5,
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1.5,
  },
  /** The browser's own focus box; the ring above replaces it. */
  noOutline: { outlineWidth: 0 } as object,
});
