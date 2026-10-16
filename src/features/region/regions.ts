/**
 * Supported regions. Each region has one or more areas. An area fixes the
 * IANA time zone, and for Australia and India also the state whose holidays
 * apply. India has a single time zone, so its areas — the states and union
 * territories, coded as in ISO 3166-2:IN (IN-HR, IN-TN…) — are calendar
 * regions only.
 */
export type RegionCode = 'NP' | 'IN' | 'US' | 'AU';

export type Area = {
  id: string;
  /** Short label for the corner button, e.g. "ET", "NSW". */
  short: string;
  /** Longer label for the picker, e.g. "Eastern · New York". */
  label: string;
  timeZone: string;
  /** For India: whether the area is a state or a union territory. */
  group?: 'state' | 'union-territory';
};

export type Region = {
  code: RegionCode;
  name: string;
  areas: readonly Area[];
  /** Weekly days off, 0 = Sunday … 6 = Saturday; shown in the weekend colour. */
  weekend: readonly number[];
};

const IST = 'Asia/Kolkata';

/** ISO 3166-2:IN codes (2023 revision: OD, CG, TS, UK). */
const INDIA_STATES: readonly [string, string][] = [
  ['AP', 'Andhra Pradesh'],
  ['AR', 'Arunachal Pradesh'],
  ['AS', 'Assam'],
  ['BR', 'Bihar'],
  ['CG', 'Chhattisgarh'],
  ['GA', 'Goa'],
  ['GJ', 'Gujarat'],
  ['HR', 'Haryana'],
  ['HP', 'Himachal Pradesh'],
  ['JH', 'Jharkhand'],
  ['KA', 'Karnataka'],
  ['KL', 'Kerala'],
  ['MP', 'Madhya Pradesh'],
  ['MH', 'Maharashtra'],
  ['MN', 'Manipur'],
  ['ML', 'Meghalaya'],
  ['MZ', 'Mizoram'],
  ['NL', 'Nagaland'],
  ['OD', 'Odisha'],
  ['PB', 'Punjab'],
  ['RJ', 'Rajasthan'],
  ['SK', 'Sikkim'],
  ['TN', 'Tamil Nadu'],
  ['TS', 'Telangana'],
  ['TR', 'Tripura'],
  ['UP', 'Uttar Pradesh'],
  ['UK', 'Uttarakhand'],
  ['WB', 'West Bengal'],
];

