import { compareDates, type CalendarDate } from '@/features/calendar/calendar-date';

import { INDIA_HOLIDAYS, INDIA_SOURCES } from './data/india';
import { INDIA_STATE_HOLIDAYS } from './data/india-states';
import type { Holiday, HolidaySource } from './types';

/**
 * India's calendar for one area: the central government list ("IN"), or a
 * state or union territory ("IN-HR"). For a state:
 *
 * - National holidays — Republic Day, Independence Day, Gandhi Jayanti —
 *   always appear, every year.
 * - The state's own list gives its public holidays and its holidays for
 *   some (optional, partial, local, banks only).
 * - Festivals and observances from the central calendar fill in what the
 *   state's list doesn't mention (a festival on a Sunday, say), marked as
 *   festivals so they never read as days off.
 */
export const CENTRAL_AREA = 'IN';

/** Union territories whose administrations follow the central (DoP&T) list. */
const FOLLOWS_CENTRAL = new Set(['IN-AN', 'IN-LD']);

const NATIONAL_NOTE = 'National holiday';
const NATIONAL_DAYS: readonly [month: number, day: number, name: string][] = [
  [1, 26, 'Republic Day'],
  [8, 15, 'Independence Day'],
  [10, 2, 'Mahatma Gandhi Jayanti'],
];
const NATIONAL_NAME = /republic|independence|gandhi/i;

const CENTRAL_NOTE = 'Central government calendar';

/** Years the national holidays are generated for. */
const NATIONAL_YEARS = [2026, 2027];

export type IndiaListStatus = 'central' | 'state' | 'follows-central' | 'missing';

export function indiaListStatus(area: string): IndiaListStatus {
  if (area === CENTRAL_AREA) return 'central';
  if (INDIA_STATE_HOLIDAYS[area]) return 'state';
  return FOLLOWS_CENTRAL.has(area) ? 'follows-central' : 'missing';
}

export function indiaSources(area: string): HolidaySource[] {
  const state = INDIA_STATE_HOLIDAYS[area]?.source;
  if (area === CENTRAL_AREA) return INDIA_SOURCES;
  return [...(state ? [state] : []), ...INDIA_SOURCES, RBI_SOURCE];
}

const RBI_SOURCE: HolidaySource = {
  label: 'Reserve Bank of India — holidays under the NI Act',
  url: 'https://rbi.org.in/Scripts/HolidayMatrixDisplay.aspx',
  covers: 'Cross-check of state dates by regional office',
};

export function indiaHolidays(area: string): Holiday[] {
  if (area === CENTRAL_AREA) return INDIA_HOLIDAYS;

  const status = indiaListStatus(area);
  const own: Holiday[] =
    status === 'state'
      ? INDIA_STATE_HOLIDAYS[area].holidays
      : status === 'follows-central'
        ? INDIA_HOLIDAYS.filter((h) => h.kind !== 'festival').map((h) =>
            h.kind === 'restricted' ? { ...h, note: joinNotes('Optional holiday', h.note) } : h,
          )
        : [];

  // National days: mark the state's own entry, or add one where it's missing.
  const marked = own.map((h) =>
    h.kind === 'public' && isNationalDay(h) ? { ...h, note: joinNotes(NATIONAL_NOTE, h.note) } : h,
  );
  const national: Holiday[] = [];
  for (const year of NATIONAL_YEARS) {
    for (const [month, day, name] of NATIONAL_DAYS) {
      const start = iso(year, month, day);
      if (
        !marked.some((h) => h.start === start && h.kind === 'public' && NATIONAL_NAME.test(h.name))
      ) {
        national.push({ start, name, kind: 'public', note: NATIONAL_NOTE });
      }
    }
  }

  // Central festivals and observances the state's list doesn't already cover.
  const observances = INDIA_HOLIDAYS.filter(
    (h) =>
      h.kind === 'festival' || (!isNationalDay(h) && !marked.some((own) => sameObservance(own, h))),
  ).map((h): Holiday =>
    h.kind === 'festival'
      ? h
      : { start: h.start, name: h.name, kind: 'festival', note: joinNotes(CENTRAL_NOTE, h.note) },
  );

  return [...marked, ...national, ...observances];
}

