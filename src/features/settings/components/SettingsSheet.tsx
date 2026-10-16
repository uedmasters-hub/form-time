import { Moon, RefreshCw, RotateCcw, Sun, SunMoon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet, SheetSection as Section, SheetSwitch } from '@/components/Sheet';
import {
  DIALS,
  LUMES,
  dayDialTheme,
  lumeSpec,
  nightDialTheme,
} from '@/features/clock/dial-palettes';
import { useEvents, type SyncStatus } from '@/features/events/EventsProvider';
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

/**
 * Clock and calendar settings. Every change applies immediately — the clock
 * stays visible behind the panel as a live preview — and is remembered.
 *
 * Wide screens: a floating panel above the settings icon. Phones: a sheet
 * from the bottom edge. Closes with ✕, Escape, or a tap outside.
 */
export function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const { settings, update, reset, uiTheme: ui } = useSettings();
  const { items, status, syncNow } = useEvents();
  const canSync = status.state !== 'device-only' && status.state !== 'syncing';
  const reducedMotion = useReducedMotion();

  const showDials = settings.appearance !== 'night';
  const showLumes = settings.appearance !== 'day';
  const lumeName = lumeSpec(settings.lume).name;

  return (
    <Sheet visible={visible} onClose={onClose} title="Settings" anchor="bottom-left">
      <Section label="Appearance">
        <OptionGroup
          label="Appearance"
          options={APPEARANCES.map((a) => ({ ...a, icon: APPEARANCE_ICONS[a.id] }))}
          value={settings.appearance}
          onChange={(appearance) => update({ appearance })}
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
          label="Second hand"
          value={settings.secondHand}
          onChange={(secondHand) => update({ secondHand })}
          first
        />
      </View>

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

      <Section
        label="Your items"
        aside={`${items.length} ${items.length === 1 ? 'item' : 'items'}`}
      >
        <View style={styles.syncRow}>
          <Text
            style={[styles.syncText, { color: status.state === 'problem' ? ui.ink : ui.muted }]}
            aria-live="polite"
          >
            {describeSync(status)}
          </Text>
          {canSync ? (
            <Pressable
              accessibilityRole="button"
              onPress={syncNow}
              style={({ hovered, pressed }) => [
                styles.syncButton,
                {
                  borderColor: ui.hairline,
                  backgroundColor: hovered || pressed ? ui.hover : 'transparent',
                },
              ]}
            >
              <RefreshCw size={13} color={ui.ink} strokeWidth={1.75} />
              <Text style={[styles.syncButtonText, { color: ui.ink }]}>Sync now</Text>
            </Pressable>
          ) : null}
        </View>
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

function describeSync(status: SyncStatus): string {
  switch (status.state) {
    case 'idle':
      return 'Saved on this device';
    case 'syncing':
      return 'Syncing…';
    case 'synced':
      return `Synced at ${new Date(status.at).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })}`;
    case 'device-only':
      return status.reason;
    case 'problem':
      return status.unsent > 0 ? `${status.message} (${status.unsent} waiting)` : status.message;
  }
}

const styles = StyleSheet.create({
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  syncButtonText: {
    fontSize: 13,
  },
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