const INDIA_UNION_TERRITORIES: readonly [string, string][] = [
  ['AN', 'Andaman and Nicobar Islands'],
  ['CH', 'Chandigarh'],
  ['DH', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['DL', 'Delhi'],
  ['JK', 'Jammu and Kashmir'],
  ['LA', 'Ladakh'],
  ['LD', 'Lakshadweep'],
  ['PY', 'Puducherry'],
];

function indiaArea(code: string, label: string, group: Area['group']): Area {
  return { id: `IN-${code}`, short: code, label, timeZone: IST, group };
}

export const REGIONS: readonly Region[] = [
  {
    code: 'NP',
    name: 'Nepal',
    areas: [{ id: 'NP', short: 'NP', label: 'Kathmandu', timeZone: 'Asia/Kathmandu' }],
    // Saturday is Nepal's weekly holiday; Sunday is a working day.
    weekend: [6],
  },
  {
    code: 'IN',
    name: 'India',
    areas: [
      // Central government offices (New Delhi): the DoPT list.
      { id: 'IN', short: 'IN', label: 'All India · central government', timeZone: IST },
      ...INDIA_STATES.map(([code, label]) => indiaArea(code, label, 'state')),
      ...INDIA_UNION_TERRITORIES.map(([code, label]) => indiaArea(code, label, 'union-territory')),
    ],
    weekend: [0, 6],
  },
  {
    code: 'US',
    name: 'United States',
    areas: [
      { id: 'ET', short: 'ET', label: 'Eastern · New York', timeZone: 'America/New_York' },
      { id: 'CT', short: 'CT', label: 'Central · Chicago', timeZone: 'America/Chicago' },
      { id: 'MT', short: 'MT', label: 'Mountain · Denver', timeZone: 'America/Denver' },
      { id: 'AZ', short: 'AZ', label: 'Arizona · Phoenix', timeZone: 'America/Phoenix' },
      { id: 'PT', short: 'PT', label: 'Pacific · Los Angeles', timeZone: 'America/Los_Angeles' },
      { id: 'AK', short: 'AK', label: 'Alaska · Anchorage', timeZone: 'America/Anchorage' },
      { id: 'HI', short: 'HI', label: 'Hawaii · Honolulu', timeZone: 'Pacific/Honolulu' },
    ],
    weekend: [0, 6],
  },
  {
    code: 'AU',
    name: 'Australia',
    areas: [
      { id: 'NSW', short: 'NSW', label: 'New South Wales · Sydney', timeZone: 'Australia/Sydney' },
      { id: 'ACT', short: 'ACT', label: 'ACT · Canberra', timeZone: 'Australia/Sydney' },
      { id: 'VIC', short: 'VIC', label: 'Victoria · Melbourne', timeZone: 'Australia/Melbourne' },
      { id: 'QLD', short: 'QLD', label: 'Queensland · Brisbane', timeZone: 'Australia/Brisbane' },
      {
        id: 'SA',
        short: 'SA',
        label: 'South Australia · Adelaide',
        timeZone: 'Australia/Adelaide',
      },
      { id: 'WA', short: 'WA', label: 'Western Australia · Perth', timeZone: 'Australia/Perth' },
      { id: 'TAS', short: 'TAS', label: 'Tasmania · Hobart', timeZone: 'Australia/Hobart' },
      { id: 'NT', short: 'NT', label: 'Northern Territory · Darwin', timeZone: 'Australia/Darwin' },
    ],
    weekend: [0, 6],
  },
];

export const DEFAULT_REGION: RegionCode = 'IN';

export function regionOf(code: RegionCode): Region {
  return REGIONS.find((r) => r.code === code) ?? REGIONS[1];
}

/** The area with this id in the region, or the region's first area. */
export function areaOf(code: RegionCode, areaId: string | undefined): Area {
  const region = regionOf(code);
  return region.areas.find((a) => a.id === areaId) ?? region.areas[0];
}

/**
 * The code shown in the corner: "IN", "IN-HR" for an Indian state, or
 * "US · ET" where an area is a time zone.
 */
export function regionLabel(region: Region, area: Area): string {
  if (area.group) return area.id;
  if (area.id === region.code || region.areas.length === 1) return region.code;
  return `${region.code} · ${area.short}`;
}

/** Distinct time zones in a region (India: one, however many states). */
export function timeZonesOf(region: Region): string[] {
  return [...new Set(region.areas.map((a) => a.timeZone))];
}

/** Zones the device might report for each area (aliases included). */
const ZONE_ALIASES: Record<string, [RegionCode, string]> = {
  'Asia/Calcutta': ['IN', 'IN'],
  'Asia/Katmandu': ['NP', 'NP'],
  'America/Detroit': ['US', 'ET'],
  'America/Indiana/Indianapolis': ['US', 'ET'],
  'America/Boise': ['US', 'MT'],
  'Australia/Canberra': ['AU', 'ACT'],
};

/**
 * The region and area matching the device's time zone, if it's one we
 * support; otherwise the default region.
 */
export function detectRegion(): { region: RegionCode; area: string } {
  let zone = '';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    // no Intl time zone support
  }
  const alias = ZONE_ALIASES[zone];
  if (alias) return { region: alias[0], area: alias[1] };
  for (const region of REGIONS) {
    const area = region.areas.find((a) => a.timeZone === zone);
    if (area) return { region: region.code, area: area.id };
  }
  return { region: DEFAULT_REGION, area: DEFAULT_REGION };
}
