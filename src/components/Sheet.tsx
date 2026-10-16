import { X } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { QuietIconButton } from '@/components/QuietIconButton';
import { useSettings } from '@/features/settings/SettingsProvider';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Which corner control the panel opens from on wide screens. */
  anchor: 'bottom-left' | 'top-right';
  children: ReactNode;
};

const WIDE = 720;
const PANEL_WIDTH = 420;
const OPEN_MS = 240;
const CLOSE_MS = 170;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * The app's one modal surface. Wide screens: a floating panel beside the
 * control that opened it. Phones: a sheet from the bottom edge. Fades and
 * lifts in (instant with reduce motion); closes with ✕, Escape or a tap
 * outside, and traps focus while open (web).
 */
export function Sheet({ visible, onClose, title, anchor, children }: SheetProps) {
  const { mode, uiTheme: ui } = useSettings();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE;

  // Stay mounted through the closing animation.
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.set(reducedMotion ? 1 : withTiming(1, { duration: OPEN_MS, easing: EASE }));
    } else if (reducedMotion) {
      progress.set(0);
      setMounted(false);
    } else {
      progress.set(
        withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, reducedMotion, progress]);

  const fromTop = wide && anchor === 'top-right';
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * (wide ? (fromTop ? -12 : 12) : 40) }],
  }));

  if (!mounted) return null;

  const placement = !wide
    ? {
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: height * 0.88,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        paddingBottom: insets.bottom,
      }
    : anchor === 'bottom-left'
      ? {
          left: insets.left + 16,
          bottom: insets.bottom + 68,
          width: PANEL_WIDTH,
          maxHeight: height - insets.top - insets.bottom - 100,
          borderRadius: 22,
        }
      : {
          right: insets.right + 16,
          top: insets.top + 68,
          width: PANEL_WIDTH,
          maxHeight: height - insets.top - insets.bottom - 100,
          borderRadius: 22,
        };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: mode === 'night' ? 'rgba(0,0,0,0.45)' : 'rgba(10,30,34,0.10)' },
          scrimStyle,
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={`Close ${title.toLowerCase()}`}
          accessibilityRole="button"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          { backgroundColor: ui.surface, borderColor: ui.hairline },
          placement,
          panelStyle,
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: ui.ink }]} accessibilityRole="header">
            {title}
          </Text>
          <QuietIconButton
            icon={X}
            label={`Close ${title.toLowerCase()}`}
            onPress={onClose}
            restOpacity={0.6}
            touchRestOpacity={0.75}
          />
        </View>
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

/** A labelled group inside a Sheet: small tracked caps, optional value at right. */
export function SheetSection({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: string;
  children: ReactNode;
}) {
  const { uiTheme: ui } = useSettings();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: ui.muted }]} accessibilityRole="header">
          {label.toLocaleUpperCase()}
        </Text>
        {aside ? <Text style={[styles.aside, { color: ui.ink }]}>{aside}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** A labelled on/off row inside a Sheet. */
export function SheetSwitch({
  label,
  detail,
  value,
  onChange,
  first = false,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** Draws the top hairline (first row of a group). */
  first?: boolean;
}) {
  const { uiTheme: ui } = useSettings();
  return (
    <View
      style={[
        styles.switchRow,
        { borderColor: ui.hairline, borderTopWidth: first ? StyleSheet.hairlineWidth : 0 },
      ]}
    >
      <View style={styles.switchText}>
        <Text style={[styles.switchLabel, { color: ui.ink }]}>{label}</Text>
        {detail ? <Text style={[styles.switchDetail, { color: ui.muted }]}>{detail}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: ui.hairline, true: ui.accent }}
        thumbColor={ui.surface}
        {...({ activeThumbColor: ui.surface } as object)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 24,
    paddingRight: 12,
    paddingTop: 14,
    paddingBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 0.2,
  },
  body: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  section: {
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.6,
  },
  aside: {
    fontSize: 12,
  },
  switchRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchText: {
    flexShrink: 1,
  },
  switchLabel: {
    fontSize: 14,
  },
  switchDetail: {
    fontSize: 12,
    marginTop: 2,
  },
});
