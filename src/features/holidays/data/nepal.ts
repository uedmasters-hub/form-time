import type { Holiday, HolidaySource } from '../types';

/**
 * Nepal — B.S. 2083 (14 April 2026 – 13 April 2027).
 *
 * Holidays: Ministry of Home Affairs notice of 2 March 2026. Holidays for
 * all ("national public holidays") → 'public'; holidays for specific groups
 * or districts → 'restricted', with who they apply to in the note.
 *
 * Festivals: the major festivals and observances of the year as Hamro Patro
 * lists them (its dates follow the Nepal Panchang Nirnayak Bikas Samiti).
 * The Dashain dates and the Tika time were checked against the Samiti's
 * announcement. Everyday vrat and international days are left out.
 */
const LUNAR = 'Date may shift with the moon sighting';

export const NEPAL_SOURCES: HolidaySource[] = [
  {
    label:
      'Ministry of Home Affairs, List of Public Holidays 2083 (summary by Pradhan & Associates)',
    url: 'https://pradhanlaw.com/publications/list-of-public-holidays-2083-202627',
    covers: 'Public holidays 14 Apr 2026 – 13 Apr 2027',
  },
  {
    label: 'Hamro Patro, Nepali calendar 2083',
    url: 'https://www.hamropatro.com/calendar/2083/6/',
    covers: 'Festivals and B.S. dates 2083',
  },
  {
    label: 'Nepal Panchang Nirnayak Bikas Samiti, via ShareSansar',
    url: 'https://www.sharesansar.com/newsdetail/dashain-tika-sait-fixed-for-1026-am-on-kartik-4-2026-10-07',
    covers: 'Dashain 2083 dates and Tika time',
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
  { start: '2026-08-28', name: 'Janai Purnima · Raksha Bandhan', kind: 'public' },
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
    name: 'Basanta Panchami · Saraswati Puja',
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

  // ── Festivals and observances (Hamro Patro) ──────────────────────
  { start: '2026-04-14', name: 'Bisket Jatra', kind: 'festival', note: 'Bhaktapur' },
  { start: '2026-04-17', name: 'Mata Tirtha Aunsi', kind: 'festival', note: "Mother's Day" },
  { start: '2026-04-20', name: 'Akshaya Tritiya', kind: 'festival' },
  {
    start: '2026-04-21',
    name: 'Rato Machhindranath Jatra begins',
    kind: 'festival',
    note: 'Lalitpur',
  },
  { start: '2026-05-28', name: 'Bakar Eid (Eid al-Adha)', kind: 'festival', note: LUNAR },
  {
    start: '2026-06-20',
    name: 'Bhoto Jatra',
    kind: 'festival',
    note: 'Holiday in the Kathmandu Valley',
  },
  {
    start: '2026-06-29',
    name: 'Asar 15 · Dahi Chiura',
    kind: 'festival',
    note: 'National Paddy Day',
  },
  { start: '2026-07-13', name: 'Bhanu Jayanti', kind: 'festival' },
  { start: '2026-07-17', name: 'Saune Sankranti · Luto Falne', kind: 'festival' },
  { start: '2026-07-25', name: 'Harishayani Ekadashi', kind: 'festival', note: 'Chaturmas begins' },
  { start: '2026-07-29', name: 'Guru Purnima', kind: 'festival' },
  { start: '2026-07-31', name: 'Shrawan 15 · Kheer Khane Din', kind: 'festival' },
  { start: '2026-08-11', name: 'Gathemangal', kind: 'festival' },
  {
    start: '2026-08-13',
    end: '2026-09-12',
    name: 'Gunla',
    kind: 'festival',
    note: 'Newar Buddhist holy month',
  },
  { start: '2026-08-17', name: 'Nag Panchami', kind: 'festival' },
  {
    start: '2026-08-26',
    name: "Prophet Muhammad's Birthday",
    kind: 'restricted',
    note: `Muslim community · ${LUNAR}`,
  },
  { start: '2026-09-11', name: 'Kushe Aunsi', kind: 'festival', note: "Father's Day" },
  { start: '2026-09-13', name: 'Dar Khane Din', kind: 'festival', note: 'Eve of Teej' },
  { start: '2026-09-14', name: 'Ganesh Chaturthi', kind: 'festival' },
  { start: '2026-09-15', name: 'Rishi Panchami', kind: 'festival' },
  { start: '2026-09-17', name: 'Vishwakarma Puja', kind: 'festival' },
  {
    start: '2026-09-27',
    end: '2026-10-10',
    name: 'Sorha Shraddha',
    kind: 'festival',
    note: 'Pitri Paksha, ending with Pitri Visarjan',
  },
  {
    start: '2026-10-11',
    end: '2026-10-20',
    name: 'Navaratri',
    kind: 'festival',
    note: 'Ghatasthapana to Maha Navami',
  },
  { start: '2026-10-17', name: 'Fulpati', kind: 'festival' },
  { start: '2026-10-18', name: 'Maha Ashtami', kind: 'festival' },
  { start: '2026-10-20', name: 'Maha Navami', kind: 'festival' },
  {
    start: '2026-10-21',
    name: 'Vijaya Dashami',
    kind: 'festival',
    note: 'Dashain Tika — auspicious time 10:26 AM',
  },
  { start: '2026-10-25', name: 'Kojagrat Purnima', kind: 'festival', note: 'Dashain ends' },
  { start: '2026-11-06', name: 'Dhanteras', kind: 'festival', note: 'Yamadeepdan begins' },
  { start: '2026-11-07', name: 'Kag Tihar', kind: 'festival' },
  { start: '2026-11-08', name: 'Kukur Tihar · Laxmi Puja', kind: 'festival' },
  { start: '2026-11-09', name: 'Gai Puja', kind: 'festival' },
  {
    start: '2026-11-10',
    name: 'Govardhan Puja · Mha Puja',
    kind: 'festival',
    note: 'Nepal Sambat 1147 begins',
  },
  { start: '2026-11-11', name: 'Bhai Tika', kind: 'festival' },
  { start: '2026-11-20', name: 'Haribodhini Ekadashi · Tulsi Bibaha', kind: 'festival' },
  {
    start: '2026-11-24',
    name: 'Guru Nanak Jayanti · Kartik Purnima',
    kind: 'festival',
    note: 'Chaturmas ends',
  },
  { start: '2026-12-07', name: 'Bala Chaturdashi', kind: 'festival' },
  { start: '2026-12-14', name: 'Bibaha Panchami', kind: 'festival' },
  { start: '2026-12-20', name: 'Gita Jayanti', kind: 'festival' },
  { start: '2027-01-08', name: 'Tol Lhosar', kind: 'festival' },
  {
    start: '2027-01-22',
    end: '2027-02-20',
    name: 'Swasthani Brata',
    kind: 'festival',
    note: 'Month of Swasthani readings',
  },
];
