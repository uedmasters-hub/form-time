/**
 * Supported regions. Each region has one or more areas; an area fixes the
 * IANA time zone (and, for Australia, the state whose holidays apply).
 */
export type RegionCode = 'NP' | 'IN' | 'US' | 'AU';

export type Area = {
  id: string;
  /** Short label for the corner button, e.g. "ET", "NSW". */
  short: string;
  /** Longer label for the picker, e.g. "Eastern · New York". */
  label: string;
  timeZone: string;
};

export type Region = {
  code: RegionCode;
  name: string;
  areas: readonly Area[];
};

export const REGIONS: readonly Region[] = [
  {
    code: 'NP',
    name: 'Nepal',
    areas: [{ id: 'NP', short: 'NP', label: 'Kathmandu', timeZone: 'Asia/Kathmandu' }],
  },
  {
    code: 'IN',
    name: 'India',
    areas: [{ id: 'IN', short: 'IN', label: 'New Delhi', timeZone: 'Asia/Kolkata' }],
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
