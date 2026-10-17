import { Clock3, Moon, RectangleEllipsis, RotateCcw, Sun, SunMoon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet, SheetSection as Section, SheetSwitch } from '@/components/Sheet';
import {
  DIALS,
  LUMES,
  dayDialTheme,
  lumeSpec,
  nightDialTheme,
} from '@/features/clock/dial-palettes';
import { useAccount } from '@/features/account/AccountProvider';
import { AccountSection } from '@/features/account/components/AccountSection';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

import { APPEARANCES, FACES, MOVEMENTS, SIZES, WEEK_STARTS } from '../settings';
import { useSettings } from '../SettingsProvider';
import { DialSwatch } from './DialSwatch';
import { OptionGroup } from './OptionGroup';

type SettingsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

const APPEARANCE_ICONS = { day: Sun, night: Moon, system: SunMoon } as const;
const FACE_ICONS = { analog: Clock3, digital: RectangleEllipsis } as const;

/**
 * Clock and calendar settings. Every change applies immediately — the clock
 * stays visible behind the panel as a live preview — and is remembered.
 *
 * Wide screens: a floating panel above the settings icon. Phones: a sheet
 * from the bottom edge. Closes with ✕, Escape, or a tap outside.
 */
export function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const { settings, update, reset, uiTheme: ui } = useSettings();
  const { openSheet } = useAccount();
  const reducedMotion = useReducedMotion();

  const showDials = settings.appearance !== 'night';
  const showLumes = settings.appearance !== 'day';
  const lumeName = lumeSpec(settings.lume).name;

  return (
    <Sheet visible={visible} onClose={onClose} title="Settings" anchor="bottom-left">
      <AccountSection
        onOpen={(sheet) => {
          onClose();
          openSheet(sheet);
        }}
      />

      <Section label="Appearance">
        <OptionGroup
          label="Appearance"
          options={APPEARANCES.map((a) => ({ ...a, icon: APPEARANCE_ICONS[a.id] }))}
          value={settings.appearance}
          onChange={(appearance) => update({ appearance })}
          theme={ui}
        />
      </Section>

      <View style={styles.switchGap}>
        <SheetSwitch
          label="Shadows & glow"
          detail={
            settings.depth
              ? 'Soft shadows, glow and depth'
              : 'Flat — solid colours and plain shapes'
          }
          value={settings.depth}
          onChange={(depth) => update({ depth })}
          first
        />
      </View>

      <Section label="Face">
        <OptionGroup
          label="Clock face"
          options={FACES.map((f) => ({ ...f, icon: FACE_ICONS[f.id] }))}
          value={settings.face}
          onChange={(face) => update({ face })}
          theme={ui}
        />
      </Section>

      {showDials ? (
        <Section label={settings.appearance === 'system' ? 'Dial · day' : 'Dial'}>
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

      {/* Movement drives the second hand; the digital face has none. */}
      {settings.face === 'analog' ? (
        <>
          <Section label="Movement">
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
        </>
      ) : null}

      <Section label="Size">
        <OptionGroup
          label="Clock size"
          options={SIZES}
          value={settings.size}
          onChange={(size) => update({ size })}
          theme={ui}
        />
      </Section>

      <View style={styles.switchGap}>
        <SheetSwitch
          label={settings.face === 'digital' ? 'Seconds' : 'Second hand'}
          value={settings.secondHand}
          onChange={(secondHand) => update({ secondHand })}
          first
        />
      </View>

      {/* The side panel on the clock and the calendar: each half on its own. */}
      <Section label="Side panel">
        <SheetSwitch
          label="Day & date"
          detail="Today, or the selected day, at the top"
          value={settings.showDayDate}
          onChange={(showDayDate) => update({ showDayDate })}
          first
        />
        <SheetSwitch
          label="Events & festivals"
          detail="What's on that day, and its holidays and festivals"
          value={settings.showDayEvents}
          onChange={(showDayEvents) => update({ showDayEvents })}
        />
      </Section>

      <Section label="Calendar · week starts on">
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
        style={({ hovered, pressed }) => [styles.reset, { opacity: hovered || pressed ? 1 : 0.7 }]}
      >
        <RotateCcw size={14} color={ui.muted} strokeWidth={1.5} />
        <Text style={[styles.resetText, { color: ui.muted }]}>Reset to defaults</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  switchGap: {
    marginTop: 18,
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
