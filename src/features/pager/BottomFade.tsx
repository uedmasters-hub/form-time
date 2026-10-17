import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type BottomFadeProps = {
  height: number;
  color: string;
  /** Unique per page when there's more than one fade. */
  id?: string;
};

/**
 * Content scrolling under the settings icon and page indicator dissolves
 * into the page instead of colliding with them. Purely visual; it never
 * takes touches.
 */
export function BottomFade({ height, color, id = 'ft-bottom-fade' }: BottomFadeProps) {
  return (
    <View pointerEvents="none" style={[styles.fade, { height }]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="0.55" stopColor={color} stopOpacity={0.92} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
