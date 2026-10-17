import { Play } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { QuietIconButton } from '@/components/QuietIconButton';
import { SheetSection as Section, SheetSwitch } from '@/components/Sheet';
import { useSettings } from '@/features/settings/SettingsProvider';

import { SOUNDS } from '../sound-settings';
import { useSound } from '../SoundProvider';
import { VolumeSlider } from './VolumeSlider';

/**
 * Settings → Sound: mute all, one volume, and each sound on its own switch
 * with a button to hear it. Kept on this device (see sound-settings).
 */
export function SoundSection() {
  const { uiTheme: ui } = useSettings();
  const { supported, sound, update, setEnabled, preview } = useSound();

  if (!supported) {
    return (
      <Section label="Sound">
        <Text style={[styles.note, { color: ui.muted }]}>
          Sounds play in the browser and desktop app; this device stays silent for now.
        </Text>
      </Section>
    );
  }

  const off = sound.muted;
  return (
    <Section label="Sound" aside={off ? 'Muted' : `${Math.round(sound.volume * 100)}%`}>
      <SheetSwitch
        label="Mute all"
        detail={off ? 'Every sound is off' : 'Each sound follows its own switch'}
        value={sound.muted}
        onChange={(muted) => update({ muted })}
        first
      />
      <View style={[styles.volume, { borderColor: ui.hairline }]}>
        <Text style={[styles.volumeLabel, { color: off ? ui.muted : ui.ink }]}>Volume</Text>
        <View style={styles.slider}>
          <VolumeSlider
            value={sound.volume}
            onChange={(volume) => update({ volume })}
            onCommit={() => preview('notification')}
            disabled={off}
            ui={ui}
          />
        </View>
      </View>
      {SOUNDS.map((s) => (
        <SheetSwitch
          key={s.id}
          label={s.label}
          detail={s.detail}
          value={sound.enabled[s.id]}
          onChange={(on) => setEnabled(s.id, on)}
          accessory={
            <QuietIconButton
              icon={Play}
              label={`Play ${s.label.toLocaleLowerCase()}`}
              onPress={() => preview(s.id)}
              disabled={off}
              iconSize={14}
            />
          }
        />
      ))}
      <SheetSwitch
        label="Quiet at night"
        detail="No ticking, minute mark or chime from 10 pm to 7 am"
        value={sound.quietAtNight}
        onChange={(quietAtNight) => update({ quietAtNight })}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  volume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  volumeLabel: {
    fontSize: 14,
  },
  slider: {
    flex: 1,
    paddingRight: 4,
  },
  note: {
    fontSize: 12,
  },
});
