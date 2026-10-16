import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';

import type { CalendarTheme } from '@/features/calendar/calendar-theme';
import type { DialTheme } from '@/features/clock/dial-theme';
import { CENTER, polar } from '@/features/clock/geometry';

type DialSwatchProps = {
  theme: DialTheme;
  label: string;
  selected: boolean;
  onPress: () => void;
  ui: CalendarTheme;
  size?: number;
};

/**
 * A dial in miniature, drawn from the dial's own theme: face, a few minute
 * ticks, the 12 o'clock index with its lume, and the hands at 10:10.
 */
export function DialSwatch({ theme, label, selected, onPress, ui, size = 46 }: DialSwatchProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      aria-checked={selected}
      onPress={onPress}
      style={styles.item}
    >
      {({ hovered, pressed }) => (
        <>
          <View
            style={[
              styles.ring,
              {
                width: size + 10,
                height: size + 10,
                borderRadius: (size + 10) / 2,
                borderColor: selected ? ui.ink : hovered || pressed ? ui.hairline : 'transparent',
              },
            ]}
          >
            <Svg width={size} height={size} viewBox="0 0 1000 1000">
              <Circle cx={CENTER} cy={CENTER} r={496} fill={theme.dialCenter} />
              <Circle
                cx={CENTER}
                cy={CENTER}
                r={490}
                fill="none"
                stroke={theme.dialRim}
                strokeWidth={10}
              />
              {[-12, -6, 6, 12, 18, 24, 36, 42, 48, 54].map((m) => {
                const a = polar(330, m * 6);
                const b = polar(400, m * 6);
                return (
                  <Line
                    key={m}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={theme.scale}
                    strokeWidth={22}
                    strokeLinecap="round"
                  />
                );
              })}
              {[0, 90, 180, 270].map((deg) => (
                <G key={deg} transform={`rotate(${deg} ${CENTER} ${CENTER})`}>
                  <Rect
                    x={CENTER - 22}
                    y={110}
                    width={44}
                    height={190}
                    rx={22}
                    fill={theme.lume}
                    stroke={theme.mode === 'night' ? theme.lume : theme.steelEdge}
                    strokeWidth={8}
                  />
                </G>
              ))}
              {/* Hands at 10:10 */}
              <Line
                x1={CENTER}
                y1={CENTER}
                x2={polar(250, 305).x}
                y2={polar(250, 305).y}
                stroke={theme.mode === 'night' ? theme.lume : theme.numeral}
                strokeWidth={34}
                strokeLinecap="round"
              />
              <Line
                x1={CENTER}
                y1={CENTER}
                x2={polar(380, 60).x}
                y2={polar(380, 60).y}
                stroke={theme.mode === 'night' ? theme.lume : theme.numeral}
                strokeWidth={26}
                strokeLinecap="round"
              />
              <Circle cx={CENTER} cy={CENTER} r={34} fill={theme.steelMid} />
            </Svg>
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              { color: selected ? ui.ink : ui.muted, fontWeight: selected ? '600' : '400' },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    width: 62,
  },
  ring: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 6,
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
