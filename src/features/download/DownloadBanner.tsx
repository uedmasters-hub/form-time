import { Download, Monitor, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuietIconButton } from '@/components/QuietIconButton';
import { useSettings } from '@/features/settings/SettingsProvider';
import { readJSON, writeJSON } from '@/lib/device-storage';

import {
  desktopOS,
  macChip,
  offerFor,
  otherOS,
  type DesktopOS,
  type DownloadItem,
  type DownloadKind,
  type MacChip,
} from './desktop-download';

/** Wide windows only: narrower, the calendar's month title reaches this corner. */
const MIN_WIDTH = 1024;
/**
 * Below this width the month title also reaches the note when the window is
 * short (it moves up and left): there the note needs at least SHORT_HEIGHT.
 */
const ROOMY_WIDTH = 1100;
const SHORT_HEIGHT = 620;
const EDGE = 16;
const KEY = 'formtime.download.v2';
/** v1 knew only the app: { dismissed?, downloaded? }. */
const KEY_V1 = 'formtime.download.v1';

type Stored = { dismissed?: boolean; app?: boolean; screensaver?: boolean };

function loadStored(): Stored {
  const v2 = readJSON<Stored>(KEY);
  if (v2) return v2;
  const v1 = readJSON<{ dismissed?: boolean; downloaded?: boolean }>(KEY_V1);
  return { dismissed: v1?.dismissed, app: v1?.downloaded };
}

/** Only on the website: not in the desktop app (app://), not on native. */
function onWebsite(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    /^https?:$/.test(window.location.protocol)
  );
}

/**
 * A small floating note in the top-left corner offering FORM / TIME for
 * this computer, straight from the latest release: the desktop app first
 * (the Mac build for its chip, or Windows), then, quieter, the screensaver.
 * A line at the foot switches to the other system's downloads, for someone
 * getting it for another computer.
 *
 * One click downloads, and the line beneath says how to open it the first
 * time. Once both are downloaded, or the note is closed (✕), it doesn't
 * come back in this browser; download one, and next time it offers the other.
 */
