/**
 * Which desktop app to offer this visitor, if any.
 *
 * The installers live on the repo's GitHub releases. "latest/download/<name>"
 * always points at the newest release, so the links never need changing:
 * every release carries the same three file names.
 */
const RELEASES = 'https://github.com/uedmasters-hub/form-time/releases';
const LATEST = `${RELEASES}/latest/download`;

export type DesktopOS = 'mac' | 'windows';
export type MacChip = 'apple' | 'intel' | 'unknown';

export type DesktopOffer = {
  os: DesktopOS;
  /** e.g. "Mac" / "Windows" */
  name: string;
  /** e.g. "Apple silicon", "64-bit" */
  detail: string;
  url: string;
  /** The other Mac build, when the chip can't be told for sure. */
  alternate?: { label: string; url: string };
  /** What to do the first time it opens (the builds aren't notarised / signed yet). */
  firstOpen: string;
};

export const DOWNLOADS = {
  macApple: `${LATEST}/FORM-TIME-mac-AppleSilicon.zip`,
  macIntel: `${LATEST}/FORM-TIME-mac-Intel.zip`,
  windows: `${LATEST}/FORM-TIME-Setup-Windows.exe`,
  page: `${RELEASES}/latest`,
} as const;

/** The desktop system from the browser's own description of itself. */
export function desktopOS(userAgent: string, platform = ''): DesktopOS | null {
  const ua = userAgent;
  // iPads report themselves as Macs; a Mac has no touch screen.
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(ua)) return null;
  if (/Windows NT/i.test(ua) || /^Win/i.test(platform)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua) || /^Mac/i.test(platform)) return 'mac';
  return null;
}

/**
 * Apple silicon or Intel, where the browser says (Chrome, Edge, Brave and
 * other Chromium browsers do, through client hints); Safari and Firefox
 * don't, so that stays 'unknown'.
 */
export async function macChip(): Promise<MacChip> {
  const uaData = (
    navigator as Navigator & {
      userAgentData?: {
        getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
      };
    }
  ).userAgentData;
  try {
    const values = await uaData?.getHighEntropyValues?.(['architecture']);
    if (values?.architecture === 'arm') return 'apple';
    if (values?.architecture === 'x86') return 'intel';
  } catch {
    // not available
  }
  return 'unknown';
}

const MAC_FIRST_OPEN =
  'Unzip, move it to Applications and open it. The first time, if macOS can’t verify it: System Settings → Privacy & Security → Open Anyway.';
const WINDOWS_FIRST_OPEN =
  'Run the installer. If Windows SmartScreen appears: More info → Run anyway.';

export function offerFor(os: DesktopOS, chip: MacChip): DesktopOffer {
  if (os === 'windows') {
    return {
      os,
      name: 'Windows',
      detail: '64-bit',
      url: DOWNLOADS.windows,
      firstOpen: WINDOWS_FIRST_OPEN,
    };
  }
  if (chip === 'intel') {
    return {
      os,
      name: 'Mac',
      detail: 'Intel',
      url: DOWNLOADS.macIntel,
      firstOpen: MAC_FIRST_OPEN,
    };
  }
  // Apple silicon: every Mac sold since 2021. Intel stays one click away
  // when the browser can't tell.
  return {
    os,
    name: 'Mac',
    detail: 'Apple silicon',
    url: DOWNLOADS.macApple,
    alternate: chip === 'unknown' ? { label: 'Intel Mac', url: DOWNLOADS.macIntel } : undefined,
    firstOpen: MAC_FIRST_OPEN,
  };
}
