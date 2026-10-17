import {
  AlarmClock,
  CalendarDays,
  CornerUpRight,
  Link2,
  MapPin,
  StickyNote,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { toISODate, type CalendarDate } from '@/features/calendar/calendar-date';
import { calendarSystemFor } from '@/features/calendar/calendar-system';
import { useToday } from '@/features/calendar/use-today';
import { useSettings } from '@/features/settings/SettingsProvider';

import { guessKind, layoutFlow, type FlowState, type StepId } from '../composer-flow';
import { useEvents } from '../EventsProvider';
import {
  newId,
  parseISODate,
  parseTime,
  scheduleFor,
  timeString,
  uses12Hour,
  type WallTime,
} from '../item-time';
import { requestNotificationPermission } from '../notifications';
import { ITEM_KINDS, KIND_LABEL, REMINDERS, type CalendarItem, type ItemKind } from '../types';
import { DotGrid, paperFor } from './composer/paper';
import {
  ChoiceChips,
  FoldedStep,
  Progress,
  Reveal,
  SaveButton,
  StepHeading,
  TextButton,
  useFocusOnReveal,
} from './composer/parts';
import { WhenEditor, WhenStamp, type WhenValue } from './composer/when';

/** What the composer opens with: a new item at a date/time, or an existing item. */
export type ComposerRequest =
  | { mode: 'new'; date: CalendarDate; time: WallTime | null; kind?: ItemKind; seconds?: boolean }
  | { mode: 'edit'; item: CalendarItem };

const KIND_ICONS: Record<ItemKind, LucideIcon> = {
  event: CalendarDays,
  meeting: Users,
  note: StickyNote,
  follow_up: CornerUpRight,
  alarm: AlarmClock,
};

/** Sensible reminder for each kind until the user picks one. */
const DEFAULT_REMINDER: Record<ItemKind, number | null> = {
  event: 15,
  meeting: 15,
  note: null,
  follow_up: 0,
  alarm: 0,
};

const PLACE_PROMPT: Partial<Record<ItemKind, string>> = {
  meeting: 'Where, or paste a meeting link',
  event: 'Where',
};

const STEP_LABEL: Record<StepId, string> = {
  type: 'Kind',
  place: 'Where',
  remind: 'Remind',
  notes: 'Notes',
};

const ADD_LABEL: Record<StepId, string> = {
  type: 'Kind',
  place: '+ Place',
  remind: '+ Reminder',
  notes: '+ Notes',
};

/** A chosen chip settles for a beat before its step folds away. */
const SETTLE_MS = 170;

type Draft = WhenValue & {
  kind: ItemKind;
  /** The user picked the kind (so the title no longer suggests one). */
  kindChosen: boolean;
  title: string;
  place: string;
  notes: string;
  reminder: number | null;
  reminderTouched: boolean;
};

function draftFrom(request: ComposerRequest): Draft {
  if (request.mode === 'edit') {
    const { item } = request;
    const time = item.time ? parseTime(item.time) : { hours: 9, minutes: 0, seconds: 0 };
    return {
      kind: item.kind,
      kindChosen: true,
      title: item.title,
      place: item.place,
      notes: item.notes,
      date: parseISODate(item.date),
      timed: item.time !== null,
      ...time,
      showSeconds: time.seconds !== 0,
      reminder: item.reminderMinutes,
      reminderTouched: true,
    };
  }
  const kind = request.kind ?? 'event';
  const time = request.time ?? { hours: 9, minutes: 0, seconds: 0 };
  return {
    kind,
    kindChosen: Boolean(request.kind),
    title: '',
    place: '',
    notes: '',
    date: request.date,
    timed: request.time !== null,
    ...time,
    showSeconds: Boolean(request.seconds) && time.seconds !== 0,
    reminder: DEFAULT_REMINDER[kind],
    reminderTouched: false,
  };
}

const ALL_STEPS: StepId[] = ['type', 'place', 'remind', 'notes'];
const flowFrom = (request: ComposerRequest): FlowState =>
  request.mode === 'edit'
    ? { started: true, done: new Set(ALL_STEPS), added: new Set(), open: null }
    : { started: false, done: new Set(), added: new Set(), open: null };

const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);
const isLink = (place: string) => /^https?:\/\//i.test(place.trim());

