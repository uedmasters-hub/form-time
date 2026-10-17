import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { isSameDay, type CalendarDate } from '@/features/calendar/calendar-date';
import type { CalendarTheme } from '@/features/calendar/calendar-theme';
import type { DialTheme } from '@/features/clock/dial-theme';
import { useSwipeAwarePress } from '@/features/pager/pager-context';

import { useComposer } from '../ComposerProvider';
import { useEvents } from '../EventsProvider';
import {
  dialAngle,
  formatWallTime,
  hourAngle,
  instantToWall,
  nextSlot,
  placeIn,
  timeFromDial,
  type WallTime,
} from '../item-time';

/** The part of the dial that reads as a time: outside the hub, inside the rim. */
const HUB = 0.09;
const FACE = 0.49;
/** Item marks sit just outside the minute ticks (in 1000-unit dial space). */
const MARK_RADIUS = 0.425;
/** Show items coming up within this many hours (the dial shows twelve). */
const MARK_WINDOW_H = 12;

type ClockTimePickerProps = {
  size: number;
  dialTheme: DialTheme;
  ui: CalendarTheme;
  timeZone: string;
  children: ReactNode;
};

type PressInfo = { x: number; y: number; precise: boolean; touch: boolean; at: number };

/** A pointer-down older than this belongs to some other gesture (a swipe). */
const STALE_PRESS_MS = 1500;

type Hover = { angle: number; x: number; y: number; date: CalendarDate; time: WallTime };

/**
 * Makes the clock a time picker. Point at the dial and the time the hour
 * hand would show there appears; click or tap to add something at that
 * time — the next time the hands get there. Mouse picks to the minute,
 * a fingertip to five minutes, Alt/Option-click to the second. Enter (when
 * the clock has focus) starts at the next five minutes.
 *
 * Upcoming items in the next twelve hours show as small marks by the
 * minute track.
 */
