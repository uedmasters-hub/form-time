/**
 * The side panel's geometry, shared by the analog clock, the digital clock
 * and the calendar. The page's own content (a dial, the time, a month) is
 * centred in `main`, which never depends on the panel: showing or hiding
 * it moves and resizes nothing. Wide screens: `main` is centred on the
 * page, and the panel floats in the space beside it, the date at the top
 * right and the day's events and festivals at the bottom right, as wide as
 * its content needs. Narrow screens: the date across the top and the list
 * across the foot, in bands that are always kept.
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

export function sidebarLayout(
  width: number,
  height: number,
  {
    showDate = true,
    showEvents = true,
    eventRows = 3,
  }: {
    showDate?: boolean;
    showEvents?: boolean;
    /** Events to show before scrolling (fewer when the screen is short). */
    eventRows?: number;
  } = {},
): SidebarLayout {
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
