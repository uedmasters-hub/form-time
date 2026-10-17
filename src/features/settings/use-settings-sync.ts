import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAccount } from '@/features/account/AccountProvider';

import type { Settings } from './settings';
import { pullSettings, pushSettings, reconcile, type SettingsMeta } from './settings-sync';

const PERIODIC_MS = 5 * 60_000;
const PUSH_DELAY_MS = 800;

/**
 * Keeps this device's settings and the account's in step while signed in:
 * on sign-in, on return to the app, every few minutes, and shortly after
 * each change here. Problems are left quiet — the next round tries again,
 * and the account section reports connection trouble.
 */
export function useSettingsSync({
  settings,
  meta,
  apply,
  setOwner,
}: {
  settings: Settings;
  meta: SettingsMeta;
  /** Takes the account's settings (and their time) as this device's. */
  apply: (settings: Settings, updatedAt: string, owner: string) => void;
  setOwner: (owner: string | null) => void;
}) {
  const { state, user, rest } = useAccount();
  const userId = user?.id ?? null;
  const latest = useRef({ settings, meta });
  useEffect(() => {
    latest.current = { settings, meta };
  });
  /** The settings time the account is known to hold. */
  const synced = useRef<string | null>(null);

  const round = useCallback(async () => {
    if (!rest || !userId) return;
    try {
      const remote = await pullSettings(rest);
      const { settings: local, meta: localMeta } = latest.current;
      const result = reconcile(localMeta, remote, userId);
      if (result.action === 'apply') {
        synced.current = result.updatedAt;
        apply(result.settings, result.updatedAt, userId);
        return;
      }
      if (result.action === 'push') await pushSettings(rest, local, localMeta.updatedAt);
      synced.current = localMeta.updatedAt;
      if (localMeta.owner !== userId) setOwner(userId);
    } catch {
      // Offline or not set up yet: the next round tries again.
    }
  }, [rest, userId, apply, setOwner]);

  // Signed in (or switched account): bring the two in step.
  const ended = state.status === 'signed-out' ? state.ended : null;
  useEffect(() => {
    if (state.status === 'loading') return;
    if (userId) {
      synced.current = null;
      void round();
    } else if (!ended && latest.current.meta.owner !== null) {
      // Signed out: the next sign-in takes the account's settings again.
      setOwner(null);
    }
  }, [state.status, userId, ended, round, setOwner]);

  // A change made here reaches the account shortly after.
  useEffect(() => {
    if (!rest || !userId || meta.owner !== userId || synced.current === meta.updatedAt) return;
    const timer = setTimeout(() => {
      const { settings: local, meta: localMeta } = latest.current;
      pushSettings(rest, local, localMeta.updatedAt)
        .then(() => {
          synced.current = localMeta.updatedAt;
        })
        .catch(() => {});
    }, PUSH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [rest, userId, meta.owner, meta.updatedAt]);

  // Changes made on other devices: on return to the app, and every few minutes.
  useEffect(() => {
    if (!rest || !userId) return;
    const interval = setInterval(() => void round(), PERIODIC_MS);
    const app = AppState.addEventListener('change', (next) => {
      if (next === 'active') void round();
    });
    return () => {
      clearInterval(interval);
      app.remove();
    };
  }, [rest, userId, round]);
}
