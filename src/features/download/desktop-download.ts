/**
 * What to offer this visitor to download, if anything: the desktop app and
 * the screensaver, for their Mac (Apple silicon or Intel) or Windows PC.
 *
 * The files live on the repo's GitHub releases. "latest/download/<name>"
 * always points at the newest release, so the links never need changing:
 * every release carries the same file names. (The screensavers are added to
 * the latest release by the Screensavers workflow on feat/desktop.)
 */
const RELEASES = 'https://github.com/uedmasters-hub/form-time/releases';
const LATEST = `${RELEASES}/latest/download`;

export type DesktopOS = 'mac' | 'windows';
export type MacChip = 'apple' | 'intel' | 'unknown';
export type DownloadKind = 'app' | 'screensaver';

export type DownloadItem = {
  kind: DownloadKind;
  /** e.g. "Mac app", "Screensaver" */
  title: string;
  /** e.g. "Apple silicon", "64-bit", "Every Mac" */
  detail: string;
  url: string;
  /** The other Mac build, when the chip can't be told for sure. */
  alternate?: { label: string; url: string };
  /** What to do the first time it opens (the builds aren't notarised / signed yet). */
  firstOpen: string;
};

export type DesktopOffer = {
  os: DesktopOS;
  /** "Mac" / "Windows" */
  name: string;
  /** The app first, then the screensaver. */
  items: DownloadItem[];
};

export const DOWNLOADS = {
  macApple: `${LATEST}/FORM-TIME-mac-AppleSilicon.zip`,
  macIntel: `${LATEST}/FORM-TIME-mac-Intel.zip`,
  windows: `${LATEST}/FORM-TIME-Setup-Windows.exe`,
  /** One build for every Mac (universal). */
  macScreensaver: `${LATEST}/FORM-TIME-Screensaver-mac.zip`,
  windowsScreensaver: `${LATEST}/FORM-TIME-Screensaver-Windows.zip`,
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

/** The other system: offered quietly, for someone downloading for another computer. */
export function otherOS(os: DesktopOS): DesktopOS {
  return os === 'mac' ? 'windows' : 'mac';
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

const MAC_APP_FIRST_OPEN =
  'Unzip, move it to Applications and open it. The first time, if macOS can’t verify it: System Settings → Privacy & Security → Open Anyway.';
const MAC_SAVER_FIRST_OPEN =
  'Unzip and double-click FORM TIME.saver. If macOS can’t verify it: System Settings → Privacy & Security → Open Anyway. Then choose it in Screen Saver.';
const WINDOWS_APP_FIRST_OPEN =
  'Run the installer. If Windows SmartScreen appears: More info → Run anyway.';
const WINDOWS_SAVER_FIRST_OPEN =
  'Extract the zip, then run install.cmd in it. If SmartScreen appears: More info → Run anyway.';

function macApp(chip: MacChip): DownloadItem {
  if (chip === 'intel') {
    return {
      kind: 'app',
      title: 'Mac app',
      detail: 'Intel',
      url: DOWNLOADS.macIntel,
      firstOpen: MAC_APP_FIRST_OPEN,
    };
  }
  // Apple silicon: every Mac sold since 2021. Intel stays one click away
  // when the browser can't tell.
  return {
    kind: 'app',
    title: 'Mac app',
    detail: 'Apple silicon',
    url: DOWNLOADS.macApple,
    alternate: chip === 'unknown' ? { label: 'Intel Mac', url: DOWNLOADS.macIntel } : undefined,
    firstOpen: MAC_APP_FIRST_OPEN,
  };
}

/** The downloads for this system: its app first, then its screensaver. */
export function offerFor(os: DesktopOS, chip: MacChip): DesktopOffer {
  if (os === 'windows') {
    return {
      os,
      name: 'Windows',
      items: [
        {
          kind: 'app',
          title: 'Windows app',
          detail: '64-bit',
          url: DOWNLOADS.windows,
          firstOpen: WINDOWS_APP_FIRST_OPEN,
        },
        {
          kind: 'screensaver',
          title: 'Screensaver',
          detail: 'Windows 10 and 11',
          url: DOWNLOADS.windowsScreensaver,
          firstOpen: WINDOWS_SAVER_FIRST_OPEN,
        },
      ],
    };
  }
  return {
    os,
    name: 'Mac',
    items: [
      macApp(chip),
      {
        kind: 'screensaver',
        title: 'Screensaver',
        // One universal build, so no chip to choose.
        detail: 'Apple silicon and Intel',
        url: DOWNLOADS.macScreensaver,
        firstOpen: MAC_SAVER_FIRST_OPEN,
      },
    ],
  };
}