export function ClockTimePicker({ size, dialTheme, ui, timeZone, children }: ClockTimePickerProps) {
  const { compose } = useComposer();
  const { items } = useEvents();
  const ref = useRef<View>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const pressInfo = useRef<PressInfo | null>(null);

  const local = (e: { nativeEvent: unknown }) => {
    const n = e.nativeEvent as {
      clientX?: number;
      clientY?: number;
      pageX?: number;
      pageY?: number;
      locationX?: number;
      locationY?: number;
    };
    if (Platform.OS === 'web') {
      const node = ref.current as unknown as HTMLElement | null;
      const rect = node?.getBoundingClientRect?.();
      const cx = n.clientX ?? (n.pageX ?? 0) - window.scrollX;
      const cy = n.clientY ?? (n.pageY ?? 0) - window.scrollY;
      if (rect) return { x: cx - rect.left, y: cy - rect.top };
    }
    return { x: n.locationX ?? 0, y: n.locationY ?? 0 };
  };

  const onDial = (x: number, y: number) => {
    const r = Math.hypot(x - size / 2, y - size / 2) / size;
    return r >= HUB && r <= FACE;
  };

  const pick = (x: number, y: number, step: number) => {
    const angle = dialAngle(x, y, size / 2, size / 2);
    return { angle, ...timeFromDial(angle, Date.now(), timeZone, step) };
  };

  const openAt = (info: PressInfo) => {
    if (!onDial(info.x, info.y)) return;
    const step = info.precise ? 0 : info.touch ? 5 : 1;
    const { date, time } = pick(info.x, info.y, step);
    setHover(null);
    compose({ mode: 'new', date, time, seconds: info.precise });
  };

  const open = useSwipeAwarePress(() => {
    const info = pressInfo.current;
    pressInfo.current = null;
    if (info && Date.now() - info.at < STALE_PRESS_MS) return openAt(info);
    // Keyboard: the next five-minute mark.
    const { date, time } = nextSlot(Date.now(), timeZone);
    compose({ mode: 'new', date, time });
  });

  // Native: where the finger landed. (Web reads DOM pointer events below,
  // because react-native-web's press events carry no pointer type or Alt.)
  const onPressIn = (e: GestureResponderEvent) => {
    if (Platform.OS === 'web') return;
    pressInfo.current = {
      x: e.nativeEvent.locationX,
      y: e.nativeEvent.locationY,
      precise: false,
      touch: true,
      at: Date.now(),
    };
  };

  // Web: pointer type and Alt from the pointer event; Alt-clicks handled
  // here, since react-native-web drops them before onPress.
  const openAtRef = useRef(openAt);
  useEffect(() => {
    openAtRef.current = openAt;
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = ref.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const at = (e: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      pressInfo.current = {
        ...at(e),
        precise: e.altKey,
        touch: e.pointerType === 'touch',
        at: Date.now(),
      };
    };
    const onAltClick = (e: MouseEvent) => {
      if (!e.altKey) return;
      e.preventDefault();
      pressInfo.current = null;
      openAtRef.current({ ...at(e), precise: true, touch: false, at: Date.now() });
    };
    node.addEventListener('pointerdown', onDown);
    node.addEventListener('click', onAltClick);
    return () => {
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('click', onAltClick);
    };
  }, []);

  const onPointerMove = (e: { nativeEvent: unknown }) => {
    const n = e.nativeEvent as { pointerType?: string; altKey?: boolean };
    if (n.pointerType && n.pointerType !== 'mouse' && n.pointerType !== 'pen') return;
    const { x, y } = local(e);
    if (!onDial(x, y)) {
      setHover(null);
      return;
    }
    const p = pick(x, y, n.altKey ? 0 : 1);
    setHover({ angle: p.angle, x, y, date: p.date, time: p.time });
  };

  // Upcoming items → angles on the dial.
  const marks = useMemo(() => {
    const now = Date.now();
    const until = now + MARK_WINDOW_H * 3600_000;
    return items
      .filter(
        (item) =>
          item.startsAt && Date.parse(item.startsAt) > now && Date.parse(item.startsAt) <= until,
      )
      .map((item) => {
        const placed = placeIn(item, timeZone);
        return {
          id: item.id,
          angle: placed.time ? hourAngle(placed.time) : 0,
          alarm: item.kind === 'alarm',
        };
      });
    // Recomputed when items change; the clock re-renders the hands, not this.
  }, [items, timeZone]);

  const today = instantToWall(Date.now(), timeZone).date;
  const c = size / 2;
  const point = (angle: number, radius: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: c + Math.sin(rad) * radius * size, y: c - Math.cos(rad) * radius * size };
  };

  return (
    <Pressable
      ref={ref}
      onPressIn={onPressIn}
      onPress={open}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHover(null)}
      accessibilityRole="button"
      accessibilityLabel="Add something at a time"
      accessibilityHint="Point at the dial to choose a time, or press Enter to start at the next five minutes"
      style={[
        { width: size, height: size },
        Platform.OS === 'web' && hover ? styles.crosshair : null,
      ]}
    >
      {children}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={size} height={size}>
          {marks.map((m) => {
            const p = point(m.angle, MARK_RADIUS);
            return (
              <Circle
                key={m.id}
                cx={p.x}
                cy={p.y}
                r={Math.max(2.5, size * (m.alarm ? 0.0085 : 0.007))}
                fill={dialTheme.mode === 'night' ? dialTheme.lume : ui.accent}
                opacity={0.9}
              />
            );
          })}
          {hover ? (
            <>
              <Line
                x1={point(hover.angle, HUB).x}
                y1={point(hover.angle, HUB).y}
                x2={point(hover.angle, MARK_RADIUS).x}
                y2={point(hover.angle, MARK_RADIUS).y}
                stroke={ui.accent}
                strokeWidth={Math.max(1, size * 0.002)}
                opacity={0.45}
              />
              <Circle
                cx={point(hover.angle, MARK_RADIUS).x}
                cy={point(hover.angle, MARK_RADIUS).y}
                r={Math.max(3, size * 0.007)}
                fill="none"
                stroke={ui.accent}
                strokeWidth={1.5}
              />
            </>
          ) : null}
        </Svg>
        {hover ? (
          <View
            style={[
              styles.label,
              {
                left: Math.min(size - 120, hover.x + 14),
                top: Math.max(0, hover.y - 34),
                backgroundColor: ui.surface,
                borderColor: ui.hairline,
              },
            ]}
          >
            <Text style={[styles.labelText, { color: ui.ink }]}>
              {formatWallTime(hover.time, hover.time.seconds !== 0)}
              {isSameDay(hover.date, today) ? '' : ' · tomorrow'}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  crosshair: { cursor: 'pointer' } as object,
  label: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  labelText: { fontSize: 13, fontVariant: ['tabular-nums'] },
});
