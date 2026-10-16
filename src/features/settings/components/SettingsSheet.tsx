import { Moon, RotateCcw, Sun, SunMoon, X } from 'lucide-react-native';
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
import type { CalendarTheme } from '@/features/calendar/calendar-theme';
import {
  DIALS,
  LUMES,
  dayDialTheme,
  lumeSpec,
  nightDialTheme,
} from '@/features/clock/dial-palettes';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

import { APPEARANCES, MOVEMENTS, SIZES, WEEK_STARTS } from '../settings';
import { useSettings } from '../SettingsProvider';
import { DialSwatch } from './DialSwatch';
import { OptionGroup } from './OptionGroup';

type SettingsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

const APPEARANCE_ICONS = { day: Sun, night: Moon, system: SunMoon } as const;
const WIDE = 720;
const PANEL_WIDTH = 420;
const OPEN_MS = 240;
const CLOSE_MS = 170;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * Clock and calendar settings. Every change applies immediately — the clock
 * stays visible behind the panel as a live preview — and is remembered.
 *
 * Wide screens: a floating panel above the settings icon. Phones: a sheet
 * from the bottom edge. Closes with ✕, Escape, or a tap outside.
 */
export function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const { settings, update, reset, mode, uiTheme: ui } = useSettings();
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

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * (wide ? 12 : 40) }],
  }));

  if (!mounted) return null;

  const showDials = settings.appearance !== 'night';
  const showLumes = settings.appearance !== 'day';
  const lumeName = lumeSpec(settings.lume).name;

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
          accessibilityLabel="Close settings"
          accessibilityRole="button"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: ui.surface,
            borderColor: ui.hairline,
          },
          wide
            ? {
                left: insets.left + 16,
                bottom: insets.bottom + 68,
                width: PANEL_WIDTH,
                maxHeight: height - insets.top - insets.bottom - 100,
                borderRadius: 22,
              }
            : {
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: height * 0.88,
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                paddingBottom: insets.bottom,
              },
          panelStyle,
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: ui.ink }]}>Settings</Text>
          <QuietIconButton
            icon={X}
            label="Close settings"
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
          <Section label="Appearance" ui={ui}>
            <OptionGroup
              label="Appearance"
              options={APPEARANCES.map((a) => ({ ...a, icon: APPEARANCE_ICONS[a.id] }))}
              value={settings.appearance}
              onChange={(appearance) => update({ appearance })}
              theme={ui}
            />
          </Section>

          {showDials ? (
            <Section label={settings.appearance === 'system' ? 'Dial · day' : 'Dial'} ui={ui}>
              <View role="radiogroup" accessibilityLabel="Dial" style={styles.swatches}>
                {DIALS.map((d) => (
                  <DialSwatch
                    key={d.id}
                    theme={dayDialTheme(d.id)}
                    label={d.name}
                    selected={settings.dial === d.id}
                    onPress={() => update({ dial: d.id })}
                    ui={ui}
                  />
                ))}
              </View>
            </Section>
          ) : null}

          {showLumes ? (
            <Section
              label={settings.appearance === 'system' ? 'Lume · night' : 'Lume'}
              aside={lumeName}
              ui={ui}
            >
              <View role="radiogroup" accessibilityLabel="Lume colour" style={styles.lumes}>
                {LUMES.map((l) => {
                  const selected = settings.lume === l.id;
                  return (
                    <Pressable
                      key={l.id}
                      accessibilityRole="radio"
                      accessibilityLabel={l.name}
                      aria-checked={selected}
                      onPress={() => update({ lume: l.id })}
                      style={({ hovered }) => [
                        styles.lumeRing,
                        { borderColor: selected ? ui.ink : hovered ? ui.hairline : 'transparent' },
                      ]}
                    >
                      <View
                        style={[
                          styles.lumeDot,
                          {
                            backgroundColor: l.color,
                            borderColor: nightDialTheme(l.id).dialRim,
                          },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </Section>
          ) : null}

          <Section label="Movement" ui={ui}>
            <OptionGroup
              label="Movement"
              options={MOVEMENTS}
              value={settings.movement}
              onChange={(movement) => update({ movement })}
              theme={ui}
            />
            {reducedMotion ? (
              <Text style={[styles.note, { color: ui.muted }]}>
                Reduce motion is on, so the second hand steps once a second.
              </Text>
            ) : null}
          </Section>

          <Section label="Size" ui={ui}>
            <OptionGroup
              label="Clock size"
              options={SIZES}
              value={settings.size}
              onChange={(size) => update({ size })}
              theme={ui}
            />
          </Section>

          <View style={[styles.switchRow, { borderColor: ui.hairline }]}>
            <Text style={[styles.switchLabel, { color: ui.ink }]}>Second hand</Text>
            <Switch
              accessibilityLabel="Second hand"
              value={settings.secondHand}
              onValueChange={(secondHand) => update({ secondHand })}
              trackColor={{ false: ui.hairline, true: ui.accent }}
              thumbColor={ui.surface}
              {...({ activeThumbColor: ui.surface } as object)}
            />
          </View>

          <Section label="Calendar · week starts on" ui={ui}>
            <OptionGroup
              label="Week starts on"
              options={WEEK_STARTS}
              value={settings.weekStart}
              onChange={(weekStart) => update({ weekStart })}
              theme={ui}
              dense
            />
          </Section>

          <Pressable
            accessibilityRole="button"
            onPress={reset}
            style={({ hovered, pressed }) => [
              styles.reset,
              { opacity: hovered || pressed ? 1 : 0.7 },
            ]}
          >
            <RotateCcw size={14} color={ui.muted} strokeWidth={1.5} />
            <Text style={[styles.resetText, { color: ui.muted }]}>Reset to defaults</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function Section({
  label,
  aside,
  ui,
  children,
}: {
  label: string;
  aside?: string;
  ui: CalendarTheme;
  children: ReactNode;
}) {
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
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
    marginHorizontal: -4,
  },
  lumes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  lumeRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lumeDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
  },
  note: {
    fontSize: 12,
    marginTop: 8,
  },
  switchRow: {
    marginTop: 18,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 14,
  },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 22,
    paddingVertical: 8,
  },
  resetText: {
    fontSize: 13,
  },
});
