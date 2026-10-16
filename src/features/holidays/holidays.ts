import {
  addDays,
  compareDates,
  toISODate,
  type CalendarDate,
} from '@/features/calendar/calendar-date';
import type { RegionCode } from '@/features/region/regions';

import { australianHolidays, AUSTRALIA_SOURCES, type AuState } from './data/australia';
import { NEPAL_HOLIDAYS, NEPAL_SOURCES } from './data/nepal';
import { US_SOURCES, usFederalHolidays } from './data/united-states';
import { CENTRAL_AREA, indiaHolidays, indiaSources } from './india';
import type { DayHoliday, Holiday, HolidayKind, HolidaySource } from './types';

export type HolidayFilters = Record<HolidayKind, boolean>;

/** What each kind is called in each region, for labels and toggles. */
export const KIND_LABELS: Record<RegionCode, Record<HolidayKind, string>> = {
  IN: { public: 'Gazetted holiday', restricted: 'Restricted holiday', festival: 'Festival' },
  NP: { public: 'Public holiday', restricted: 'Holiday for some', festival: 'Festival' },
  US: { public: 'Federal holiday', restricted: 'Observance', festival: 'Festival' },
  AU: { public: 'Public holiday', restricted: 'Regional holiday', festival: 'Festival' },
};

/** Plural labels for the on/off switches. */
export const KIND_PLURALS: Record<RegionCode, Record<HolidayKind, string>> = {
  IN: { public: 'Gazetted holidays', restricted: 'Restricted holidays', festival: 'Festivals' },
  NP: { public: 'Public holidays', restricted: 'Holidays for some', festival: 'Festivals' },
  US: { public: 'Federal holidays', restricted: 'Observances', festival: 'Festivals' },
  AU: { public: 'Public holidays', restricted: 'Regional holidays', festival: 'Festivals' },
};

/** Labels for an Indian state, where "public" includes the national holidays. */
const INDIA_STATE_LABELS: Record<HolidayKind, string> = {
  public: 'Public holiday',
  restricted: 'Holiday for some',
  festival: 'Festival or observance',
};
const INDIA_STATE_PLURALS: Record<HolidayKind, string> = {
  public: 'Public holidays',
  restricted: 'Optional and partial holidays',
  festival: 'Festivals and observances',
};

const isIndianState = (region: RegionCode, area: string) =>
  region === 'IN' && area !== CENTRAL_AREA;

export function kindLabels(region: RegionCode, area: string): Record<HolidayKind, string> {
  return isIndianState(region, area) ? INDIA_STATE_LABELS : KIND_LABELS[region];
}

export function kindPlurals(region: RegionCode, area: string): Record<HolidayKind, string> {
  return isIndianState(region, area) ? INDIA_STATE_PLURALS : KIND_PLURALS[region];
}

/** Kinds that actually occur in a region's data (so empty toggles are hidden). */
export const REGION_KINDS: Record<RegionCode, HolidayKind[]> = {
  IN: ['public', 'restricted', 'festival'],
  NP: ['public', 'restricted', 'festival'],
  US: ['public'],
  AU: ['public'],
};

export function holidaySources(region: RegionCode, area: string): HolidaySource[] {
  switch (region) {
    case 'IN':
      return indiaSources(area);
    case 'NP':
      return NEPAL_SOURCES;
    case 'US':
      return US_SOURCES;
    case 'AU':
      return AUSTRALIA_SOURCES;
  }
}

/** All known holidays for a region and area overlapping the given years. */
export function holidaysFor(region: RegionCode, area: string, years: number[]): Holiday[] {
  switch (region) {
    case 'IN':
      return cached(`IN:${area}`, () => indiaHolidays(area));
    case 'NP':
      return NEPAL_HOLIDAYS;
    case 'US':
      return years.flatMap(usFederalHolidays);
    case 'AU':
      return australianHolidays(area as AuState);
  }
}

const composed = new Map<string, Holiday[]>();
function cached(key: string, build: () => Holiday[]): Holiday[] {
  let list = composed.get(key);
  if (!list) {
    list = build();
    composed.set(key, list);
  }
  return list;
}

function parseISO(iso: string): CalendarDate {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

/**
 * Holidays falling on each day from `from` to `to` (inclusive), keyed by ISO
 * date. Multi-day holidays appear on every day they cover, with their day
 * number. Public holidays sort first.
 */
export function holidaysByDay(
  region: RegionCode,
  area: string,
  from: CalendarDate,
  to: CalendarDate,
  filters: HolidayFilters,
): Map<string, DayHoliday[]> {
  const years = Array.from({ length: to.year - from.year + 1 }, (_, i) => from.year + i);
  const order: Record<HolidayKind, number> = { public: 0, restricted: 1, festival: 2 };
  const map = new Map<string, DayHoliday[]>();

  for (const holiday of holidaysFor(region, area, years)) {
    if (!filters[holiday.kind]) continue;
    const start = parseISO(holiday.start);
    const end = holiday.end ? parseISO(holiday.end) : start;
    if (compareDates(end, from) < 0 || compareDates(start, to) > 0) continue;

    const total = Math.round(compareDates(end, start) / 86_400_000) + 1;
    for (let i = 0; i < total; i++) {
      const day = addDays(start, i);
      if (compareDates(day, from) < 0 || compareDates(day, to) > 0) continue;
      const key = toISODate(day);
      const list = map.get(key) ?? [];
      list.push(total > 1 ? { ...holiday, dayOf: [i + 1, total] } : holiday);
      map.set(key, list);
    }
  }

  for (const list of map.values()) list.sort((a, b) => order[a.kind] - order[b.kind]);
  return map;
}
