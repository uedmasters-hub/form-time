import { Download, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuietIconButton } from '@/components/QuietIconButton';
import { useSettings } from '@/features/settings/SettingsProvider';
import { readJSON, writeJSON } from '@/lib/device-storage';

import { desktopOS, macChip, offerFor, type DesktopOffer } from './desktop-download';

/** Wide windows only: narrower, the calendar's month title reaches this corner. */
const MIN_WIDTH = 1024;
const EDGE = 16;
const KEY = 'formtime.download.v1';

type Stored = { dismissed?: boolean; downloaded?: boolean };

/** Only on the website: not in the desktop app (app://), not on native. */
function onWebsite(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    /^https?:$/.test(window.location.protocol)
  );
}

/**
 * A small floating note in the top-left corner offering the desktop app
 * for this computer — the Mac (Apple silicon or Intel) or Windows build —
 * straight from the latest release. One click downloads; then it says how
 * to open it the first time. Dismissed (✕) or downloaded, it doesn't come
 * back on this browser.
 */
export function DownloadBanner() {
  const { uiTheme: ui } = useSettings();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [offer, setOffer] = useState<DesktopOffer | null>(null);
  const [clicked, setClicked] = useState(false);

  // After mount: the static render has no browser to ask.
  useEffect(() => {
    if (!onWebsite()) return;
    const stored = readJSON<Stored>(KEY);
    if (stored?.dismissed || stored?.downloaded) return;
    const os = desktopOS(navigator.userAgent, navigator.platform);
    if (!os) return;
    let live = true;
    void (os === 'mac' ? macChip() : Promise.resolve('unknown' as const)).then((chip) => {
      if (live) setOffer(offerFor(os, chip));
    });
    return () => {
      live = false;
    };
  }, []);

  if (!offer || width < MIN_WIDTH) return null;

  const close = () => {
    writeJSON(KEY, { dismissed: true, downloaded: clicked });
    setOffer(null);
  };
  const downloaded = () => {
    writeJSON(KEY, { downloaded: true });
    setClicked(true);
  };
  const link = (url: string) =>
    ({ href: url, hrefAttrs: { rel: 'noopener', download: true } }) as object;

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
      <View style={styles.row}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Download FORM / TIME for ${offer.name}, ${offer.detail}`}
          onPress={downloaded}
          style={({ hovered }) => [styles.main, { opacity: hovered ? 1 : 0.86 }]}
          {...link(offer.url)}
        >
          <Download size={15} color={ui.ink} strokeWidth={1.5} />
          <Text style={[styles.mainText, { color: ui.ink }]}>{`Get the ${offer.name} app`}</Text>
        </Pressable>
        <QuietIconButton icon={X} label="Hide" onPress={close} iconSize={14} style={styles.close} />
      </View>

      {clicked ? (
        <Text style={[styles.note, { color: ui.muted }]} aria-live="polite">
          {offer.firstOpen}
        </Text>
      ) : (
        <Text style={[styles.note, { color: ui.muted }]}>
          {offer.detail}
          {offer.alternate ? (
            <>
              {'  ·  '}
              <Text
                accessibilityRole="link"
                accessibilityLabel={`Download FORM / TIME for ${offer.alternate.label}`}
                onPress={downloaded}
                style={styles.alt}
                {...link(offer.alternate.url)}
              >
                {offer.alternate.label}
              </Text>
            </>
          ) : null}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    maxWidth: 280,
    paddingLeft: 14,
    paddingRight: 2,
    paddingVertical: 6,
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
    paddingRight: 12,
    paddingBottom: 4,
  },
  alt: {
    textDecorationLine: 'underline',
  },
});
