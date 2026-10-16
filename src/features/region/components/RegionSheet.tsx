import { ExternalLink } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet, SheetSection, SheetSwitch } from '@/components/Sheet';
import { holidaySources, KIND_PLURALS, REGION_KINDS } from '@/features/holidays/holidays';
import type { HolidayKind } from '@/features/holidays/types';
import { OptionGroup } from '@/features/settings/components/OptionGroup';
import { NEPAL_CALENDARS, type Settings } from '@/features/settings/settings';
import { useSettings } from '@/features/settings/SettingsProvider';

import { REGIONS, areaOf, type RegionCode } from '../regions';
import { formatOffset } from '../zoned-time';

type RegionSheetProps = {
  visible: boolean;
  onClose: () => void;
};

const KIND_SETTING: Record<HolidayKind, keyof Settings> = {
  public: 'showPublicHolidays',
  restricted: 'showRestrictedHolidays',
  festival: 'showFestivals',
};

const KIND_DETAIL: Record<RegionCode, Partial<Record<HolidayKind, string>>> = {
  IN: {
    public: 'Central government offices closed',
    restricted: 'Optional — central government employees may take two',
    festival: 'Navaratri and other multi-day festivals',
  },
  NP: {
    public: 'For everyone — Dashain, Tihar and more',
    restricted: 'For specific communities, groups or districts',
    festival: 'Dashain, Tihar, jatras and other festivals',
  },
  US: { public: 'Observed by federal offices' },
  AU: { public: 'For the selected state or territory' },
};

/** Re-renders once a minute so the times shown stay current. */
function useMinute(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    setNow(new Date());
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setNow(new Date());
          schedule();
        },
        60_000 - (Date.now() % 60_000) + 50,
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [active]);
  return now;
}

const timeFormats = new Map<string, Intl.DateTimeFormat>();
function timeIn(timeZone: string, date: Date) {
  let f = timeFormats.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone });
    timeFormats.set(timeZone, f);
  }
  return f.format(date);
}

/**
 * Region: which country's time the clock shows and whose holidays the
 * calendar marks. Same surface as Settings, opening from the top-right code.
 */
