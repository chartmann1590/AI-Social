import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, ProgressBar, RadioButton, Text, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useSettingsStore } from '../../store';
import {
  ON_DEVICE_MODEL_CATALOG,
  formatApproxSize,
  type OnDeviceModelEntry,
} from '../../data/onDeviceModels';
import {
  downloadModelFile,
  getLocalModelUriIfExists,
  uriToNativePath,
} from '../../services/modelDownload';
import { resetLocalLlmInitCache } from '../../services/llm/providers/localLiteRt';
import type { OnboardingStackParamList } from './types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ModelSetup'>;

/** Curated picks shown during onboarding (full catalog still available later in Models tab). */
const ONBOARDING_CHOICE_IDS = ['gemma4-e2b-litertlm', 'gemma3-1b-q4'] as const;

type ChoiceId = (typeof ONBOARDING_CHOICE_IDS)[number];

const RECOMMENDED: ChoiceId = 'gemma4-e2b-litertlm';

const FUN_LOG_LINES = [
  'Tipping the cabbie at the Hugging Face CDN…',
  'Politely asking 2.6 GB of weights to come over…',
  'Petting the model until it loads…',
  'Convincing your phone to think for itself…',
  'Slipping past redirect chains like a ninja…',
  'Decompressing tiny attention heads…',
  'Greasing the tokenizer…',
  'Aligning RoPE with the cosmos…',
];

