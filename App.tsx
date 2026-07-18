import React, { useEffect, useMemo } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme, adaptNavigationTheme } from 'react-native-paper';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { AppNavigator } from './src/navigation';
import { useSettingsStore } from './src/store';
import { AdMobBanner } from './src/ads/AdMobBanner';
import { AdMobProvider } from './src/ads/AdMobProvider';
import { initializeFirebase } from './src/services/firebase';

export default function App() {
  useEffect(() => {
    initializeFirebase();
  }, []);
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
        <AdMobProvider>
          <View style={styles.root}>
            <AppNavigator navigationTheme={navigationTheme} />
            <AdMobBanner />
            <StatusBar style={isDark ? 'light' : 'dark'} />
          </View>
        </AdMobProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