export function RegionSheet({ visible, onClose }: RegionSheetProps) {
  const { settings, update, uiTheme: ui } = useSettings();
  const now = useMinute(visible);
  const region = REGIONS.find((r) => r.code === settings.region) ?? REGIONS[0];

  return (
    <Sheet visible={visible} onClose={onClose} title="Region" anchor="top-right">
      <SheetSection label="Country">
        <View role="radiogroup" accessibilityLabel="Country" style={styles.list}>
          {REGIONS.map((r) => {
            const selected = r.code === settings.region;
            const zone = selected ? areaOf(r.code, settings.area).timeZone : r.areas[0].timeZone;
            const time = timeIn(zone, now);
            return (
              <Pressable
                key={r.code}
                accessibilityRole="radio"
                accessibilityLabel={`${r.name}, ${time}`}
                aria-checked={selected}
                onPress={() => update({ region: r.code, area: areaOf(r.code, undefined).id })}
                style={({ hovered, pressed }) => [
                  styles.row,
                  {
                    borderColor: selected ? ui.ink : ui.hairline,
                    borderWidth: selected ? 1.5 : 1,
                    backgroundColor: hovered || pressed ? ui.hover : 'transparent',
                  },
                ]}
              >
                <View
                  style={[
                    styles.code,
                    {
                      backgroundColor: selected ? ui.lume : 'transparent',
                      borderColor: ui.hairline,
                    },
                  ]}
                >
                  <Text style={[styles.codeText, { color: selected ? ui.onLume : ui.ink }]}>
                    {r.code}
                  </Text>
                </View>
                <Text
                  style={[styles.name, { color: ui.ink, fontWeight: selected ? '600' : '400' }]}
                >
                  {r.name}
                </Text>
                <View style={styles.timeCol}>
                  <Text style={[styles.time, { color: ui.ink }]}>{time}</Text>
                  {r.areas.length === 1 ? (
                    <Text style={[styles.offset, { color: ui.muted }]}>
                      {formatOffset(zone, now)}
                    </Text>
                  ) : (
                    <Text style={[styles.offset, { color: ui.muted }]}>
                      {r.areas.length} time zones
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </SheetSection>

      {region.code === 'NP' ? (
        <SheetSection label="Calendar">
          <OptionGroup
            label="Calendar"
            options={NEPAL_CALENDARS}
            value={settings.nepalCalendar}
            onChange={(nepalCalendar) => update({ nepalCalendar })}
            theme={ui}
          />
        </SheetSection>
      ) : null}

      {region.areas.length > 1 ? (
        <SheetSection
          label={region.code === 'AU' ? 'State or territory' : 'Time zone'}
          aside={formatOffset(areaOf(region.code, settings.area).timeZone, now)}
        >
          <View
            role="radiogroup"
            accessibilityLabel={region.code === 'AU' ? 'State or territory' : 'Time zone'}
            style={styles.chips}
          >
            {region.areas.map((a) => {
              const selected = a.id === settings.area;
              return (
                <Pressable
                  key={a.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${a.label}, ${timeIn(a.timeZone, now)}`}
                  aria-checked={selected}
                  onPress={() => update({ area: a.id })}
                  style={({ hovered, pressed }) => [
                    styles.chip,
                    {
                      borderColor: selected ? ui.ink : ui.hairline,
                      borderWidth: selected ? 1.5 : 1,
                      backgroundColor: hovered || pressed ? ui.hover : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: selected ? ui.ink : ui.muted, fontWeight: selected ? '600' : '400' },
                    ]}
                  >
                    {a.label}
                  </Text>
                  <Text style={[styles.chipTime, { color: ui.muted }]}>
                    {timeIn(a.timeZone, now)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SheetSection>
      ) : null}

      <SheetSection label="On the calendar">
        {REGION_KINDS[region.code].map((kind, i) => (
          <SheetSwitch
            key={kind}
            label={KIND_PLURALS[region.code][kind]}
            detail={KIND_DETAIL[region.code][kind]}
            value={settings[KIND_SETTING[kind]] as boolean}
            onChange={(value) => update({ [KIND_SETTING[kind]]: value } as Partial<Settings>)}
            first={i === 0}
          />
        ))}
      </SheetSection>

      <SheetSection label="Sources">
        {holidaySources(region.code).map((source) => (
          <Pressable
            key={source.url}
            accessibilityRole="link"
            accessibilityHint="Opens in your browser"
            onPress={() => Linking.openURL(source.url)}
            style={({ hovered }) => [styles.source, { opacity: hovered ? 1 : 0.85 }]}
          >
            <View style={styles.sourceText}>
              <Text style={[styles.sourceLabel, { color: ui.ink }]}>{source.label}</Text>
              <Text style={[styles.sourceCovers, { color: ui.muted }]}>{source.covers}</Text>
            </View>
            <ExternalLink size={14} color={ui.muted} strokeWidth={1.5} />
          </Pressable>
        ))}
        <Text style={[styles.disclaimer, { color: ui.muted }]}>
          Lunar and moon-sighted dates can shift; local and state calendars may differ.
        </Text>
      </SheetSection>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  code: {
    width: 40,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  name: {
    flex: 1,
    fontSize: 14,
  },
  timeCol: {
    alignItems: 'flex-end',
  },
  time: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  offset: {
    fontSize: 11,
    marginTop: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  chipLabel: {
    fontSize: 13,
  },
  chipTime: {
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  sourceText: {
    flex: 1,
  },
  sourceLabel: {
    fontSize: 13,
  },
  sourceCovers: {
    fontSize: 11,
    marginTop: 2,
  },
  disclaimer: {
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16,
  },
});
