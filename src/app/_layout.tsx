import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AccountProvider } from '@/features/account/AccountProvider';
import { EventsProvider } from '@/features/events/EventsProvider';
import { SettingsProvider, useSettings } from '@/features/settings/SettingsProvider';
import { isDark } from '@/theme/color';

/** Light status-bar content on night and dark dials, dark on light ones. */
function ThemedStatusBar() {
  const { uiTheme } = useSettings();
  const darkPage = uiTheme.mode === 'night' || isDark(uiTheme.page);
  return <StatusBar style={darkPage ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    // Required by react-native-gesture-handler for the Clock ↔ Calendar swipe.
    <GestureHandlerRootView style={styles.root}>
      {/* Account first: settings and items both follow who is signed in. */}
      <AccountProvider>
        <SettingsProvider>
          <EventsProvider>
            <ThemedStatusBar />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="explore" />
            </Stack>
          </EventsProvider>
        </SettingsProvider>
      </AccountProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
