import React, { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme, adaptNavigationTheme } from 'react-native-paper';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { AppNavigator } from './src/navigation';
import { useSettingsStore } from './src/store';

export default function App() {
  const colorScheme = useColorScheme();
  const themePreference = useSettingsStore((state) => state.themePreference);

  const resolvedScheme = themePreference === 'system'
    ? (colorScheme ?? 'light')
    : themePreference;
  const isDark = resolvedScheme === 'dark';

  const paperTheme = useMemo(
    () => (isDark ? MD3DarkTheme : MD3LightTheme),
    [isDark],
  );

  const { LightTheme: PaperNavLight, DarkTheme: PaperNavDark } = adaptNavigationTheme({
    reactNavigationLight: NavigationDefaultTheme,
    reactNavigationDark: NavigationDarkTheme,
  });
  const navigationTheme = isDark ? PaperNavDark : PaperNavLight;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <AppNavigator navigationTheme={navigationTheme} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
