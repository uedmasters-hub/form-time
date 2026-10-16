import type { Holiday, HolidaySource } from '../types';

/**
 * India — central government holidays (offices in Delhi / New Delhi) as
 * notified by the Department of Personnel & Training. States declare their
 * own lists, so local office closures can differ.
 *
 * Gazetted (closed) → 'public'; restricted (employees may take two) →
 * 'restricted'. Festival ranges are added where no single official list
 * gives them (see notes).
 */
const LUNAR = 'Date may shift with the moon sighting';

export const INDIA_SOURCES: HolidaySource[] = [
  {
    label: 'DoP&T O.M. F.No.12/2/2023-JCA, 03.07.2025',
    url: 'https://www.staffnews.in/2025/07/list-of-holidays-2026-dopt-order-reg-closed-and-restricted-holidays.html',
    covers: 'Gazetted & restricted holidays 2026',
  },
  {
    label: 'DoP&T O.M. F.No.12/2/2023-JCA, 16.07.2026',
    url: 'https://www.staffnews.in/2026/07/list-of-holidays-for-the-year-2027-gazetted.html',
    covers: 'Gazetted & restricted holidays 2027',
  },
  {
    label: 'DoP&T O.M. No. 12/3/2023-JCA, 22.05.2026',
    url: 'https://www.staffnews.in/2026/05/change-in-the-date-of-holiday-on-account-of-id-u-zuha-bakrid.html',
    covers: 'Id-ul-Zuha 2026 moved to 28 May',
  },
  {
    label: 'Drik Panchang (New Delhi), via Business Today',
    url: 'https://www.businesstoday.in/india/story/navratri-2026-full-calendar-durga-ashtami-maha-navami-dussehra-dates-check-here-560833-2026-10-11',
    covers: 'Sharad Navaratri 2026',
  },
];

