
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import SettingsButton from '@/components/SettingsButton';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

const C = {
  background: '#F5F5F3',
  face: '#FEFEFD',
  teal: '#518F95',
  ink: '#244F5A',
  marker: '#B6CECB',
  silver: '#D0DBD8',
  white: '#FFFFFF',
};

const CENTER = 500;

function polar(radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.sin(radians),
    y: CENTER - radius * Math.cos(radians),
  };
}

function taperedHandPath(length: number, baseWidth: number, tipWidth: number) {
  const tip = CENTER - length;
  return [
    `M ${CENTER - baseWidth / 2} ${CENTER + 12}`,
    `Q ${CENTER - baseWidth / 2} ${CENTER} ${CENTER - tipWidth / 2} ${tip + 18}`,
    `Q ${CENTER} ${tip} ${CENTER + tipWidth / 2} ${tip + 18}`,
    `Q ${CENTER + baseWidth / 2} ${CENTER} ${CENTER + baseWidth / 2} ${CENTER + 12}`,
    'Z',
  ].join(' ');
}

function Hand({
  angle,
  length,
  width,
  tipWidth,
}: {
  angle: number;
  length: number;
  width: number;
  tipWidth: number;
}) {
  const path = taperedHandPath(length, width, tipWidth);

  return (
    <G transform={`rotate(${angle} ${CENTER} ${CENTER})`}>
      <Path
        d={path}
        fill={C.ink}
        transform="translate(2 4)"
        opacity={0.15}
      />
      <Path d={path} fill={C.ink} />
      <Path
        d={`M ${CENTER - width * 0.22} ${CENTER - 7}
            L ${CENTER - tipWidth * 0.18} ${CENTER - length + 20}`}
        stroke="#E9F5F2"
        strokeWidth={Math.max(2, width * 0.13)}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
}

function ClockFace({ size }: { size: number }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = setInterval(update, 40);
    return () => clearInterval(interval);
  }, []);

  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  return (
    <Svg width={size} height={size} viewBox="0 0 1000 1000">
      <Defs>
        <LinearGradient id="bezel" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#EAF0ED" />
          <Stop offset="0.5" stopColor="#C7D3D0" />
          <Stop offset="1" stopColor="#F7FAF8" />
        </LinearGradient>

        <LinearGradient id="dial" x1="0" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#F8FBF9" />
        </LinearGradient>

        <LinearGradient id="capsule" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#D6E3DF" />
          <Stop offset="0.45" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#E2ECE8" />
        </LinearGradient>
      </Defs>

      {/* Fine double bezel */}
      <Circle cx={CENTER} cy={CENTER} r={486} fill="url(#bezel)" stroke="#C7D2CF" strokeWidth={2} />
      <Circle cx={CENTER} cy={CENTER} r={478} fill={C.face} stroke="#DCE5E1" strokeWidth={2} />
      <Circle cx={CENTER} cy={CENTER} r={472} fill="url(#dial)" />

      {/* Minute scale */}
      {Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0;
        const start = polar(major ? 345 : 365, i * 6);
        const end = polar(major ? 405 : 405, i * 6);

        return (
          <Line
            key={`tick-${i}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={C.teal}
            strokeWidth={major ? 4 : 2.8}
            strokeLinecap="round"
          />
        );
      })}
return (
  <View style={styles.screen}>
    <ClockFace size={size} />
    <SettingsButton />
  </View>
);
      {/* Raised hour capsules */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = i * 30;
        const p = polar(375, angle);

        return (
          <G
            key={`capsule-${i}`}
            transform={`translate(${p.x} ${p.y}) rotate(${angle})`}
          >
            <Line
              x1={0} y1={-30} x2={0} y2={30}
              stroke="#9FC8C5" strokeWidth={23}
              strokeLinecap="round" opacity={0.38}
            />
            <Line
              x1={0} y1={-30} x2={0} y2={30}
              stroke={C.marker} strokeWidth={20}
              strokeLinecap="round"
            />
            <Line
              x1={0} y1={-30} x2={0} y2={30}
              stroke="url(#capsule)" strokeWidth={15}
              strokeLinecap="round"
            />
            <Line
              x1={-1} y1={-23} x2={-1} y2={23}
              stroke="#FFFFFF" strokeWidth={3}
              strokeLinecap="round"
            />
          </G>
        );
      })}

      {/* Outer minute numbers */}
      {Array.from({ length: 12 }, (_, i) => {
        const value = i * 5;
        const p = polar(489, value * 6);
        const label = value === 0 ? '60' : String(value).padStart(2, '0');

        return (
          <SvgText
            key={`outer-${value}`}
            x={p.x}
            y={p.y + 10}
            fontSize={30}
            fontWeight="400"
            fill={C.teal}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        );
      })}

      {/* Inner hour numerals */}
      {Array.from({ length: 12 }, (_, i) => {
        const hour = i === 0 ? 12 : i;
        const p = polar(250, i * 30);

        return (
          <SvgText
            key={`hour-${hour}`}
            x={p.x}
            y={p.y + 18}
            fontSize={66}
            fontWeight="400"
            fill={C.ink}
            textAnchor="middle"
          >
            {hour}
          </SvgText>
        );
      })}

      {/* Hour and minute hands */}
      <Hand angle={hours * 30} length={205} width={22} tipWidth={13} />
      <Hand angle={minutes * 6} length={330} width={14} tipWidth={6} />

      {/* Seconds hand */}
      <G transform={`rotate(${seconds * 6} ${CENTER} ${CENTER})`}>
        <Line
          x1={CENTER}
          y1={CENTER + 38}
          x2={CENTER}
          y2={CENTER - 410}
          stroke={C.ink}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Circle cx={CENTER} cy={CENTER + 38} r={4} fill={C.ink} />
      </G>

      {/* Center pivot */}
      <Circle cx={CENTER + 2} cy={CENTER + 5} r={34} fill="#9CCBC7" opacity={0.3} />
      <Circle cx={CENTER} cy={CENTER} r={32} fill="url(#bezel)" stroke="#B7CFCA" strokeWidth={2} />
      <Circle cx={CENTER} cy={CENTER} r={23} fill="#FFFFFF" stroke="#D8E4E0" strokeWidth={2} />
      <Circle cx={CENTER} cy={CENTER} r={7} fill={C.ink} />
    </Svg>
  );
}

export default function ClockScreen() {
  const { width, height } = useWindowDimensions();
  const size = Math.max(240, Math.min(width - 24, height - 24, 1000));

  return (
    <View style={styles.screen}>
      <ClockFace size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.background,
    overflow: 'hidden',
  },
});
