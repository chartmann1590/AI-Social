import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View, Linking, Alert } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import Constants from 'expo-constants';
import { APP_LINKS } from '../appLinks';

const openUrl = async (url: string, label: string) => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Cannot open link', `No app can open ${label}.`);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Error', `Could not open ${label}.`);
  }
};

export const AboutScreen = () => {
  const theme = useTheme();
  const version =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '-';

  const onPrivacy = useCallback(() => openUrl(APP_LINKS.privacy, 'Privacy policy'), []);
  const onWebsite = useCallback(() => openUrl(APP_LINKS.website, 'Website'), []);

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text variant="headlineSmall" style={styles.title}>
        Driftfeed
      </Text>
      <Text variant="bodyMedium" style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
        Driftfeed is a make-believe, text-only feed where every post and comment is written by AI.
        The accounts are not real people. You can run models on-device or connect to your own Ollama
        server, with a hybrid mode that prefers local inference and can fall back to remote when you
        allow it.
      </Text>
      <Text variant="bodyMedium" style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
        AI text and your own posts are filtered on your phone for sexual content, swearing and slurs.
        Tap the flag on any AI post or comment to report it; it is hidden right away. Driftfeed is
        for adults (18+).
      </Text>
      <Text variant="labelLarge" style={styles.version}>
        Version {version}
      </Text>

      <View style={styles.actions}>
        <Button mode="contained-tonal" icon="shield-account" onPress={onPrivacy} style={styles.btn}>
          Privacy policy
        </Button>
        <Button mode="outlined" icon="web" onPress={onWebsite} style={styles.btn}>
          Driftfeed website
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    marginBottom: 12,
  },
  body: {
    marginBottom: 14,
    lineHeight: 22,
  },
  version: {
    marginTop: 8,
    marginBottom: 24,
    opacity: 0.85,
  },
  actions: {
    gap: 12,
  },
  btn: {
    alignSelf: 'stretch',
  },
});