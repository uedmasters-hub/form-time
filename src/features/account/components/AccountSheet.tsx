import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton, TextButton } from '@/components/Buttons';
import { QuietIconButton } from '@/components/QuietIconButton';
import { Sheet, SheetSwitch } from '@/components/Sheet';
import { useEvents } from '@/features/events/EventsProvider';
import { useSettings } from '@/features/settings/SettingsProvider';

import { useAccount, type SheetMode } from '../AccountProvider';
import { AuthError } from '../auth-api';

const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Signing in, creating an account, and the email-link steps around them —
 * one quiet sheet. Signed out, nothing here is required: FORM / TIME keeps
 * working on this device.
 */
export function AccountSheet() {
  const { sheet, closeSheet, openSheet, state, signIn, signUp, recover, setNewPassword } =
    useAccount();
  const { keepDeviceItems } = useAccount();
  const { items } = useEvents();
  const { uiTheme: ui } = useSettings();

  const mode: SheetMode = sheet?.mode ?? 'sign-in';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [keep, setKeep] = useState(true);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Fresh form each time the sheet opens or changes step.
  useEffect(() => {
    if (!sheet) return;
    setEmail((current) => sheet.email ?? current);
    setPassword('');
    setReveal(false);
    setError(null);
    setSent(false);
    setBusy(false);
    setKeep(true);
    keepDeviceItems.current = true;
    const target = sheet.mode === 'new-password' || sheet.email ? passwordRef : emailRef;
    const t = setTimeout(() => target.current?.focus(), 260);
    return () => clearTimeout(t);
  }, [sheet, keepDeviceItems]);

  const go = (next: SheetMode) => openSheet({ mode: next, email: email.trim() || undefined });

  const signedOut = state.status === 'signed-out';
  const deviceItems = signedOut && !state.ended ? items.length : 0;

  const fail = (e: unknown) => {
    setError(e instanceof AuthError || e instanceof Error ? e.message : 'Something went wrong.');
    setBusy(false);
  };

  const submit = async () => {
    if (busy) return;
    const address = email.trim();
    const needsEmail = mode === 'sign-in' || mode === 'sign-up' || mode === 'forgot';
    if (needsEmail && !EMAIL.test(address)) {
      setError('Enter your email address.');
      emailRef.current?.focus();
      return;
    }
    if (
      (mode === 'sign-in' && !password) ||
      ((mode === 'sign-up' || mode === 'new-password') && password.length < MIN_PASSWORD)
    ) {
      setError(
        mode === 'sign-in' ? 'Enter your password.' : `Use at least ${MIN_PASSWORD} characters.`,
      );
      passwordRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    keepDeviceItems.current = keep;
    try {
      if (mode === 'sign-in') {
        await signIn(address, password);
        closeSheet();
      } else if (mode === 'sign-up') {
        const result = await signUp(address, password);
        if (result === 'confirm') openSheet({ mode: 'check-email', email: address });
        else closeSheet();
      } else if (mode === 'forgot') {
        await recover(address);
        setSent(true);
        setBusy(false);
      } else if (mode === 'new-password') {
        await setNewPassword(password);
        openSheet({ mode: 'welcome', email: address, message: 'Your password is changed.' });
      }
    } catch (e) {
      fail(e);
    }
  };

  const title =
    mode === 'check-email'
      ? 'Check your inbox'
      : mode === 'forgot'
        ? 'Reset password'
        : mode === 'new-password'
          ? 'New password'
          : mode === 'welcome'
            ? 'You’re signed in'
            : mode === 'link-error'
              ? 'That link didn’t work'
              : 'Account';

  const busyLabel: Partial<Record<SheetMode, string>> = {
    'sign-in': 'Signing in…',
    'sign-up': 'Creating account…',
    forgot: 'Sending…',
    'new-password': 'Saving…',
  };
  const actionLabel: Partial<Record<SheetMode, string>> = {
    'sign-in': 'Sign in',
    'sign-up': 'Create account',
    forgot: 'Send reset link',
    'new-password': 'Save password',
  };

  const body = () => {
    switch (mode) {
      case 'check-email':
        return (
          <>
            <Mark />
            <Text style={[styles.lead, { color: ui.ink }]}>
              We sent a link to {sheet?.email ?? 'your inbox'}.
            </Text>
            <Text style={[styles.note, { color: ui.muted }]}>
              Open it on this device to finish creating your account. It can take a minute to arrive
              — check spam if it doesn’t.
            </Text>
            <View style={styles.row}>
              <TextButton label="Back to sign in" tone="muted" onPress={() => go('sign-in')} />
              <PrimaryButton label="Done" onPress={closeSheet} />
            </View>
          </>
        );
      case 'welcome':
        return (
          <>
            <Mark />
            {sheet?.message ? (
              <Text style={[styles.lead, { color: ui.ink }]}>{sheet.message}</Text>
            ) : null}
            <Text style={[styles.lead, { color: ui.ink }]}>
              Signed in as {sheet?.email ?? 'your account'}.
            </Text>
            <Text style={[styles.note, { color: ui.muted }]}>
              Your events, notes, reminders and settings now sync with your account.
            </Text>
            <View style={[styles.row, styles.end]}>
              <PrimaryButton label="Done" onPress={closeSheet} />
            </View>
          </>
        );
      case 'link-error':
        return (
          <>
            <Text style={[styles.lead, { color: ui.ink }]} role="alert">
              {sheet?.message ?? 'That link didn’t work.'}
            </Text>
            <View style={styles.row}>
              <TextButton label="Close" tone="muted" onPress={closeSheet} />
              <PrimaryButton label="Sign in" onPress={() => go('sign-in')} />
            </View>
          </>
        );
      default:
        return (
          <>
            {mode === 'sign-in' || mode === 'sign-up' ? (
              <>
                <Tabs mode={mode} onChange={(next) => go(next)} />
                <Text style={[styles.note, { color: ui.muted, marginTop: 14 }]}>
                  Keep your events, notes and settings on every device. They’re private to your
                  account.
                </Text>
              </>
            ) : mode === 'forgot' ? (
              <Text style={[styles.note, { color: ui.muted }]}>
                We’ll email you a link to choose a new password.
              </Text>
            ) : (
              <Text style={[styles.note, { color: ui.muted }]}>
                Choose a new password for {sheet?.email ?? 'your account'}.
              </Text>
            )}

            {mode !== 'new-password' ? (
              <Field
                ref={emailRef}
                label="Email"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError(null);
                  setSent(false);
                }}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                returnKeyType={mode === 'forgot' ? 'send' : 'next'}
                onSubmitEditing={() =>
                  mode === 'forgot' ? void submit() : passwordRef.current?.focus()
                }
              />
            ) : null}

            {mode !== 'forgot' ? (
              <Field
                ref={passwordRef}
                label={mode === 'new-password' ? 'New password' : 'Password'}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError(null);
                }}
                secure={!reveal}
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                hint={mode === 'sign-in' ? undefined : `At least ${MIN_PASSWORD} characters`}
                accessory={
                  <QuietIconButton
                    icon={reveal ? EyeOff : Eye}
                    label={reveal ? 'Hide password' : 'Show password'}
                    onPress={() => setReveal((r) => !r)}
                    iconSize={18}
                    restOpacity={0.6}
                    touchRestOpacity={0.7}
                  />
                }
              />
            ) : null}

            {deviceItems > 0 && (mode === 'sign-in' || mode === 'sign-up') ? (
              <View style={styles.keep}>
                <SheetSwitch
                  label={`Bring ${deviceItems} ${deviceItems === 1 ? 'item' : 'items'} from this device`}
                  detail="They join your account. Off: they stay out of it and leave this device."
                  value={keep}
                  onChange={setKeep}
                  first
                />
              </View>
            ) : null}

            {error ? (
              <Text style={[styles.error, { color: ui.accent }]} role="alert">
                {error}
              </Text>
            ) : null}
            {sent ? (
              <Text style={[styles.lead, { color: ui.ink }]} role="status">
                If there’s an account for {email.trim()}, a reset link is on its way. Open it on
                this device.
              </Text>
            ) : null}

            <View style={styles.action}>
              <PrimaryButton
                label={busy ? (busyLabel[mode] ?? '…') : (actionLabel[mode] ?? 'Continue')}
                busy={busy}
                stretch
                onPress={() => void submit()}
              />
            </View>

            {mode === 'sign-in' ? (
              <View style={styles.center}>
                <TextButton label="Forgot password?" tone="muted" onPress={() => go('forgot')} />
              </View>
            ) : mode === 'forgot' ? (
              <View style={styles.center}>
                <TextButton label="Back to sign in" tone="muted" onPress={() => go('sign-in')} />
              </View>
            ) : null}
          </>
        );
    }
  };

  return (
    <Sheet visible={sheet !== null} onClose={closeSheet} title={title} anchor="center">
      {body()}
    </Sheet>
  );
}

