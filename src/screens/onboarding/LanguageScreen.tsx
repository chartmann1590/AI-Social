import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, ProgressBar, Text, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useSettingsStore } from '../../store';
import {
  SOURCE_LANGUAGE_CODE,
  TRANSLATION_LANGUAGES,
  downloadModelForLanguage,
  getTranslationLanguageName,
  isTranslationModelReady,
  translationIsAvailable,
} from '../../services/translation';
import type { OnboardingStackParamList } from './types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Language'>;

type DownloadState = 'idle' | 'downloading' | 'downloaded' | 'failed';

function useLanguageDownload(target: string | null) {
  const [state, setState] = useState<DownloadState>('idle');
  useEffect(() => {
    let cancelled = false;
    if (!target || target === SOURCE_LANGUAGE_CODE) {
      setState('downloaded');
      return;
    }
    if (isTranslationModelReady(target)) {
      setState('downloaded');
      return;
    }
    setState('downloading');
    downloadModelForLanguage(target).then((ok) => {
      if (cancelled) return;
      setState(ok ? 'downloaded' : 'failed');
    });
    return () => {
      cancelled = true;
    };
  }, [target]);
  return state;
}

export const LanguageScreen = ({ navigation }: Props) => {
  const theme = useTheme();
  const translationLanguage = useSettingsStore((s) => s.translationLanguage);
  const setTranslationLanguage = useSettingsStore((s) => s.setTranslationLanguage);
  const setTranslateEnabled = useSettingsStore((s) => s.setTranslateEnabled);

  const [selected, setSelected] = useState<string>(translationLanguage || 'en');
  const downloadState = useLanguageDownload(selected);

  const available = translationIsAvailable;

  const onSelect = useCallback(
    (code: string) => {
      setSelected(code);
      setTranslationLanguage(code);
      setTranslateEnabled(true);
    },
    [setTranslationLanguage, setTranslateEnabled],
  );

  const onContinue = () => {
    navigation.navigate('ModelSetup');
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text variant="labelMedium" style={{ color: theme.colors.primary, marginBottom: 4 }}>
        STEP 2 OF 4
      </Text>
      <Text variant="headlineMedium" style={styles.title}>
        Speak my language
      </Text>
      <Text variant="bodyMedium" style={[styles.blurb, { color: theme.colors.onSurfaceVariant }]}>
        Pick the language you want the app shown in. The on-device language pack is downloaded to
        your phone so every post, comment, and bit of text is translated for you automatically —
        no accounts, no servers.
      </Text>

      {!available && (
        <View
          style={[
            styles.notice,
            { backgroundColor: theme.colors.errorContainer },
          ]}
        >
          <Text variant="bodySmall" style={{ color: theme.colors.onErrorContainer }}>
            On-device translation requires the Android dev build (not Expo Go). Everything will
            stay in English until it's available.
          </Text>
        </View>
      )}

      {TRANSLATION_LANGUAGES.map((lang) => {
        const isSelected = selected === lang.code;
        const isSource = lang.code === SOURCE_LANGUAGE_CODE;
        return (
          <Card
            key={lang.code}
            style={[
              styles.card,
              isSelected && { borderColor: theme.colors.primary, borderWidth: 2 },
            ]}
            onPress={() => onSelect(lang.code)}
          >
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium" style={styles.flag}>
                  {lang.flag}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                    {lang.nativeName}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {lang.name}
                    {isSource ? ' · Original language' : ''}
                  </Text>
                </View>
                {isSelected && (
                  <Chip
                    compact
                    mode="flat"
                    icon="check"
                    style={{ backgroundColor: theme.colors.primaryContainer }}
                    textStyle={{ fontSize: 10 }}
                  >
                    Selected
                  </Chip>
                )}
              </View>
            </Card.Content>
          </Card>
        );
      })}

      {selected !== SOURCE_LANGUAGE_CODE && available && (
        <Card style={[styles.card, { marginTop: 4 }]}>
          <Card.Content>
            <Text variant="titleSmall" style={{ marginBottom: 8 }}>
              {getTranslationLanguageName(selected)} language pack
            </Text>
            {downloadState === 'downloading' && (
              <>
                <ProgressBar indeterminate style={styles.progress} />
                <Text
                  variant="labelSmall"
                  style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}
                >
                  Downloading the on-device translation pack… this can take a minute or two on
                  Wi-Fi.
                </Text>
              </>
            )}
            {downloadState === 'downloaded' && (
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.primary }}
              >
                ✓ Downloaded — translations run entirely on your phone.
              </Text>
            )}
            {downloadState === 'failed' && (
              <Text variant="labelSmall" style={{ color: theme.colors.error }}>
                Download failed. You can retry later from Settings → Translation.
              </Text>
            )}
          </Card.Content>
        </Card>
      )}

      <Text
        variant="bodySmall"
        style={[styles.disclaimer, { color: theme.colors.onSurfaceVariant }]}
      >
        Translation is powered by Google ML Kit running on-device. Results are generated locally
        and may not always be perfectly accurate.
      </Text>

      <Button
        mode="contained"
        onPress={onContinue}
        icon="arrow-right"
        style={styles.cta}
        contentStyle={{ paddingVertical: 6 }}
      >
        Continue
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 60 },
  title: { fontWeight: '700', marginBottom: 6 },
  blurb: { marginBottom: 18 },
  notice: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flag: { fontSize: 26 },
  progress: { height: 8, borderRadius: 4, marginTop: 4 },
  disclaimer: {
    marginTop: 12,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  cta: { borderRadius: 999 },
});