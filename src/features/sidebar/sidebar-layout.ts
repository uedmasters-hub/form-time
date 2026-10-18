/**
 * The side panel's geometry, shared by the analog clock, the digital clock
 * and the calendar. The page's own content (a dial, the time, a month) is
 * centred in `main`, which never depends on the panel: showing or hiding
 * it moves and resizes nothing. Wide screens: `main` is centred on the
 * page, and the panel floats in the space beside it, the date at the top
 * right and the day's events and festivals at the bottom right, as wide as
 * its content needs. Narrow screens: the date across the top and the list
 * across the foot, in bands that are always kept.
 *
 * The clock pages pass `fits`: their content comes first. Where the screen
 * is too short for everything, the panel gives way — fewer event rows, a
 * smaller date, then no list, and only then no date — instead of the dial
 * shrinking; the bands for the corner controls tighten on short screens;
 * and the panel's two halves never meet. Which halves fit depends only on
 * the screen, never on the Settings switches, so toggling them still moves
 * nothing.
 */

/** Bands kept clear for the corner controls (region code, settings, switch). */
export const SIDEBAR_TOP = 72;
export const SIDEBAR_BOTTOM = 76;
/** Wide layouts: the content in the middle, the panel floating at the right. */
const WIDE_MIN_WIDTH = 720;
/** Least space between the content and the panel. */
export const SIDEBAR_GAP = 40;
/** One list row (meta line, title, place), and one list heading. */
export const SIDEBAR_ROW = 66;
export const SIDEBAR_HEADING = 32;
/** Least room the panel's text needs beside the content (wide). */
const PANEL_MIN = 180;
/** Breathing room between the date and the list (wide) or the content (narrow). */
const DATE_GAP = 40;
const NARROW_GAP = 16;
/** Wide: the content keeps at least this share of the width clear at each side. */
const OPEN_MARGIN = 0.08;
/** Festivals show one row at a time; the rest scroll. */
export const FESTIVAL_ROWS = 1;
/** The date's numeral: wide, narrow, and where room is short. */
const NUMERAL_WIDE = 56;
const NUMERAL_NARROW = 40;
const NUMERAL_SMALL = 28;
/** Least band for the corner controls on short screens (a 44 pt control and its edge). */
const BAND_MIN = 56;

export type Insets = { left: number; right: number; top: number; bottom: number };

export type SidebarLayout = {
  /** The page. */
  width: number;
  height: number;
  wide: boolean;
  /** Distance from the page's left and right edges. */
  side: number;
  /** The date's large numeral. */
  dateNumeral: number;
  /** Events shown before the list scrolls. */
  eventRows: number;
  showDate: boolean;
  showEvents: boolean;
  /** Where the page's own content is centred, as insets from the page's edges. */
  main: Insets;
  /** Where the date's top and the list's foot sit, from the page's top and bottom. */
  top: number;
  bottom: number;
};

/** Height of the date block (DayHeading) for a numeral this tall. */
export function dateBlockHeight(numeral: number) {
  const stroke = Math.max(3, numeral * 0.17);
  // weekday line, gap, numeral, gap, month line, second-calendar line
  return 16 + 14 + numeral + stroke * 2 + 12 + 21 + 21;
}