type ItemComposerProps = {
  request: ComposerRequest | null;
  onClose: () => void;
};

/**
 * Add or edit one item, a page at a time. The date and time come first (set
 * like a stamp), then "What's this about?"; each answer reveals the next
 * question the kind needs — what kind, where, when to remind — and folds
 * into a one-line summary that can be opened again. Extras (place, notes)
 * are there when wanted. Enter moves on; ⌘/Ctrl+Enter saves.
 */
export function ItemComposer({ request, onClose }: ItemComposerProps) {
  const { uiTheme: ui, timeZone, settings } = useSettings();
  const { save, remove } = useEvents();
  const today = useToday(timeZone);
  const system = calendarSystemFor(settings.region, settings.nepalCalendar, today);
  const hour12 = uses12Hour();
  const paper = paperFor(ui);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [flow, setFlow] = useState<FlowState | null>(null);
  const initial = useRef<Draft | null>(null);
  const [confirm, setConfirm] = useState<'discard' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const titleRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!request) return;
    const next = draftFrom(request);
    initial.current = next;
    setDraft(next);
    setFlow(flowFrom(request));
    setConfirm(null);
    setError(null);
    setNotice(null);
    // Focus the title once the sheet has opened (web; native opens the keyboard).
    const t = setTimeout(() => titleRef.current?.focus(), 260);
    return () => clearTimeout(t);
  }, [request]);

  const editing = request?.mode === 'edit' ? request.item : null;
  const changed = draft && initial.current ? !sameDraft(draft, initial.current) : false;

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setError(null);
    setConfirm(null);
  };

  const setOpen = (open: FlowState['open']) => setFlow((f) => (f ? { ...f, open } : f));

  /** Marks a step finished and folds it; an empty extra just goes away. */
  const complete = useCallback(
    (id: StepId) => {
      setFlow((f) => {
        if (!f) return f;
        const done = new Set(f.done).add(id);
        const added = new Set(f.added);
        const empty =
          (id === 'notes' && !draft?.notes.trim()) || (id === 'place' && !draft?.place.trim());
        if (empty && added.has(id)) {
          added.delete(id);
          done.delete(id);
        }
        return { ...f, done, added, open: f.open === id || f.open === null ? null : f.open };
      });
    },
    [draft?.notes, draft?.place],
  );

  const when = useMemo(() => {
    if (!draft) return null;
    return scheduleFor(
      draft.date,
      draft.timed ? { hours: draft.hours, minutes: draft.minutes, seconds: draft.seconds } : null,
      timeZone,
      draft.reminder,
    );
  }, [draft, timeZone]);

  const layout =
    draft && flow
      ? layoutFlow(
          draft.kind,
          flow,
          { place: Boolean(draft.place.trim()), notes: Boolean(draft.notes.trim()) },
          // An alarm's label is optional.
          Boolean(draft.title.trim()) || draft.kind === 'alarm',
        )
      : null;

  const placeRef = useFocusOnReveal<TextInput>(
    layout?.steps.some((s) => s.id === 'place' && s.mode === 'open') ?? false,
  );
  const notesRef = useFocusOnReveal<TextInput>(
    layout?.steps.some((s) => s.id === 'notes' && s.mode === 'open') ?? false,
  );

  const close = () => {
    if (changed && confirm !== 'discard') {
      setConfirm('discard');
      return;
    }
    onClose();
  };

  const submit = async () => {
    if (!draft) return;
    const title = draft.title.trim() || (draft.kind === 'alarm' ? 'Alarm' : '');
    if (!title) {
      setError('Give it a few words first');
      titleRef.current?.focus();
      return;
    }
    const time = draft.timed
      ? timeString({ hours: draft.hours, minutes: draft.minutes, seconds: draft.seconds })
      : null;
    const now = new Date().toISOString();
    const item: CalendarItem = {
      id: editing?.id ?? newId(),
      kind: draft.kind,
      title,
      notes: draft.notes.trim(),
      place: draft.place.trim(),
      date: toISODate(draft.date),
      time,
      // An edited item keeps its zone unless its date or time changed.
      timeZone:
        editing && editing.date === toISODate(draft.date) && editing.time === time
          ? editing.timeZone
          : timeZone,
      startsAt: when?.startsAt ?? null,
      remindAt: when?.remindAt ?? null,
      reminderMinutes: draft.reminder,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
    };
    save(item);
    if (item.remindAt) {
      const permission = await requestNotificationPermission();
      if (permission === 'denied') {
        setNotice(
          'Saved. Browser notifications are off, so reminders show here while FORM / TIME is open.',
        );
        initial.current = draft;
        return;
      }
    }
    onClose();
  };

  // Enter in the title moves the page on: start, accept the step waiting,
  // and save once nothing is waiting.
  const advance = () => {
    if (!flow) return;
    if (!flow.started) setFlow({ ...flow, started: true });
    else if (layout?.pending) complete(layout.pending);
    else void submit();
  };

  // ⌘/Ctrl+Enter saves from anywhere on the page (web).
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  const open = request !== null;
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        // Caught on the way down (capture), before a text field takes Enter
        // as "next step" and stops it.
        e.preventDefault();
        e.stopPropagation();
        void submitRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  // The last draft stays rendered while the sheet animates closed.
  if (!draft || !flow || !layout) return null;

  const kindLabel = KIND_LABEL[draft.kind];
  const remindPast = when?.remindAt ? Date.parse(when.remindAt) < Date.now() : false;
  const past = when?.startsAt ? Date.parse(when.startsAt) < Date.now() : false;
  const ready = Boolean(draft.title.trim()) || draft.kind === 'alarm';
  const reminderText = remindAt(when?.remindAt ?? null, timeZone, hour12);

  const chooseKind = (kind: ItemKind) => {
    update({
      kind,
      kindChosen: true,
      ...(draft.reminderTouched ? null : { reminder: DEFAULT_REMINDER[kind] }),
      ...(kind === 'alarm' ? { timed: true } : null),
    });
    setTimeout(() => complete('type'), SETTLE_MS);
  };

  const chooseReminder = (reminder: number | null) => {
    update({ reminder, reminderTouched: true });
    setTimeout(() => complete('remind'), SETTLE_MS);
  };

  const onTitle = (title: string) => {
    const guess = !draft.kindChosen && !editing ? guessKind(title) : null;
    const kind = draft.kindChosen || editing ? draft.kind : (guess ?? 'event');
    update({
      title,
      ...(kind !== draft.kind
        ? {
            kind,
            ...(draft.reminderTouched ? null : { reminder: DEFAULT_REMINDER[kind] }),
            ...(kind === 'alarm' ? { timed: true } : null),
          }
        : null),
    });
    if (title.trim() && !flow.started) setFlow({ ...flow, started: true });
  };

  const stepFooter = (id: StepId) => {
    const waiting = layout.pending === id;
    return (
      <View style={styles.stepFoot}>
        <TextButton
          label={waiting ? 'Next' : 'Done'}
          a11yLabel={`${waiting ? 'Next' : 'Done'}: ${STEP_LABEL[id]}`}
          onPress={() => complete(id)}
        />
      </View>
    );
  };

  const renderOpen = (id: StepId) => {
    switch (id) {
      case 'type':
        return (
          <>
            <StepHeading
              label="What kind?"
              aside={!draft.kindChosen && !editing ? 'Guessed from your words' : undefined}
            />
            <ChoiceChips
              label="Kind"
              choices={ITEM_KINDS.map((k) => ({
                value: k.id,
                label: k.label,
                icon: KIND_ICONS[k.id],
              }))}
              value={draft.kind}
              onChoose={chooseKind}
            />
            {stepFooter('type')}
          </>
        );
      case 'place':
        return (
          <>
            <StepHeading label={draft.kind === 'meeting' ? 'Where, or a link' : 'Where'} />
            <TextInput
              ref={placeRef}
              value={draft.place}
              onChangeText={(place) => update({ place })}
              placeholder={PLACE_PROMPT[draft.kind] ?? 'Where'}
              placeholderTextColor={ui.muted}
              accessibilityLabel="Place or link"
              autoCapitalize="sentences"
              autoCorrect={false}
              maxLength={500}
              returnKeyType="next"
              onSubmitEditing={() => complete('place')}
              style={[styles.line, { color: ui.ink, borderColor: paper.rule }]}
            />
            {stepFooter('place')}
          </>
        );
      case 'remind':
        return (
          <>
            <StepHeading
              label="Remind me"
              aside={reminderText && !remindPast ? `Rings ${reminderText}` : undefined}
            />
            <ChoiceChips
              label="Reminder"
              choices={REMINDERS.map((r) => ({
                value: r.minutes,
                label: r.label,
                a11yLabel:
                  r.minutes === null
                    ? 'No reminder'
                    : `Remind ${r.label}${r.minutes ? ' before' : ''}`,
              }))}
              value={draft.reminder}
              onChoose={chooseReminder}
            />
            {!draft.timed && draft.reminder !== null ? (
              <Text style={[styles.hint, { color: ui.muted }]}>
                Without a time, reminders count back from 9:00 that morning.
              </Text>
            ) : null}
            {remindPast ? (
              <Text style={[styles.hint, { color: ui.muted }]}>
                That moment has passed, so it won’t ring.
              </Text>
            ) : null}
            {stepFooter('remind')}
          </>
        );
      case 'notes':
        return (
          <>
            <StepHeading label="Notes" />
            <TextInput
              ref={notesRef}
              value={draft.notes}
              onChangeText={(notes) => update({ notes })}
              placeholder="Anything to remember?"
              placeholderTextColor={ui.muted}
              accessibilityLabel="Notes"
              multiline
              maxLength={4000}
              style={[styles.notes, { color: ui.ink, borderColor: paper.rule }]}
            />
            {stepFooter('notes')}
          </>
        );
    }
  };

  const folded = (id: StepId) => {
    const props = { rule: paper.rule, onPress: () => setOpen(id) };
    switch (id) {
      case 'type':
        return (
          <FoldedStep {...props} label="Kind" value={kindLabel} icon={KIND_ICONS[draft.kind]} />
        );
      case 'place': {
        const place = draft.place.trim();
        return (
          <FoldedStep
            {...props}
            label="Where"
            value={place ? (isLink(place) ? hostOf(place) : place) : 'Not set'}
            icon={isLink(place) ? Link2 : MapPin}
            muted={!place}
          />
        );
      }
      case 'remind':
        return (
          <FoldedStep
            {...props}
            label="Remind"
            value={reminderLabel(draft.reminder)}
            detail={
              draft.reminder === null ? undefined : remindPast ? 'passed' : (reminderText ?? '')
            }
            muted={draft.reminder === null}
          />
        );
      case 'notes':
        return (
          <FoldedStep {...props} label="Notes" value={draft.notes.trim().split('\n')[0] ?? ''} />
        );
    }
  };

  const saveLabel = editing
    ? 'Save changes'
    : draft.kind === 'alarm'
      ? 'Set alarm'
      : `Save ${kindLabel.toLowerCase()}`;

  const footer = confirm ? (
    <View style={styles.confirm}>
      <Text style={[styles.confirmText, { color: ui.ink }]}>
        {confirm === 'discard' ? 'Discard this page?' : `Delete this ${kindLabel.toLowerCase()}?`}
      </Text>
      <View style={styles.actions}>
        <TextButton
          label={confirm === 'discard' ? 'Keep editing' : 'Cancel'}
          onPress={() => setConfirm(null)}
        />
        <SaveButton
          label={confirm === 'discard' ? 'Discard' : 'Delete'}
          ready
          onPress={() => {
            if (confirm === 'delete' && editing) remove(editing.id);
            onClose();
          }}
        />
      </View>
    </View>
  ) : (
    <View style={styles.footer}>
      {editing ? (
        <TextButton label="Delete" tone="muted" onPress={() => setConfirm('delete')} />
      ) : (
        <Progress done={layout.progress.done} total={layout.progress.total} />
      )}
      <View style={styles.actions}>
        <TextButton label={notice ? 'Done' : 'Cancel'} onPress={notice ? onClose : close} />
        {notice ? null : (
          <SaveButton label={saveLabel} ready={ready} onPress={() => void submit()} />
        )}
      </View>
    </View>
  );

  return (
    <Sheet
      visible={open}
      onClose={close}
      title={
        editing
          ? `Edit ${kindLabel.toLowerCase()}`
          : flow.started || draft.kindChosen
            ? `New ${kindLabel.toLowerCase()}`
            : 'New'
      }
      anchor="center"
      surface={paper.paper}
      texture={<DotGrid color={paper.dots} />}
      footer={footer}
    >
      {/* 1 · When */}
      <WhenStamp
        value={draft}
        system={system}
        today={today}
        hour12={hour12}
        paper={paper}
        open={flow.open === 'when'}
        onPress={() => setOpen(flow.open === 'when' ? null : 'when')}
      />
      {flow.open === 'when' ? (
        <Reveal>
          <WhenEditor
            value={draft}
            system={system}
            hour12={hour12}
            allowAllDay={draft.kind !== 'alarm'}
            allDayLabel={draft.kind === 'note' ? 'No particular time' : 'All day'}
            past={past}
            onChange={update}
            onDone={() => setOpen(null)}
          />
        </Reveal>
      ) : null}

      {/* 2 · What */}
      <TextInput
        ref={titleRef}
        value={draft.title}
        onChangeText={onTitle}
        placeholder={
          draft.kindChosen && draft.kind === 'alarm' ? 'Label (optional)' : 'What’s this about?'
        }
        placeholderTextColor={ui.muted}
        accessibilityLabel="Title"
        maxLength={200}
        returnKeyType={layout.pending || !flow.started ? 'next' : 'done'}
        submitBehavior="submit"
        onSubmitEditing={advance}
        style={[styles.title, { color: ui.ink, borderColor: error ? ui.accent : paper.rule }]}
      />
      {error ? (
        <Text style={[styles.error, { color: ui.accent }]} role="alert">
          {error}
        </Text>
      ) : null}
      {!flow.started ? (
        <View style={styles.stepFoot}>
          <TextButton label="Next" a11yLabel="Next: Kind" tone="muted" onPress={advance} />
        </View>
      ) : null}

      {/* 3 · The kind's own steps, one at a time */}
      <View style={styles.steps}>
        {layout.steps.map(({ id, mode }) =>
          mode === 'open' ? (
            <Reveal key={`${id}-open`}>
              <View style={[styles.open, { borderColor: paper.rule }]}>{renderOpen(id)}</View>
            </Reveal>
          ) : (
            <Reveal key={`${id}-folded`} subtle>
              {folded(id)}
            </Reveal>
          ),
        )}
      </View>

      {layout.addable.length > 0 ? (
        <Reveal subtle>
          <View style={[styles.addRow, { borderColor: paper.rule }]}>
            {layout.addable.map((id) => (
              <TextButton
                key={id}
                label={ADD_LABEL[id]}
                a11yLabel={`Add ${STEP_LABEL[id].toLowerCase()}`}
                tone="accent"
                onPress={() =>
                  setFlow((f) => (f ? { ...f, added: new Set(f.added).add(id), open: id } : f))
                }
              />
            ))}
          </View>
        </Reveal>
      ) : null}

      {notice ? <Text style={[styles.notice, { color: ui.ink }]}>{notice}</Text> : null}
    </Sheet>
  );
}