function isNationalDay(h: Holiday): boolean {
  const [, month, day] = h.start.split('-').map(Number);
  return NATIONAL_NAME.test(h.name) && NATIONAL_DAYS.some(([m, d]) => m === month && d === day);
}

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function joinNotes(...notes: (string | undefined)[]): string {
  return notes.filter(Boolean).join(' · ');
}

function parse(isoDate: string): CalendarDate {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { year, month, day };
}

/**
 * The same festival under the regional names states use: "Deepavali",
 * "Diwali Amavasya (Laxmi Pujan)" and "Kali Puja" are one Diwali. Names in
 * the same family within three days of each other count as the same
 * observance (lunar dates differ by a day between states).
 */
const FAMILIES: readonly RegExp[] = [
  /fitr|ramzan|ramadan|khutub/i,
  /zuha|zoha|adha|azha|bakri/i,
  /muharram|moharram|moharam|moharum|ashura|ashoora|imam hussain/i,
  /milad|barawafat|prophet|hazrat muhammad/i,
  /holi\b|holi \(|dhuleti|dhulandi|dhulivandan|dol ?jatra|doljatra|dola purnima|yaoshang|bhumchu/i,
  /holika/i,
  /diwali|deepavali|deepawali|dipavali|laxmi puj|lakshmi puj|kali puja/i,
  /naraka|narak/i,
  /dussehra|dasara|dussera|vijaya ?da|vijayada|dasain|navami|ashtami|astami|saptami|durga|ayudha|ayutha|kwak/i,
  /janm|krishna/i,
  /christmas(?! eve)/i,
  /christmas eve/i,
  /ram ?navami|rama ?navami|ram naumi|ramanavami|ram navmi/i,
  /mahavir|mahaveer/i,
  /buddha|budha/i,
  /guru nanak|gurpurab|kartika? purnima|rahas purnima/i,
  /good friday/i,
  /easter/i,
  /ganesh|vinayak|vinayagar/i,
  /sankranti|pongal|magh bihu|magha bihu|uttarayan|maghe/i,
  /raksha|rakhi/i,
  /shivratri|shivaratri|sivaratri|sivarathri/i,
  /basant|vasant|sri panchami|saraswati puja/i,
  /ravidas|ravi das|rabidas|ravidass/i,
  /valmiki/i,
  /karva|karwa|karaka/i,
  /chhath|chhat\b|surya shashthi/i,
  /govardhan|goverdhan|bali ?pa|balipadyami|vikram samvat|bestu/i,
  /bhai|bhatri|bhaubeej|bhaubij|bhratri/i,
  /hazrat ali|hazarat ali|hazrath ali/i,
  /jamat|jumat|jumuat|jummat/i,
  /barat|barath/i,
  /chaitra|ugadi|gudi|cheti chand|chetichand|sajibu/i,
  /vaisakhi|baisakhi|vishu|bohag|bahag|nababarsha|bengali new|tamil new|meshadi|vaisakhadi|vishuba/i,
  /dayanand/i,
  /tagore|rabindranath/i,
  /rath ?yatra|ratha ?yatra|rathayatra|rathajatra/i,
  /parsi|nauraj|navroz|nauroz/i,
  /onam/i,
  /teg bahadur|tegh bahadur/i,
  /shivaji/i,
  /guru gobind/i,
  /new year'?s day|^new year$/i,
];

function families(name: string): number[] {
  return FAMILIES.flatMap((re, i) => (re.test(name) ? [i] : []));
}

function sameObservance(own: Holiday, central: Holiday): boolean {
  const days = Math.abs(compareDates(parse(own.start), parse(central.start))) / 86_400_000;
  if (days > 3) return false;
  const a = families(own.name);
  const b = families(central.name);
  if (b.length === 0) return days === 0 && own.name.toLowerCase() === central.name.toLowerCase();
  return b.some((f) => a.includes(f));
}
