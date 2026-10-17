/**
 * The side panel's geometry, shared by the analog clock, the digital clock
 * and the calendar so the panel sits in exactly the same place on every
 * page. Wide screens: a column at the right edge, the date at its top and
 * the day's events and festivals at its foot. Narrow screens: the date
 * across the top and the list across the foot. Whatever the page shows (a
 * dial, the time, a month) goes in `main`, the space that's left.
 */

/** Bands kept clear for the corner controls (region code, settings, switch). */
export const SIDEBAR_TOP = 72;
export const SIDEBAR_BOTTOM = 76;
/** Wide layouts: the page's content on the left, the panel on the right. */
const WIDE_MIN_WIDTH = 720;
export const SIDEBAR_GAP = 64;
/** Space the list reserves per row and per heading. */
export const SIDEBAR_ROW = 66;
export const SIDEBAR_HEADING = 32;
/** Breathing room between the date and the list (wide) or the content (narrow). */
const DATE_GAP = 40;
const NARROW_GAP = 16;

export type Insets = { left: number; right: number; top: number; bottom: number };

export type SidebarLayout = {
  wide: boolean;
  /** Distance from the page's left and right edges. */
  side: number;
  /** The panel's width. */
  column: number;
  /** The date's large numeral. */
  dateNumeral: number;
  /** Space the date takes; 0 when it's hidden. */
  dateHeight: number;
  /** List rows that fit (each SIDEBAR_ROW tall), below its headings. */
  rows: number;
  /** Space the list takes; 0 when it's hidden. */
  listHeight: number;
  /** The most the list may grow to (wide), before it scrolls. */
  listMax: number;
  showDate: boolean;
  showEvents: boolean;
  /** Where the page's own content goes, as insets from the page's edges. */
  main: Insets;
};

/** Height of the date block (DayHeading) for a numeral this tall. */
export function dateBlockHeight(numeral: number) {
  const stroke = Math.max(3, numeral * 0.17);
  // weekday line, gap, numeral, gap, month line, second-calendar line
  return 16 + 14 + numeral + stroke * 2 + 12 + 21 + 21;
}

/** Room for the list's headings: "Up next" / "Events", and "Holidays & festivals". */
const HEADINGS = SIDEBAR_HEADING * 2;

export function sidebarLayout(
  width: number,
  height: number,
  {
    showDate = true,
    showEvents = true,
    maxRows = 4,
  }: {
    showDate?: boolean;
    showEvents?: boolean;
    /** Fewer list rows, to leave more room for what the page shows (narrow). */
    maxRows?: number;
  } = {},
): SidebarLayout {
  const wide = width >= WIDE_MIN_WIDTH && width >= height * 1.15;
  const side = wide ? 48 : 20;
  const column = wide ? Math.round(Math.min(320, Math.max(240, width * 0.24))) : width - side * 2;
  const dateNumeral = wide ? 56 : 40;
  const dateHeight = showDate ? dateBlockHeight(dateNumeral) : 0;
  const rows = Math.max(
    1,
    Math.min(
      maxRows,
      wide
        ? Math.floor(
            (height - SIDEBAR_TOP - SIDEBAR_BOTTOM - dateHeight - DATE_GAP - HEADINGS) /
              SIDEBAR_ROW,
          )
        : height < 700
          ? 2
          : 3,
    ),
  );
  const listHeight = showEvents ? HEADINGS + rows * SIDEBAR_ROW : 0;
  const listMax = Math.max(
    listHeight,
    height - SIDEBAR_TOP - SIDEBAR_BOTTOM - dateHeight - (showDate ? DATE_GAP : 0),
  );
  const shown = showDate || showEvents;

  const main: Insets = wide
    ? {
        left: side,
        right: shown ? side + column + SIDEBAR_GAP : side,
        top: SIDEBAR_TOP,
        bottom: SIDEBAR_BOTTOM,
      }
    : {
        left: side,
        right: side,
        top: SIDEBAR_TOP + (showDate ? dateHeight + NARROW_GAP : 0),
        bottom: SIDEBAR_BOTTOM + (showEvents ? listHeight + NARROW_GAP : 0),
      };

  return {
    wide,
    side,
    column,
    dateNumeral,
    dateHeight,
    rows,
    listHeight,
    listMax,
    showDate,
    showEvents,
    main,
  };
}