function reminderLabel(minutes: number | null): string {
  if (minutes === null) return 'No reminder';
  if (minutes === 0) return 'At the time';
  const r = REMINDERS.find((x) => x.minutes === minutes);
  return `${r?.label ?? `${minutes} min`} before`;
}

/** "Sat 2:45 pm", in the item's zone. */
function remindAt(iso: string | null, timeZone: string, hour12: boolean): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12,
    timeZone,
  }).format(new Date(iso));
}

function hostOf(url: string): string {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url.trim());
  return m ? m[1].replace(/^www\./, '') : url;
}

const styles = StyleSheet.create({
  title: {
    marginTop: 22,
    fontSize: 24,
    fontWeight: '300',
    letterSpacing: 0.1,
    paddingVertical: 10,
    borderBottomWidth: 1,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  error: { fontSize: 12, marginTop: 6 },
  steps: { marginTop: 18 },
  open: {
    paddingTop: 14,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  stepFoot: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6, marginRight: -8 },
  line: {
    fontSize: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  notes: {
    minHeight: 84,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 8,
    borderBottomWidth: 1,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  hint: { fontSize: 12, marginTop: 8 },
  addRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginHorizontal: -12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  notice: { fontSize: 13, lineHeight: 18, marginTop: 14 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confirm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  confirmText: { fontSize: 14 },
});
