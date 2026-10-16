import { ExternalLink, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Sheet, SheetSection, SheetSwitch } from '@/components/Sheet';
import { holidaySources, kindPlurals, REGION_KINDS } from '@/features/holidays/holidays';
import { indiaListStatus } from '@/features/holidays/india';
import type { HolidayKind } from '@/features/holidays/types';
import { OptionGroup } from '@/features/settings/components/OptionGroup';
import { NEPAL_CALENDARS, type Settings } from '@/features/settings/settings';
import { useSettings } from '@/features/settings/SettingsProvider';

import { REGIONS, areaOf, timeZonesOf, type Area, type RegionCode } from '../regions';
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

/** Switch details for India once a state is chosen. */
function indiaStateDetail(area: Area): Partial<Record<HolidayKind, string>> {
  const status = indiaListStatus(area.id);
  return {
    public:
      status === 'missing' ? 'National holidays' : `National holidays and ${area.label}'s own list`,
    restricted: 'Optional, partial, local or bank-only — each says which',
    festival: 'Navaratri and the central calendar’s festival dates',
  };
}

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
  const area = areaOf(region.code, settings.area);
  const indianState = region.code === 'IN' && area.group !== undefined;
  const kindDetail = indianState ? indiaStateDetail(area) : KIND_DETAIL[region.code];
  const plurals = kindPlurals(region.code, area.id);
  const [query, setQuery] = useState('');

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
                onPress={() =>
                  // Choosing the current country again keeps its state or zone.
                  r.code !== settings.region &&
                  update({ region: r.code, area: areaOf(r.code, undefined).id })
                }
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
                  {timeZonesOf(r).length === 1 ? (
                    <Text style={[styles.offset, { color: ui.muted }]}>
                      {formatOffset(zone, now)}
                    </Text>
                  ) : (
                    <Text style={[styles.offset, { color: ui.muted }]}>
                      {timeZonesOf(r).length} time zones
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

      {region.code === 'IN' ? (
        <SheetSection label="State or union territory" aside={area.id}>
          <IndiaAreaPicker
            areas={region.areas}
            selected={area.id}
            query={query}
            onQuery={setQuery}
            onSelect={(id) => update({ area: id })}
          />
        </SheetSection>
      ) : region.areas.length > 1 ? (
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
            label={plurals[kind]}
            detail={kindDetail[kind]}
            value={settings[KIND_SETTING[kind]] as boolean}
            onChange={(value) => update({ [KIND_SETTING[kind]]: value } as Partial<Settings>)}
            first={i === 0}
          />
        ))}
      </SheetSection>

      <SheetSection label="Sources">
        {indianState && indiaListStatus(area.id) === 'missing' ? (
          <Text style={[styles.status, { color: ui.ink }]}>
            {area.label}&apos;s own 2026 list isn&apos;t included yet — no copy of its notification
            could be checked. The calendar shows the national holidays and the central
            calendar&apos;s festivals.
          </Text>
        ) : null}
        {indianState && indiaListStatus(area.id) === 'follows-central' ? (
          <Text style={[styles.status, { color: ui.ink }]}>
            {area.label} follows the central government&apos;s list of holidays.
          </Text>
        ) : null}
        {holidaySources(region.code, area.id).map((source) => (
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
          Lunar and moon-sighted dates can shift; local and district holidays may differ.
          {region.code === 'IN' && indianState
            ? ' State lists cover 2026; later years show national holidays and the central calendar until states publish theirs.'
            : ''}
        </Text>
      </SheetSection>
    </Sheet>
  );
}

type IndiaAreaPickerProps = {
  areas: readonly Area[];
  selected: string;
  query: string;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
};

/**
 * All India, then the states and the union territories, each a chip with
 * its ISO code. A filter narrows the 37 choices by name or code.
 */
function IndiaAreaPicker({ areas, selected, query, onQuery, onSelect }: IndiaAreaPickerProps) {
  const { uiTheme: ui } = useSettings();
  const q = query.trim().toLowerCase();
  const matches = (a: Area) =>
    !q ||
    a.label.toLowerCase().includes(q) ||
    a.id.toLowerCase().includes(q) ||
    a.short.toLowerCase() === q;
  const groups: { title: string | null; items: Area[] }[] = [
    { title: null, items: areas.filter((a) => !a.group && matches(a)) },
    { title: 'STATES', items: areas.filter((a) => a.group === 'state' && matches(a)) },
    {
      title: 'UNION TERRITORIES',
      items: areas.filter((a) => a.group === 'union-territory' && matches(a)),
    },
  ];
  const none = groups.every((g) => g.items.length === 0);

  return (
    <View>
      <View style={[styles.search, { borderColor: ui.hairline }]}>
        <Search size={16} color={ui.muted} strokeWidth={1.5} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="Find a state or code (e.g. HR)"
          placeholderTextColor={ui.muted}
          accessibilityLabel="Find a state or union territory"
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.searchInput, { color: ui.ink }]}
        />
      </View>
      {none ? (
        <Text style={[styles.empty, { color: ui.muted }]}>
          No state or union territory matches.
        </Text>
      ) : null}
      {groups.map((group) =>
        group.items.length ? (
          <View key={group.title ?? 'all'}>
            {group.title ? (
              <Text style={[styles.groupLabel, { color: ui.muted }]}>{group.title}</Text>
            ) : null}
            <View
              role="radiogroup"
              accessibilityLabel={group.title ? group.title.toLowerCase() : 'All India'}
              style={styles.chips}
            >
              {group.items.map((a) => {
                const isSelected = a.id === selected;
                return (
                  <Pressable
                    key={a.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`${a.label}, ${a.id}`}
                    aria-checked={isSelected}
                    onPress={() => onSelect(a.id)}
                    style={({ hovered, pressed }) => [
                      styles.areaChip,
                      {
                        borderColor: isSelected ? ui.ink : ui.hairline,
                        borderWidth: isSelected ? 1.5 : 1,
                        backgroundColor: hovered || pressed ? ui.hover : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        {
                          color: isSelected ? ui.ink : ui.muted,
                          fontWeight: isSelected ? '600' : '400',
                        },
                      ]}
                    >
                      {a.label}
                    </Text>
                    <Text style={[styles.areaCode, { color: ui.muted }]}>{a.short}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null,
      )}
    </View>
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
  status: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: 38,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
    marginTop: 12,
    marginBottom: 8,
  },
  areaChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  areaCode: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  empty: {
    fontSize: 12,
    paddingVertical: 8,
  },
  disclaimer: {
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16,
  },
});
