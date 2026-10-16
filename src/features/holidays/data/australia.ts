import type { Holiday, HolidaySource } from '../types';

/**
 * Australia — public holidays for 2026 and 2027 as published by the Fair
 * Work Ombudsman, per state or territory. Entries without `states` apply in
 * every state and territory. Regional and part-day holidays (Melbourne Cup,
 * show days, Christmas Eve evenings…) are not included.
 */
export type AuState = 'ACT' | 'NSW' | 'NT' | 'QLD' | 'SA' | 'TAS' | 'VIC' | 'WA';

type AuHoliday = Holiday & { states?: AuState[] };

export const AUSTRALIA_SOURCES: HolidaySource[] = [
  {
    label: 'Fair Work Ombudsman — 2026 public holidays',
    url: 'https://www.fairwork.gov.au/employment-conditions/public-holidays/2026-public-holidays',
    covers: 'National and state public holidays 2026',
  },
  {
    label: 'Fair Work Ombudsman — 2027 public holidays',
    url: 'https://www.fairwork.gov.au/employment-conditions/public-holidays/2027-public-holidays',
    covers: 'National and state public holidays 2027',
  },
];

const KINGS_JUNE: AuState[] = ['ACT', 'NSW', 'NT', 'SA', 'TAS', 'VIC'];

const AU_HOLIDAYS: AuHoliday[] = [
  // ── 2026 ─────────────────────────────────────────────────────────
  { start: '2026-01-01', name: "New Year's Day", kind: 'public' },
  { start: '2026-01-26', name: 'Australia Day', kind: 'public' },
  { start: '2026-04-03', name: 'Good Friday', kind: 'public' },
  { start: '2026-04-06', name: 'Easter Monday', kind: 'public' },
  { start: '2026-04-25', name: 'Anzac Day', kind: 'public' },
  {
    start: '2026-04-27',
    name: 'Anzac Day (substitute)',
    kind: 'public',
    states: ['ACT', 'NSW', 'WA'],
  },
  { start: '2026-06-08', name: "King's Birthday", kind: 'public', states: KINGS_JUNE },
  {
    start: '2026-09-28',
    name: "King's Birthday",
    kind: 'public',
    states: ['WA'],
    note: 'Some regional WA areas differ',
  },
  { start: '2026-10-05', name: "King's Birthday", kind: 'public', states: ['QLD'] },
  { start: '2026-12-25', name: 'Christmas Day', kind: 'public' },
  {
    start: '2026-12-26',
    name: 'Boxing Day',
    kind: 'public',
    states: ['ACT', 'NSW', 'NT', 'QLD', 'VIC', 'WA'],
  },
  { start: '2026-12-26', name: 'Proclamation Day', kind: 'public', states: ['SA'] },
  {
    start: '2026-12-28',
    name: 'Boxing Day (substitute)',
    kind: 'public',
    states: ['ACT', 'NSW', 'NT', 'QLD', 'VIC', 'WA'],
  },
  { start: '2026-12-28', name: 'Proclamation Day (substitute)', kind: 'public', states: ['SA'] },
  { start: '2026-12-28', name: 'Boxing Day', kind: 'public', states: ['TAS'] },

  // ── 2027 ─────────────────────────────────────────────────────────
  { start: '2027-01-01', name: "New Year's Day", kind: 'public' },
  { start: '2027-01-26', name: 'Australia Day', kind: 'public' },
  { start: '2027-03-26', name: 'Good Friday', kind: 'public' },
  { start: '2027-03-29', name: 'Easter Monday', kind: 'public' },
  {
    start: '2027-04-25',
    name: 'Anzac Day',
    kind: 'public',
    states: ['NSW', 'SA', 'TAS', 'VIC', 'WA'],
  },
  { start: '2027-04-26', name: 'Anzac Day', kind: 'public', states: ['ACT', 'NT', 'QLD'] },
  { start: '2027-04-26', name: 'Anzac Day (substitute)', kind: 'public', states: ['NSW', 'WA'] },
  { start: '2027-06-14', name: "King's Birthday", kind: 'public', states: KINGS_JUNE },
  {
    start: '2027-09-27',
    name: "King's Birthday",
    kind: 'public',
    states: ['WA'],
    note: 'Some regional WA areas differ',
  },
  { start: '2027-10-04', name: "King's Birthday", kind: 'public', states: ['QLD'] },
  { start: '2027-12-25', name: 'Christmas Day', kind: 'public' },
  {
    start: '2027-12-26',
    name: 'Boxing Day',
    kind: 'public',
    states: ['ACT', 'NSW', 'NT', 'QLD', 'VIC', 'WA'],
  },
  { start: '2027-12-26', name: 'Proclamation Day', kind: 'public', states: ['SA'] },
  { start: '2027-12-27', name: 'Christmas Day (substitute)', kind: 'public' },
  {
    start: '2027-12-28',
    name: 'Boxing Day (substitute)',
    kind: 'public',
    states: ['ACT', 'NSW', 'NT', 'QLD', 'VIC', 'WA'],
  },
  { start: '2027-12-28', name: 'Proclamation Day (substitute)', kind: 'public', states: ['SA'] },
  { start: '2027-12-28', name: 'Boxing Day', kind: 'public', states: ['TAS'] },
];

export function australianHolidays(state: AuState): Holiday[] {
  return AU_HOLIDAYS.filter((h) => !h.states || h.states.includes(state)).map(
    ({ states: _states, ...holiday }) => holiday,
  );
}
