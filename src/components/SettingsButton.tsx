
import { Pressable, StyleSheet } from 'react-native';
import { Settings2 } from 'lucide-react-native';

export default function SettingsButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Clock settings"
      onPress={() => {
        // Settings panel will be connected in the next step.
      }}
      style={({ hovered, pressed }) => [
        styles.button,
        hovered && styles.hovered,
        pressed && styles.pressed,
      ]}
    >
      <Settings2 size={19} color="#244F5A" strokeWidth={1.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 22,
    bottom: 22,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    opacity: 0.28,
    backgroundColor: 'transparent',
  },
  hovered: {
    opacity: 0.9,
    backgroundColor: 'rgba(36, 79, 90, 0.06)',
  },
  pressed: {
    opacity: 1,
  },
});
