import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, IconButton, List, Switch, Text, useTheme } from 'react-native-paper';
import { useSettingsStore } from '../store';
import {
  SOURCE_LANGUAGE_CODE,
  TRANSLATION_LANGUAGES,
  deleteModelForLanguage,
  downloadModelForLanguage,
  getDownloadedModelCount,
  getTranslationLanguage,
  getTranslationLanguageName,
  isTranslationModelReady,
  subscribeTranslationReady,
  translationIsAvailable,
} from '../services/translation';

export const SettingsTranslationSection = () => {
  const theme = useTheme();
  const translateEnabled = useSettingsStore((s) => s.translateEnabled);
  const translationLanguage = useSettingsStore((s) => s.translationLanguage);
  const setTranslateEnabled = useSettingsStore((s) => s.setTranslateEnabled);
  const setTranslationLanguage = useSettingsStore((s) => s.setTranslationLanguage);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadedCount, setDownloadedCount] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      setDownloadedCount(await getDownloadedModelCount());
    } catch {
      setDownloadedCount(0);
    }
  }, []);

  useEffect(() => {
    if (!translationIsAvailable) return;
    refreshCount();
    const unsubscribe = subscribeTranslationReady(refreshCount);
    return unsubscribe;
  }, [refreshCount]);

  const currentLang = getTranslationLanguage(translationLanguage);
  const packReady =
    translationLanguage === SOURCE_LANGUAGE_CODE ||
    isTranslationModelReady(translationLanguage);
  const canDownload =
    translationIsAvailable &&
    translationLanguage !== SOURCE_LANGUAGE_CODE &&
    !packReady;

  const downloadPack = useCallback(async () => {
    if (!translationIsAvailable) return;
    setDownloading(true);
    try {
      const ok = await downloadModelForLanguage(translationLanguage);
      await refreshCount();
      if (!ok) return;
    } finally {
      setDownloading(false);
    }
  }, [translationLanguage, refreshCount]);

  const removePack = useCallback(async () => {
    await deleteModelForLanguage(translationLanguage);
    await refreshCount();
  }, [translationLanguage, refreshCount]);

  const chooseLanguage = useCallback(
    (code: string) => {
      setTranslationLanguage(code);
      setTranslateEnabled(true);
      setPickerVisible(false);
    },
    [setTranslationLanguage, setTranslateEnabled],
  );

  return (
    <>
      <DividerLine color={theme.colors.outlineVariant} />

      <Text variant="titleSmall" style={styles.sectionTitle}>
        Translation (on-device)
      </Text>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyLarge">Translate posts & comments</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Google ML Kit runs entirely on your phone — nothing is uploaded.
          </Text>
        </View>
        <Switch
          value={translateEnabled}
          disabled={!translationIsAvailable}
          onValueChange={setTranslateEnabled}
        />
      </View>

      {!translationIsAvailable && (
        <Text variant="bodySmall" style={[styles.helper, { color: theme.colors.error }]}>
          On-device translation needs the Android dev build (not Expo Go).
        </Text>
      )}

      {translationIsAvailable && (
        <>
          <Pressable
            onPress={() => setPickerVisible(true)}
            style={[
              styles.langRow,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Display language
              </Text>
              <Text variant="bodyLarge" style={{ fontWeight: '700' }}>
                {currentLang ? `${currentLang.flag}  ${currentLang.nativeName}` : translationLanguage}
              </Text>
            </View>
            <IconButton icon="chevron-down" size={20} onPress={() => setPickerVisible(true)} />
          </Pressable>

          <Text variant="bodySmall" style={[styles.helper, { color: theme.colors.onSurfaceVariant }]}>
            {translationLanguage === SOURCE_LANGUAGE_CODE
              ? 'Posts and comments stay in their original (English) form.'
              : packReady
                ? `Language pack ready — ${downloadedCount} pack${downloadedCount === 1 ? '' : 's'} downloaded on this device.`
                : downloading
                  ? 'Downloading the language pack… this can take a minute or two on Wi-Fi.'
                  : 'The language pack is not downloaded yet.'}
          </Text>

          <View style={styles.langActions}>
            {translationLanguage !== SOURCE_LANGUAGE_CODE && (
              <>
                {!packReady && (
                  <Button
                    mode="contained-tonal"
                    icon="download"
                    compact
                    onPress={downloadPack}
                    loading={downloading}
                    disabled={downloading}
                  >
                    Download pack
                  </Button>
                )}
                {packReady && (
                  <Button
                    mode="text"
                    icon="delete-outline"
                    compact
                    onPress={removePack}
                    disabled={downloading}
                  >
                    Remove pack
                  </Button>
                )}
              </>
            )}
          </View>

          <Text
            variant="bodySmall"
            style={[styles.disclaimer, { color: theme.colors.onSurfaceVariant }]}
          >
            Powered by Google ML Kit on your device. Translations are generated locally and may
            not always be perfectly accurate.
          </Text>
        </>
      )}

      <LanguagePicker
        visible={pickerVisible}
        selected={translationLanguage}
        onSelect={chooseLanguage}
        onDismiss={() => setPickerVisible(false)}
      />
    </>
  );
};

const DividerLine = ({ color }: { color: string }) => (
  <View style={[styles.divider, { backgroundColor: color }]} />
);

const LanguagePicker = ({
  visible,
  selected,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onDismiss: () => void;
}) => {
  const theme = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text variant="titleLarge">Pick a display language</Text>
            <IconButton icon="close" onPress={onDismiss} accessibilityLabel="Close" />
          </View>
          <ScrollView style={{ flex: 1 }}>
            {TRANSLATION_LANGUAGES.map((lang) => {
              const isSelected = lang.code === selected;
              return (
                <List.Item
                  key={lang.code}
                  title={`${lang.flag}  ${lang.nativeName}`}
                  description={lang.name}
                  onPress={() => onSelect(lang.code)}
                  left={(props) =>
                    isSelected ? (
                      <List.Icon {...props} icon="check" color={theme.colors.primary} />
                    ) : (
                      <List.Icon {...props} icon="translate" />
                    )
                  }
                  titleStyle={{ fontWeight: isSelected ? '700' : '400' }}
                />
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 10,
    marginTop: 4,
  },
  helper: {
    marginTop: 8,
    marginBottom: 8,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  langActions: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  disclaimer: {
    fontStyle: 'italic',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 20,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    height: '80%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
});