export function DownloadBanner() {
  const { uiTheme: ui } = useSettings();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [device, setDevice] = useState<{ os: DesktopOS; chip: MacChip } | null>(null);
  /** Which system's downloads are shown: this computer's, or the other one's. */
  const [shown, setShown] = useState<DesktopOS | null>(null);
  const [stored, setStored] = useState<Stored>({});
  /** Clicked in this visit: shows that item's first-open tip. */
  const [clicked, setClicked] = useState<Partial<Record<DownloadKind, boolean>>>({});
  const [hidden, setHidden] = useState(false);

  // After mount: the static render has no browser to ask.
  useEffect(() => {
    if (!onWebsite()) return;
    const saved = loadStored();
    if (saved.dismissed || (saved.app && saved.screensaver)) return;
    const os = desktopOS(navigator.userAgent, navigator.platform);
    if (!os) return;
    let live = true;
    void (os === 'mac' ? macChip() : Promise.resolve<MacChip>('unknown')).then((chip) => {
      if (!live) return;
      setStored(saved);
      setDevice({ os, chip });
      setShown(os);
    });
    return () => {
      live = false;
    };
  }, []);

  const tooSmall = width < MIN_WIDTH || (width < ROOMY_WIDTH && height < SHORT_HEIGHT);
  if (!device || !shown || hidden || tooSmall) return null;

  const offer = offerFor(shown, device.chip);
  const ownDevice = shown === device.os;
  // For this computer, what was downloaded on an earlier visit isn't offered
  // again (unless it was clicked in this visit, so its tip stays in view).
  const items = offer.items.filter(
    (item) => !ownDevice || clicked[item.kind] || !stored[item.kind],
  );
  const [primary, secondary] = items;
  if (!primary) return null;

  const save = (next: Stored) => {
    writeJSON(KEY, next);
    setStored(next);
  };
  const close = () => {
    save({ ...stored, dismissed: true });
    setHidden(true);
  };
  const downloaded = (kind: DownloadKind) => {
    setClicked((c) => ({ ...c, [kind]: true }));
    if (ownDevice) save({ ...stored, [kind]: true });
  };
  const link = (url: string) =>
    ({ href: url, hrefAttrs: { rel: 'noopener', download: true } }) as object;
  const what = (item: DownloadItem) => (item.kind === 'app' ? 'app' : 'screensaver');
  const other = otherOS(shown);
  const otherName = other === 'mac' ? 'Mac' : 'Windows';

  return (
    <View
      role="region"
      accessibilityLabel={`FORM / TIME for ${offer.name}`}
      style={[
        styles.card,
        ui.flat ? styles.flat : styles.raised,
        {
          top: insets.top + EDGE,
          left: insets.left + EDGE,
          backgroundColor: ui.surface,
          borderColor: ui.hairline,
        },
      ]}
    >
      {/* The app (or, if that's already downloaded, the screensaver): the one clear action. */}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Download the FORM / TIME ${what(primary)} for ${offer.name}, ${primary.detail}`}
          onPress={() => downloaded(primary.kind)}
          style={({ hovered }) => [styles.main, { opacity: hovered ? 1 : 0.86 }]}
          {...link(primary.url)}
        >
          <Download size={15} color={ui.ink} strokeWidth={1.5} />
          <Text style={[styles.mainText, { color: ui.ink }]}>
            {`Get the ${offer.name} ${what(primary)}`}
          </Text>
        </Pressable>
        <QuietIconButton icon={X} label="Hide" onPress={close} iconSize={14} style={styles.close} />
      </View>
      <Detail
        item={primary}
        clicked={!!clicked[primary.kind]}
        muted={ui.muted}
        onAlternate={downloaded}
        link={link}
      />

      {/* The screensaver: a quieter second row. */}
      {secondary ? (
        <>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Download the FORM / TIME screensaver for ${offer.name}, ${secondary.detail}`}
            onPress={() => downloaded(secondary.kind)}
            style={styles.second}
            {...link(secondary.url)}
          >
            {({ hovered }: { hovered?: boolean }) => (
              <>
                <Monitor size={13} color={hovered ? ui.ink : ui.muted} strokeWidth={1.5} />
                <Text style={[styles.secondText, { color: hovered ? ui.ink : ui.muted }]}>
                  {secondary.title}
                </Text>
              </>
            )}
          </Pressable>
          <Detail
            item={secondary}
            clicked={!!clicked[secondary.kind]}
            muted={ui.muted}
            onAlternate={downloaded}
            link={link}
          />
        </>
      ) : null}

      {/* The other system, said quietly. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Show the downloads for ${otherName}`}
        onPress={() => setShown(other)}
        style={[styles.footer, { borderTopColor: ui.hairline }]}
      >
        {({ hovered }: { hovered?: boolean }) => (
          <Text
            style={[styles.footerText, { color: ui.muted }, hovered ? styles.footerHover : null]}
          >
            {other === device.os ? `Back to ${otherName}` : `Also for ${otherName}`}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

/** The line under a download: its detail (and the other Mac build), or, once clicked, how to open it. */
function Detail({
  item,
  clicked,
  muted,
  onAlternate,
  link,
}: {
  item: DownloadItem;
  clicked: boolean;
  muted: string;
  onAlternate: (kind: DownloadKind) => void;
  link: (url: string) => object;
}) {
  if (clicked) {
    return (
      <Text style={[styles.note, { color: muted }]} aria-live="polite">
        {item.firstOpen}
      </Text>
    );
  }
  return (
    <Text style={[styles.note, { color: muted }]}>
      {item.detail}
      {item.alternate ? (
        <>
          {'  ·  '}
          <Text
            accessibilityRole="link"
            accessibilityLabel={`Download FORM / TIME for ${item.alternate.label}`}
            onPress={() => onAlternate(item.kind)}
            style={styles.alt}
            {...link(item.alternate.url)}
          >
            {item.alternate.label}
          </Text>
        </>
      ) : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: 252,
    paddingLeft: 14,
    paddingRight: 2,
    paddingTop: 6,
    paddingBottom: 4,
    borderRadius: 14,
  },
  /** Flat: a crisp 1 pt edge stands in for the shadow (as the reminder cards). */
  flat: { borderWidth: 1 },
  raised: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  main: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  mainText: {
    fontSize: 13,
    fontWeight: '500',
  },
  /** The full 44 pt target, without making the card taller. */
  close: {
    marginVertical: -10,
  },
  note: {
    fontSize: 11,
    lineHeight: 15,
    // Under the title, past its icon.
    paddingLeft: 23,
    paddingRight: 12,
    paddingBottom: 4,
  },
  alt: {
    textDecorationLine: 'underline',
  },
  second: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 6,
    paddingVertical: 4,
    paddingLeft: 1,
    paddingRight: 12,
  },
  secondText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    alignSelf: 'stretch',
    marginTop: 6,
    marginRight: 12,
    paddingTop: 7,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    fontSize: 11,
    lineHeight: 15,
  },
  footerHover: {
    textDecorationLine: 'underline',
  },
});
