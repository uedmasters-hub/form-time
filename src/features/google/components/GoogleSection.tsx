import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, TextButton } from '@/components/Buttons';
import { SheetSection } from '@/components/Sheet';
import { useSettings } from '@/features/settings/SettingsProvider';

import { useGoogleSync, type GoogleStatus } from '../GoogleSyncProvider';

/**
 * Google Calendar, in Settings: connect, see how sync stands, sync now,
 * reconnect when Google's access runs out, or disconnect. Only shown when
 * the app is set up for Google (web, with a client ID).
 */
export function GoogleSection() {
  const google = useGoogleSync();
  const { uiTheme: ui } = useSettings();
  const { available, prepare } = google;

  // Google's window must open straight from the click, so load its script first.
  useEffect(() => {
    if (available) prepare();
  }, [available, prepare]);

  if (!available) return null;

  if (!google.connected) {
    const problem = google.status.state === 'problem' ? google.status.message : null;
    return (
      <SheetSection label="Google Calendar">
        <Text style={[styles.primary, { color: ui.ink }]}>Not connected</Text>
        <Text style={[styles.secondary, { color: problem ? ui.ink : ui.muted }]} aria-live="polite">
          {problem ??
            'Sync your events and meetings both ways with your Google Calendar. Notes, follow-ups and alarms stay here.'}
        </Text>
        <View style={styles.actions}>
          <PrimaryButton
            label={google.busy ? 'Waiting for Google…' : 'Connect Google Calendar'}
            busy={google.busy}
            onPress={google.connect}
          />
        </View>
      </SheetSection>
    );
  }

  const needsReconnect = google.status.state === 'reconnect';
  return (
    <SheetSection label="Google Calendar">
      <Text style={[styles.primary, { color: ui.ink }]} numberOfLines={1}>
        {google.account || 'Connected'}
      </Text>
      <Text
        style={[
          styles.secondary,
          {
            color:
              google.status.state === 'reconnect' || google.status.state === 'problem'
                ? ui.ink
                : ui.muted,
          },
        ]}
        aria-live="polite"
      >
        {describe(google.status)}
      </Text>
      <View style={styles.actions}>
        {needsReconnect ? (
          <PrimaryButton
            label={google.busy ? 'Waiting for Google…' : 'Reconnect'}
            busy={google.busy}
            onPress={google.connect}
          />
        ) : (
          <TextButton
            label="Sync now"
            disabled={google.status.state === 'syncing'}
            onPress={google.syncNow}
          />
        )}
        <TextButton label="Disconnect" tone="muted" onPress={google.disconnect} />
      </View>
    </SheetSection>
  );
}

function describe(status: GoogleStatus): string {
  switch (status.state) {
    case 'off':
      return 'Connecting…';
    case 'syncing':
      return 'Syncing…';
    case 'synced': {
      const at = new Date(status.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const c = status.counts;
      const fromGoogle = c ? c.imported + c.updated + c.deleted : 0;
      const toGoogle = c ? c.created + c.patched + c.removed : 0;
      const moved = [
        fromGoogle ? `${fromGoogle} from Google` : '',
        toGoogle ? `${toGoogle} to Google` : '',
      ].filter(Boolean);
      return `Synced at ${at}${moved.length ? ` · ${moved.join(', ')}` : ''}`;
    }
    case 'reconnect':
    case 'problem':
      return status.message;
  }
}

const styles = StyleSheet.create({
  primary: { fontSize: 15 },
  secondary: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    flexWrap: 'wrap',
  },
});