/** Sign in | Create account, with a short bar under the chosen one. */
function Tabs({
  mode,
  onChange,
}: {
  mode: 'sign-in' | 'sign-up';
  onChange: (mode: 'sign-in' | 'sign-up') => void;
}) {
  const { uiTheme: ui } = useSettings();
  return (
    <View role="tablist" style={[styles.tabs, { borderColor: ui.hairline }]}>
      {(
        [
          ['sign-in', 'Sign in'],
          ['sign-up', 'Create account'],
        ] as const
      ).map(([id, label]) => {
        const selected = mode === id;
        return (
          <Pressable
            key={id}
            role="tab"
            aria-selected={selected}
            accessibilityLabel={label}
            onPress={() => onChange(id)}
            style={({ hovered }) => [styles.tab, hovered && !selected && { opacity: 0.8 }]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: selected ? ui.ink : ui.muted, fontWeight: selected ? '600' : '400' },
              ]}
            >
              {label}
            </Text>
            <View
              style={[styles.tabBar, { backgroundColor: selected ? ui.accent : 'transparent' }]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

type FieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  secure?: boolean;
  hint?: string;
  accessory?: ReactNode;
};

/** A labelled line to write on, like the composer's. */
const Field = ({
  ref,
  label,
  secure = false,
  hint,
  accessory,
  style,
  ...input
}: FieldProps & { ref?: Ref<TextInput> }) => {
  const { uiTheme: ui } = useSettings();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: focused ? ui.accent : ui.muted }]}>
        {label.toLocaleUpperCase()}
      </Text>
      <View style={[styles.line, { borderColor: focused ? ui.ink : ui.hairline }]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          secureTextEntry={secure}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholderTextColor={ui.muted}
          submitBehavior="submit"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { color: ui.ink }, style]}
          {...input}
        />
        {accessory}
      </View>
      {hint ? <Text style={[styles.hint, { color: ui.muted }]}>{hint}</Text> : null}
    </View>
  );
};

