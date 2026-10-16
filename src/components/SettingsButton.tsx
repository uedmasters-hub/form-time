import { Settings2 } from 'lucide-react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { QuietIconButton } from '@/components/QuietIconButton';

type SettingsButtonProps = {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Settings entry point. Faint (25%) at rest, full strength on hover, press
 * or keyboard focus; slightly stronger at rest on touch screens.
 */
export default function SettingsButton({ onPress, style }: SettingsButtonProps) {
  return (
    <QuietIconButton
      icon={Settings2}
      label="Settings"
      onPress={
        onPress ??
        (() => {
          // The settings sheet is a later roadmap step; nothing to open yet.
        })
      }
      style={style}
    />
  );
}