export const ModelSetupScreen = ({ navigation }: Props) => {
  const theme = useTheme();
  const setLocalModelPath = useSettingsStore((s) => s.setLocalModelPath);
  const setLlmMode = useSettingsStore((s) => s.setLlmMode);
  const localModelPath = useSettingsStore((s) => s.localModelPath);

  const choices = useMemo(
    () =>
      ONBOARDING_CHOICE_IDS.map(
        (id) => ON_DEVICE_MODEL_CATALOG.find((m) => m.id === id)!,
      ).filter(Boolean),
    [],
  );

  const [selectedId, setSelectedId] = useState<ChoiceId>(RECOMMENDED);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ written: 0, total: 0 });
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [installedId, setInstalledId] = useState<string | null>(null);
  const [funMsg, setFunMsg] = useState<string>(FUN_LOG_LINES[0]!);

  const refreshInstalled = useCallback(async () => {
    for (const entry of choices) {
      const uri = await getLocalModelUriIfExists(entry.filename, entry.approxSizeBytes);
      if (uri) {
        setInstalledId(entry.id);
        return;
      }
    }
    setInstalledId(null);
  }, [choices]);

  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled]);

  useEffect(() => {
    if (!downloading) return;
    const t = setInterval(() => {
      setFunMsg(FUN_LOG_LINES[Math.floor(Math.random() * FUN_LOG_LINES.length)]!);
    }, 4500);
    return () => clearInterval(t);
  }, [downloading]);

  const selected = choices.find((c) => c.id === selectedId)!;
  const ratio = progress.total > 0 ? Math.min(1, progress.written / progress.total) : 0;
  const writtenStr = formatApproxSize(progress.written || 0);
  const totalStr = progress.total > 0 ? formatApproxSize(progress.total) : formatApproxSize(selected.approxSizeBytes);

  const startDownload = async (entry: OnDeviceModelEntry) => {
    if (Platform.OS !== 'android') {
      Alert.alert('Android only', 'On-device models require an Android dev build.');
      return;
    }
    setDownloading(true);
    setProgress({ written: 0, total: entry.approxSizeBytes });
    setStatusMsg('Starting…');
    try {
      const uri = await downloadModelFile(
        entry.downloadUrl,
        entry.filename,
        (p) => {
          setProgress({
            written: p.totalBytesWritten,
            total: p.totalBytesExpectedToWrite || entry.approxSizeBytes,
          });
        },
        entry.approxSizeBytes,
        (msg) => setStatusMsg(msg),
      );
      resetLocalLlmInitCache();
      setLocalModelPath(uriToNativePath(uri));
      setLlmMode('local');
      setInstalledId(entry.id);
      setStatusMsg('Done!');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Download failed', msg);
      setStatusMsg('Failed');
    } finally {
      setDownloading(false);
    }
  };

  const onContinue = async () => {
    const entry = choices.find((c) => c.id === installedId);
    if (entry) {
      const uri = await getLocalModelUriIfExists(entry.filename, entry.approxSizeBytes);
      if (uri) {
        resetLocalLlmInitCache();
        setLocalModelPath(uriToNativePath(uri));
        setLlmMode('local');
      }
    }
    navigation.navigate('Tour');
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text variant="labelMedium" style={{ color: theme.colors.primary, marginBottom: 4 }}>
        STEP 2 OF 3
      </Text>
      <Text variant="headlineMedium" style={styles.title}>
        Bring your brain
      </Text>
      <Text variant="bodyMedium" style={[styles.blurb, { color: theme.colors.onSurfaceVariant }]}>
        AI Social runs the whole feed locally — so we need to download a small language model onto your phone.
        Pick one. You can always swap later in the Models tab.
      </Text>

      <RadioButton.Group
        value={selectedId}
        onValueChange={(v) => setSelectedId(v as ChoiceId)}
      >
        {choices.map((entry) => {
          const isInstalled = installedId === entry.id;
          const isRecommended = entry.id === RECOMMENDED;
          return (
            <Card
              key={entry.id}
              style={[
                styles.card,
                selectedId === entry.id && {
                  borderColor: theme.colors.primary,
                  borderWidth: 2,
                },
              ]}
              onPress={() => !downloading && setSelectedId(entry.id as ChoiceId)}
            >
              <Card.Content>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        {entry.name.replace(/\s*\([^)]*\)\s*$/, '')}
                      </Text>
                      {isRecommended && (
                        <Chip compact mode="flat" style={{ height: 24 }} textStyle={{ fontSize: 10 }}>
                          Recommended
                        </Chip>
                      )}
                      {isInstalled && (
                        <Chip compact mode="flat" icon="check" style={{ height: 24, backgroundColor: theme.colors.primaryContainer }} textStyle={{ fontSize: 10 }}>
                          Installed
                        </Chip>
                      )}
                    </View>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                      ~{formatApproxSize(entry.approxSizeBytes)} download
                    </Text>
                  </View>
                  <RadioButton value={entry.id} />
                </View>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                  {entry.description}
                </Text>
              </Card.Content>
            </Card>
          );
        })}
      </RadioButton.Group>

      {downloading && (
        <Card style={[styles.card, { marginTop: 4 }]}>
          <Card.Content>
            <Text variant="titleSmall" style={{ marginBottom: 6 }}>
              {funMsg}
            </Text>
            <ProgressBar progress={ratio} style={styles.progress} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {writtenStr} / {totalStr}
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {Math.round(ratio * 100)}%
              </Text>
            </View>
            {!!statusMsg && (
              <Text variant="labelSmall" style={{ marginTop: 6, opacity: 0.7 }}>
                {statusMsg}
              </Text>
            )}
            <Text variant="labelSmall" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
              Keep the screen on while this finishes — large downloads can take a few minutes on Wi-Fi.
            </Text>
          </Card.Content>
        </Card>
      )}

      <View style={styles.actions}>
        {!installedId ? (
          <Button
            mode="contained"
            icon="download"
            onPress={() => startDownload(selected)}
            loading={downloading}
            disabled={downloading}
            style={styles.cta}
            contentStyle={{ paddingVertical: 6 }}
          >
            Download {selected.name.replace(/\s*\([^)]*\)\s*$/, '')}
          </Button>
        ) : (
          <Button
            mode="contained"
            icon="arrow-right"
            onPress={onContinue}
            style={styles.cta}
            contentStyle={{ paddingVertical: 6 }}
          >
            Continue
          </Button>
        )}

        <Button
          mode="text"
          onPress={() => navigation.navigate('Tour')}
          disabled={downloading}
          style={{ marginTop: 8 }}
        >
          Skip for now (you can use the cloud later)
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 60 },
  title: { fontWeight: '700', marginBottom: 6 },
  blurb: { marginBottom: 18 },
  card: { marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  progress: { height: 10, borderRadius: 6 },
  actions: { marginTop: 12 },
  cta: { borderRadius: 999 },
});