export const INDIA_HOLIDAYS: Holiday[] = [
  // ── 2026 · gazetted ──────────────────────────────────────────────
  { start: '2026-01-26', name: 'Republic Day', kind: 'public' },
  { start: '2026-03-04', name: 'Holi', kind: 'public' },
  { start: '2026-03-21', name: 'Id-ul-Fitr', kind: 'public', note: LUNAR },
  { start: '2026-03-26', name: 'Ram Navami', kind: 'public' },
  { start: '2026-03-31', name: 'Mahavir Jayanti', kind: 'public' },
  { start: '2026-04-03', name: 'Good Friday', kind: 'public' },
  { start: '2026-05-01', name: 'Buddha Purnima', kind: 'public' },
  {
    start: '2026-05-28',
    name: 'Id-ul-Zuha (Bakrid)',
    kind: 'public',
    note: 'Moved from 27 May after the moon sighting (DoP&T, 22 May 2026)',
  },
  { start: '2026-06-26', name: 'Muharram', kind: 'public', note: LUNAR },
  { start: '2026-08-15', name: 'Independence Day', kind: 'public' },
  { start: '2026-08-26', name: 'Milad-un-Nabi (Id-e-Milad)', kind: 'public', note: LUNAR },
  { start: '2026-09-04', name: 'Janmashtami (Vaishnava)', kind: 'public' },
  { start: '2026-10-02', name: "Mahatma Gandhi's Birthday", kind: 'public' },
  { start: '2026-10-20', name: 'Dussehra (Vijayadashami)', kind: 'public' },
  { start: '2026-11-08', name: 'Diwali (Deepavali)', kind: 'public' },
  { start: '2026-11-24', name: "Guru Nanak's Birthday", kind: 'public' },
  { start: '2026-12-25', name: 'Christmas Day', kind: 'public' },

  // ── 2026 · restricted ────────────────────────────────────────────
  { start: '2026-01-01', name: "New Year's Day", kind: 'restricted' },
  { start: '2026-01-03', name: "Hazarat Ali's Birthday", kind: 'restricted', note: LUNAR },
  { start: '2026-01-14', name: 'Makar Sankranti · Magha Bihu · Pongal', kind: 'restricted' },
  { start: '2026-01-23', name: 'Basant Panchami · Sri Panchami', kind: 'restricted' },
  { start: '2026-02-01', name: "Guru Ravi Das's Birthday", kind: 'restricted' },
  { start: '2026-02-12', name: "Swami Dayananda Saraswati's Birthday", kind: 'restricted' },
  { start: '2026-02-15', name: 'Maha Shivratri', kind: 'restricted' },
  { start: '2026-02-19', name: 'Shivaji Jayanti', kind: 'restricted' },
  { start: '2026-03-03', name: 'Holika Dahan · Dolyatra', kind: 'restricted' },
  {
    start: '2026-03-19',
    name: 'Chaitra Sukladi · Gudi Padava · Ugadi · Cheti Chand',
    kind: 'restricted',
  },
  { start: '2026-03-20', name: 'Jamat-ul-Vida', kind: 'restricted', note: LUNAR },
  { start: '2026-04-05', name: 'Easter Sunday', kind: 'restricted' },
  { start: '2026-04-14', name: 'Vaisakhi · Vishu · Meshadi (Tamil New Year)', kind: 'restricted' },
  { start: '2026-04-15', name: 'Vaisakhadi (Bengal) · Bahag Bihu (Assam)', kind: 'restricted' },
  { start: '2026-05-09', name: "Rabindranath Tagore's Birthday", kind: 'restricted' },
  { start: '2026-07-16', name: 'Rath Yatra', kind: 'restricted' },
  { start: '2026-08-15', name: "Parsi New Year's Day · Nauraj", kind: 'restricted' },
  { start: '2026-08-26', name: 'Onam · Thiru Onam', kind: 'restricted' },
  { start: '2026-08-28', name: 'Raksha Bandhan', kind: 'restricted' },
  { start: '2026-09-14', name: 'Ganesh Chaturthi · Vinayaka Chaturthi', kind: 'restricted' },
  { start: '2026-10-18', name: 'Dussehra (Saptami)', kind: 'restricted' },
  { start: '2026-10-19', name: 'Dussehra (Mahashtami)', kind: 'restricted' },
  { start: '2026-10-20', name: 'Dussehra (Mahanavami)', kind: 'restricted' },
  { start: '2026-10-26', name: "Maharishi Valmiki's Birthday", kind: 'restricted' },
  { start: '2026-10-29', name: 'Karva Chauth', kind: 'restricted' },
  { start: '2026-11-08', name: 'Naraka Chaturdasi', kind: 'restricted' },
  { start: '2026-11-09', name: 'Govardhan Puja', kind: 'restricted' },
  { start: '2026-11-11', name: 'Bhai Duj', kind: 'restricted' },
  { start: '2026-11-15', name: 'Chhath Puja (Surya Shashthi)', kind: 'restricted' },
  { start: '2026-11-24', name: "Guru Teg Bahadur's Martyrdom Day", kind: 'restricted' },
  { start: '2026-12-23', name: "Hazarat Ali's Birthday", kind: 'restricted', note: LUNAR },
  { start: '2026-12-24', name: 'Christmas Eve', kind: 'restricted' },

  // ── 2026 · festivals ─────────────────────────────────────────────
  {
    start: '2026-10-11',
    end: '2026-10-19',
    name: 'Sharad Navaratri',
    kind: 'festival',
    note: 'Per Drik Panchang, New Delhi',
  },

  // ── 2027 · gazetted ──────────────────────────────────────────────
  { start: '2027-01-26', name: 'Republic Day', kind: 'public' },
  { start: '2027-03-10', name: 'Id-ul-Fitr', kind: 'public', note: LUNAR },
  { start: '2027-03-23', name: 'Holi', kind: 'public' },
  { start: '2027-03-26', name: 'Good Friday', kind: 'public' },
  { start: '2027-04-15', name: 'Ram Navami', kind: 'public' },
  { start: '2027-04-19', name: 'Mahavir Jayanti', kind: 'public' },
  { start: '2027-05-17', name: 'Id-ul-Zuha (Bakrid)', kind: 'public', note: LUNAR },
  { start: '2027-05-20', name: 'Buddha Purnima', kind: 'public' },
  { start: '2027-06-16', name: 'Muharram', kind: 'public', note: LUNAR },
  { start: '2027-08-15', name: 'Independence Day', kind: 'public' },
  { start: '2027-08-15', name: 'Milad-un-Nabi (Id-e-Milad)', kind: 'public', note: LUNAR },
  { start: '2027-08-25', name: 'Janmashtami (Vaishnava)', kind: 'public' },
  { start: '2027-10-02', name: "Mahatma Gandhi's Birthday", kind: 'public' },
  { start: '2027-10-09', name: 'Dussehra (Vijayadashami)', kind: 'public' },
  { start: '2027-10-29', name: 'Diwali (Deepavali)', kind: 'public' },
  { start: '2027-11-14', name: "Guru Nanak's Birthday", kind: 'public' },
  { start: '2027-12-25', name: 'Christmas Day', kind: 'public' },

  // ── 2027 · restricted ────────────────────────────────────────────
  { start: '2027-01-01', name: "New Year's Day", kind: 'restricted' },
  { start: '2027-01-14', name: 'Makar Sankranti · Magha Bihu', kind: 'restricted' },
  { start: '2027-01-15', name: "Pongal · Guru Gobind Singh's Birthday", kind: 'restricted' },
  { start: '2027-02-11', name: 'Basant Panchami · Sri Panchami', kind: 'restricted' },
  { start: '2027-02-19', name: 'Shivaji Jayanti', kind: 'restricted' },
  { start: '2027-02-20', name: "Guru Ravi Das's Birthday", kind: 'restricted' },
  { start: '2027-03-02', name: "Swami Dayananda Saraswati's Birthday", kind: 'restricted' },
  { start: '2027-03-05', name: 'Jamat-ul-Vida', kind: 'restricted', note: LUNAR },
  { start: '2027-03-06', name: 'Maha Shivratri', kind: 'restricted' },
  { start: '2027-03-22', name: 'Holika Dahan · Dolyatra', kind: 'restricted' },
  { start: '2027-03-28', name: 'Easter Sunday', kind: 'restricted' },
  {
    start: '2027-04-07',
    name: 'Chaitra Sukladi · Gudi Padava · Ugadi · Cheti Chand · 1st Navratra',
    kind: 'restricted',
  },
  { start: '2027-04-14', name: 'Vaisakhi · Vishu · Meshadi (Tamil New Year)', kind: 'restricted' },
  { start: '2027-04-15', name: 'Vaisakhadi (Bengal) · Bahag Bihu (Assam)', kind: 'restricted' },
  { start: '2027-05-09', name: "Rabindranath Tagore's Birthday", kind: 'restricted' },
  { start: '2027-07-05', name: 'Rath Yatra', kind: 'restricted' },
  { start: '2027-08-15', name: "Parsi New Year's Day · Navroz", kind: 'restricted' },
  { start: '2027-08-17', name: 'Raksha Bandhan', kind: 'restricted' },
  { start: '2027-09-04', name: 'Ganesh Chaturthi · Vinayaka Chaturthi', kind: 'restricted' },
  { start: '2027-09-12', name: 'Onam · Thiru Onam', kind: 'restricted' },
  { start: '2027-10-06', name: 'Dussehra (Saptami)', kind: 'restricted' },
  { start: '2027-10-07', name: 'Dussehra (Mahashtami)', kind: 'restricted' },
  { start: '2027-10-08', name: 'Dussehra (Mahanavami)', kind: 'restricted' },
  { start: '2027-10-15', name: "Maharishi Valmiki's Birthday", kind: 'restricted' },
  { start: '2027-10-18', name: 'Karva Chauth', kind: 'restricted' },
  { start: '2027-10-28', name: 'Naraka Chaturdasi', kind: 'restricted' },
  { start: '2027-10-30', name: 'Govardhan Puja', kind: 'restricted' },
  { start: '2027-10-31', name: 'Bhai Duj', kind: 'restricted' },
  { start: '2027-11-04', name: 'Chhath Puja (Surya Shashthi)', kind: 'restricted' },
  { start: '2027-11-24', name: "Guru Teg Bahadur's Martyrdom Day", kind: 'restricted' },
  { start: '2027-12-12', name: "Hazarat Ali's Birthday", kind: 'restricted', note: LUNAR },
  { start: '2027-12-24', name: 'Christmas Eve', kind: 'restricted' },
];
