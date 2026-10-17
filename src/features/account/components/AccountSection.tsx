import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, TextButton } from '@/components/Buttons';
import { SheetSection } from '@/components/Sheet';
import { useEvents, type SyncStatus } from '@/features/events/EventsProvider';
import { useSettings } from '@/features/settings/SettingsProvider';

import { useAccount, type AccountSheet } from '../AccountProvider';

/**
 * The account, at the top of Settings: who's signed in and whether their
 * items have synced; or, signed out, a quiet way in.
 */
export function AccountSection({ onOpen }: { onOpen: (sheet: AccountSheet) => void }) {
  const { state, signOut } = useAccount();
  const { items, status, syncNow, flush } = useEvents();
  const { uiTheme: ui } = useSettings();
  const [confirm, setConfirm] = useState<{ unsent: number } | null>(null);
  const [checking, setChecking] = useState(false);

  if (state.status === 'loading') return null;

  const count = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;

  if (state.status === 'signed-out') {
    const ended = state.ended;
    return (
      <SheetSection label="Account">
        <View style={styles.who}>
          <Badge letter={ended?.email?.[0]} outline />
          <View style={styles.whoText}>
            <Text style={[styles.primary, { color: ui.ink }]}>
              {ended ? 'Your session ended' : 'Not signed in'}
            </Text>
            <Text style={[styles.secondary, { color: ui.muted }]}>
              {ended
                ? `Sign in again as ${ended.email} to keep syncing.`
                : 'Items stay on this device. Sign in to keep them, and your settings, in your account.'}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <PrimaryButton
            label={ended ? 'Sign in again' : 'Sign in'}
            onPress={() => onOpen({ mode: 'sign-in', email: ended?.email })}
          />
          {ended ? null : (
            <TextButton label="Create account" onPress={() => onOpen({ mode: 'sign-up' })} />
          )}
        </View>
      </SheetSection>
    );
  }

  const startSignOut = async () => {
    setChecking(true);
    const unsent = await flush();
    setChecking(false);
    setConfirm({ unsent });
  };

  return (
    <SheetSection label="Account">
      <View style={styles.who}>
        <Badge letter={state.user.email[0]} />
        <View style={styles.whoText}>
          <Text style={[styles.primary, { color: ui.ink }]} numberOfLines={1}>
            {state.user.email}
          </Text>
          <Text
            style={[styles.secondary, { color: status.state === 'problem' ? ui.ink : ui.muted }]}
            aria-live="polite"
          >
            {`${count} · ${describeSync(status)}`}
          </Text>
        </View>
      </View>

      {confirm ? (
        <View style={[styles.confirm, { borderColor: ui.hairline }]}>
          <Text style={[styles.confirmText, { color: ui.ink }]} role="alert">
            {confirm.unsent > 0
              ? `${confirm.unsent} ${confirm.unsent === 1 ? 'change hasn’t' : 'changes haven’t'} reached your account yet. Signing out removes ${confirm.unsent === 1 ? 'it' : 'them'} from this device.`
              : 'Your items stay in your account and leave this device. Settings stay as they are.'}
          </Text>
          <View style={styles.actions}>
            <TextButton label="Cancel" onPress={() => setConfirm(null)} />
            <PrimaryButton
              label={confirm.unsent > 0 ? 'Sign out anyway' : 'Sign out'}
              onPress={() => {
                setConfirm(null);
                signOut();
              }}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <TextButton label="Sync now" disabled={status.state === 'syncing'} onPress={syncNow} />
          <TextButton
            label={checking ? 'Syncing first…' : 'Sign out'}
            tone="muted"
            disabled={checking}
            onPress={() => void startSignOut()}
          />
        </View>
      )}
    </SheetSection>
  );
}

/** The account's initial in a small square; an outline when signed out. */
function Badge({ letter, outline = false }: { letter?: string; outline?: boolean }) {
  const { uiTheme: ui } = useSettings();
  return (
    <View
      aria-hidden
      style={[
        styles.badge,
        outline
          ? { borderColor: ui.hairline, borderWidth: 1.5 }
          : { backgroundColor: ui.accent, borderColor: ui.accent },
      ]}
    >
      <Text style={[styles.badgeText, { color: outline ? ui.muted : ui.surface }]}>
        {(letter ?? '').toLocaleUpperCase()}
      </Text>
    </View>
  );
}

function describeSync(status: SyncStatus): string {
  switch (status.state) {
    case 'idle':
      return 'Connecting…';
    case 'syncing':
      return 'Syncing…';
    case 'synced':
      return `Synced at ${new Date(status.at).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })}`;
    case 'device-only':
      return status.reason;
    case 'problem':
      return status.unsent > 0 ? `${status.message} (${status.unsent} waiting)` : status.message;
  }
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  whoText: { flex: 1, minWidth: 0 },
  primary: { fontSize: 15 },
  secondary: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  badge: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 15, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  confirm: { marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  confirmText: { fontSize: 13, lineHeight: 19 },
});