/** Three primitives: a quiet sign that this step is done. */
function Mark() {
  const { uiTheme: ui } = useSettings();
  return (
    <View style={styles.mark} aria-hidden>
      <View style={[styles.markCircle, { backgroundColor: ui.accent }]} />
      <View style={[styles.markSquare, { backgroundColor: ui.ink }]} />
      <View style={[styles.markBar, { backgroundColor: ui.lume }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 22, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingTop: 6 },
  tabLabel: { fontSize: 15, paddingBottom: 8 },
  tabBar: { height: 2, width: 22, marginBottom: -StyleSheet.hairlineWidth },
  lead: { fontSize: 15, lineHeight: 22, marginTop: 10 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  field: { marginTop: 20 },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 1.4 },
  line: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, marginTop: 2 },
  input: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 10,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  hint: { fontSize: 12, marginTop: 6 },
  keep: { marginTop: 18 },
  error: { fontSize: 13, lineHeight: 18, marginTop: 14 },
  action: { marginTop: 24 },
  center: { alignItems: 'center', marginTop: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
  },
  end: { justifyContent: 'flex-end' },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  markCircle: { width: 14, height: 14, borderRadius: 7 },
  markSquare: { width: 12, height: 12 },
  markBar: { width: 22, height: 6 },
});
