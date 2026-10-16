import type { Holiday, HolidaySource } from '../types';

/**
 * Nepal — public holidays for B.S. 2083 (14 April 2026 – 13 April 2027),
 * Ministry of Home Affairs notice of 2 March 2026. Holidays for all
 * ("national public holidays") → 'public'; holidays for specific groups or
 * districts → 'restricted', with who they apply to in the note. Lunar
 * holidays the notice leaves "to be determined" are omitted until fixed.
 */
export const NEPAL_SOURCES: HolidaySource[] = [
  {
    label:
      'Ministry of Home Affairs, List of Public Holidays 2083 (summary by Pradhan & Associates)',
    url: 'https://pradhanlaw.com/publications/list-of-public-holidays-2083-202627',
    covers: 'Public holidays 14 Apr 2026 – 13 Apr 2027',
  },
];

export const NEPAL_HOLIDAYS: Holiday[] = [
  { start: '2026-04-14', name: 'New Year (Nava Barsha 2083)', kind: 'public' },
  {
    start: '2026-05-01',
    name: 'Labour Day · Buddha Jayanti · Chandi Purnima · Ubhauli',
    kind: 'public',
  },
  { start: '2026-05-29', name: 'Republic Day', kind: 'public' },
  { start: '2026-08-28', name: 'Raksha Bandhan', kind: 'public' },
  {
    start: '2026-08-29',
    name: 'Gai Jatra',
    kind: 'restricted',
    note: 'Kathmandu Valley residents and the Newar community',
  },
  { start: '2026-09-04', name: 'Shree Krishna Janmashtami · Gaura Parwa', kind: 'public' },
  { start: '2026-09-14', name: 'Haritalika Teej', kind: 'restricted', note: 'Women only' },
  { start: '2026-09-19', name: 'Constitution Day', kind: 'public' },
  { start: '2026-09-25', name: 'Indra Jatra', kind: 'restricted', note: 'Kathmandu Valley only' },
  { start: '2026-10-04', name: 'Jitiya Parwa', kind: 'restricted', note: 'Women observing Jitiya' },
  { start: '2026-10-11', name: 'Ghatasthapana', kind: 'public', note: 'Dashain begins' },
  { start: '2026-10-17', end: '2026-10-23', name: 'Dashain', kind: 'public' },
  { start: '2026-11-08', end: '2026-11-12', name: 'Tihar', kind: 'public' },
  { start: '2026-11-11', name: 'Falgunanda Jayanti', kind: 'restricted', note: 'Kirat community' },
  { start: '2026-11-15', name: 'Chhath Parwa', kind: 'public' },
  {
    start: '2026-12-03',
    name: 'International Day of Persons with Disabilities',
    kind: 'restricted',
    note: 'People with disabilities',
  },
  { start: '2026-12-24', name: 'Dhanya Purnima · Udhauli · Yomari Punhi', kind: 'public' },
  { start: '2026-12-25', name: 'Christmas Day', kind: 'public' },
  { start: '2026-12-30', name: 'Tamu Lhosar · Dura Mhaipru Nakuma', kind: 'public' },
  { start: '2027-01-11', name: 'Prithvi Jayanti · National Unity Day', kind: 'public' },
  { start: '2027-01-15', name: 'Maghe Sankranti · Maghi Parwa', kind: 'public' },
  { start: '2027-01-30', name: "Martyrs' Day", kind: 'public' },
  { start: '2027-02-07', name: 'Sonam Lhosar', kind: 'public' },
  {
    start: '2027-02-11',
    name: 'Basanta Panchami',
    kind: 'restricted',
    note: 'Educational institutions only',
  },
  { start: '2027-02-19', name: 'National Democracy Day', kind: 'public' },
  { start: '2027-03-06', name: 'Maha Shivaratri', kind: 'public' },
  {
    start: '2027-03-08',
    name: "International Women's Day",
    kind: 'restricted',
    note: 'Women employees',
  },
  { start: '2027-03-09', name: 'Gyalpo Lhosar', kind: 'public' },
  {
    start: '2027-03-21',
    name: 'Fagu Purnima (Holi)',
    kind: 'restricted',
    note: '56 Himalayan and hill districts',
  },
  { start: '2027-03-22', name: 'Terai Holi', kind: 'restricted', note: '21 Terai districts' },
  { start: '2027-04-06', name: 'Ghode Jatra', kind: 'restricted', note: 'Kathmandu Valley only' },
];