/** Height of the list: two headings, the events' rows and one festival row. */
function listBlockHeight(eventRows: number) {
  return SIDEBAR_HEADING * 2 + (eventRows + FESTIVAL_ROWS) * SIDEBAR_ROW;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function sidebarLayout(
  width: number,
  height: number,
  {
    showDate = true,
    showEvents = true,
    eventRows = 3,
    fits,
  }: {
    showDate?: boolean;
    showEvents?: boolean;
    /** Events to show before scrolling (fewer when the screen is short). */
    eventRows?: number;
    /**
     * The clock pages: how much of `main`'s width their content gets there
     * (0–1, narrow screens). Given, the panel gives way to it, as above.
     */
    fits?: ContentFit;
  } = {},
): SidebarLayout {
  if (fits) return fittedLayout(width, height, { showDate, showEvents, eventRows, fits });
  const wide = width >= WIDE_MIN_WIDTH && width >= height * 1.15;
  const side = wide ? 48 : 20;
  const dateNumeral = wide ? 56 : 40;
  const dateHeight = dateBlockHeight(dateNumeral);

  // Short wide screens: fewer rows, so the list never reaches the date.
  const room = height - SIDEBAR_TOP - SIDEBAR_BOTTOM - dateHeight - DATE_GAP;
  const fit = Math.floor((room - listBlockHeight(0)) / SIDEBAR_ROW);
  const rows = Math.max(1, wide ? Math.min(eventRows, fit) : eventRows);

  // Neither depends on showDate / showEvents, so the content never moves.
  let main: Insets;
  if (wide) {
    const reach = Math.max(side + PANEL_MIN + SIDEBAR_GAP, Math.round(width * OPEN_MARGIN));
    main = { left: reach, right: reach, top: SIDEBAR_TOP, bottom: SIDEBAR_BOTTOM };
  } else {
    main = {
      left: side,
      right: side,
      top: SIDEBAR_TOP + dateHeight + NARROW_GAP,
      bottom: SIDEBAR_BOTTOM + listBlockHeight(rows) + NARROW_GAP,
    };
  }

  return {
    width,
    height,
    wide,
    side,
    dateNumeral,
    eventRows: rows,
    showDate,
    showEvents,
    main,
    top: SIDEBAR_TOP,
    bottom: SIDEBAR_BOTTOM,
  };
}

/** How the content measures its room, and the shares of `main`'s width it wants. */
export type ContentFit = {
  share: (main: Insets) => number;
  /** Wanted: keep the list only while the content gets this much… */
  ideal: number;
  /** …or, failing every list layout, at least this much (else the list goes). */
  least: number;
};

/** One way to lay out the panel, tried in order until one fits. */
type Plan = { rows: number; numeral: number; date: boolean; list: boolean };

function fittedLayout(
  width: number,
  height: number,
  {
    showDate,
    showEvents,
    eventRows,
    fits,
  }: {
    showDate: boolean;
    showEvents: boolean;
    eventRows: number;
    fits: ContentFit;
  },
): SidebarLayout {
  const wide = width >= WIDE_MIN_WIDTH && width >= height * 1.15;
  const side = wide ? 48 : 20;
  // The corner controls' bands: as before on tall screens, tighter on short ones.
  const top = clamp(Math.round(height * 0.09), BAND_MIN, SIDEBAR_TOP);
  const bottom = clamp(Math.round(height * 0.095), BAND_MIN, SIDEBAR_BOTTOM);
  const full = wide ? NUMERAL_WIDE : NUMERAL_NARROW;

  // In order of preference: everything, then fewer rows, a smaller date,
  // no list, and last of all no date.
  const plans: Plan[] = [];
  for (let rows = Math.max(1, eventRows); rows >= 1; rows--) {
    plans.push({ rows, numeral: full, date: true, list: true });
  }
  plans.push({ rows: 1, numeral: NUMERAL_SMALL, date: true, list: true });
  plans.push({ rows: 1, numeral: full, date: true, list: false });
  plans.push({ rows: 1, numeral: NUMERAL_SMALL, date: true, list: false });
  plans.push({ rows: 1, numeral: full, date: false, list: false });

  const mainFor = (plan: Plan): Insets => {
    if (wide) {
      const reach = Math.max(side + PANEL_MIN + SIDEBAR_GAP, Math.round(width * OPEN_MARGIN));
      return { left: reach, right: reach, top, bottom };
    }
    return {
      left: side,
      right: side,
      top: top + (plan.date ? dateBlockHeight(plan.numeral) + NARROW_GAP : 0),
      bottom: bottom + (plan.list ? listBlockHeight(plan.rows) + NARROW_GAP : 0),
    };
  };
  // Wide: the panel's halves share the height beside the content, and never meet.
  const panelFits = (plan: Plan) => {
    if (!wide) return true;
    const room = height - top - bottom;
    const date = plan.date ? dateBlockHeight(plan.numeral) : 0;
    const list = plan.list ? listBlockHeight(plan.rows) : 0;
    return date + list + (plan.date && plan.list ? DATE_GAP : 0) <= room;
  };

  // Wide, the content's area doesn't depend on the panel: only its halves must fit.
  // Narrow, the list stays while the content keeps `ideal` (or failing that,
  // `least`) of the width; only then does it go, so the content gets `ideal`.
  const share = (p: Plan) => fits.share(mainFor(p));
  const withList = plans.filter((p) => p.list);
  const without = plans.filter((p) => !p.list);
  const plan = wide
    ? (plans.find(panelFits) ?? plans[plans.length - 1])
    : (withList.find((p) => share(p) >= fits.ideal) ??
      withList.find((p) => share(p) >= fits.least) ??
      without.find((p) => share(p) >= fits.ideal) ??
      without.find((p) => share(p) >= fits.least) ??
      plans[plans.length - 1]);
  return {
    width,
    height,
    wide,
    side,
    dateNumeral: plan.numeral,
    eventRows: plan.rows,
    showDate: showDate && plan.date,
    showEvents: showEvents && plan.list,
    main: mainFor(plan),
    top,
    bottom,
  };
}

/**
 * The most the panel may widen to without coming nearer the content than
 * SIDEBAR_GAP, for content this wide (centred in `main`). Narrow: the page
 * width less its sides.
 */
export function panelMaxWidth(layout: SidebarLayout, contentWidth: number) {
  if (!layout.wide) return layout.width - layout.side * 2;
  const beside = (layout.width - contentWidth) / 2 - SIDEBAR_GAP - layout.side;
  return Math.max(PANEL_MIN, Math.floor(beside));
}
