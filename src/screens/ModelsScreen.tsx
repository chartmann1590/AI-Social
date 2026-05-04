import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Alert, Linking, ScrollView, Platform } from 'react-native';
import {
  Text,
  Button,
  Card,
  ProgressBar,
  Chip,
  Divider,
  useTheme,
} from 'react-native-paper';
import { useSettingsStore } from '../store';
import {
  ON_DEVICE_MODEL_CATALOG,
  formatApproxSize,
  type OnDeviceModelEntry,
  type OnDeviceModelFamily,
} from '../data/onDeviceModels';
import { downloadModelFile, getLocalModelUriIfExists, uriToNativePath } from '../services/modelDownload';
import { resetLocalLlmInitCache } from '../services/llm/providers/localLiteRt';

const FAMILY_LABEL: Record<OnDeviceModelFamily, string> = {
  gemma4: 'Gemma 4',
  gemma3: 'Gemma 3',
  qwen: 'Qwen',
  'deepseek-r1': 'DeepSeek R1',
};

export const ModelsScreen = () => {
  const theme = useTheme();
  const setLocalModelPath = useSettingsStore((s) => s.setLocalModelPath);
  const setLlmMode = useSettingsStore((s) => s.setLlmMode);

  const [filter, setFilter] = useState<OnDeviceModelFamily | 'all'>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ written: 0, total: 0 });
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [statusLog, setStatusLog] = useState<string[]>([]);

  const refreshInstalled = useCallback(async () => {
    const next: Record<string, boolean> = {};
    for (const m of ON_DEVICE_MODEL_CATALOG) {
      const uri = await getLocalModelUriIfExists(m.filename, m.approxSizeBytes);
      next[m.id] = !!uri;
    }
    setInstalled(next);
  }, []);

  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled]);

  const filtered =
    filter === 'all'
      ? ON_DEVICE_MODEL_CATALOG
      : ON_DEVICE_MODEL_CATALOG.filter((m) => m.family === filter);

  const onDownload = async (entry: OnDeviceModelEntry) => {
    if (Platform.OS !== 'android') {
      Alert.alert('Android only', 'On-device `.task` downloads target Android dev builds.');
      return;
    }
    setDownloadingId(entry.id);
    setProgress({ written: 0, total: entry.approxSizeBytes });
    setStatusLog([]);
    try {
      await downloadModelFile(
        entry.downloadUrl,
        entry.filename,
        (p) => {
          setProgress({
            written: p.totalBytesWritten,
            total: p.totalBytesExpectedToWrite || entry.approxSizeBytes,
          });
        },
        entry.approxSizeBytes,
        (msg) => setStatusLog((prev) => [...prev, `${new Date().toLocaleTimeString()} · ${msg}`]),
      );
      await refreshInstalled();
      Alert.alert('Download complete', `${entry.filename} is saved. Tap "Use model" to load it.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Download failed', msg);
    } finally {
      setDownloadingId(null);
    }
  };

  const onUseModel = async (entry: OnDeviceModelEntry) => {
    const uri = await getLocalModelUriIfExists(entry.filename, entry.approxSizeBytes);
    if (!uri) {
      Alert.alert('Not downloaded', 'Download this model first (or the previous download was incomplete).');
      return;
    }
    resetLocalLlmInitCache();
    setLocalModelPath(uriToNativePath(uri));
    setLlmMode('local');
    Alert.alert(
      'Model active',
      'On-device mode is on. Switch to Hybrid or Remote in Settings if you want Ollama as a fallback.',
    );
  };

  const openCard = (entry: OnDeviceModelEntry) => {
    Linking.openURL(entry.hfRepoUrl);
  };

  const progressRatio =
    progress.total > 0 ? Math.min(1, progress.written / progress.total) : 0;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text variant="headlineSmall" style={styles.title}>
        On-device models
      </Text>
      <Text variant="bodyMedium" style={[styles.blurb, { color: theme.colors.onSurfaceVariant }]}>
        Download MediaPipe `.task` bundles from Hugging Face (LiteRT community). Requires a dev
        build with the native LLM module (`npx expo run:android`). Large files — use Wi‑Fi.
      </Text>

      <View style={styles.chips}>
        <Chip selected={filter === 'all'} onPress={() => setFilter('all')} style={styles.chip}>
          All
        </Chip>
        {(Object.keys(FAMILY_LABEL) as OnDeviceModelFamily[]).map((f) => (
          <Chip key={f} selected={filter === f} onPress={() => setFilter(f)} style={styles.chip}>
            {FAMILY_LABEL[f]}
          </Chip>
        ))}
      </View>

      {downloadingId && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall">Downloading…</Text>
            <ProgressBar progress={progressRatio} style={styles.progress} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {formatApproxSize(progress.written)}
              {progress.total > 0 ? ` / ${formatApproxSize(progress.total)}` : ''}
            </Text>
            {statusLog.length > 0 && (
              <View style={{ marginTop: 8 }}>
                {statusLog.slice(-14).map((l, i) => (
                  <Text key={i} variant="labelSmall" style={{ opacity: 0.8 }}>
                    {l}
                  </Text>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {filtered.map((entry) => (
        <Card key={entry.id} style={styles.card}>
          <Card.Title
            title={entry.name}
            subtitle={`${FAMILY_LABEL[entry.family]} · ~${formatApproxSize(entry.approxSizeBytes)}`}
          />
          <Card.Content>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {entry.description}
            </Text>
            <Text variant="labelSmall" style={styles.filename}>
              {entry.filename}
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => openCard(entry)}>HF page</Button>
            <Button
              mode="contained-tonal"
              onPress={() => onDownload(entry)}
              disabled={downloadingId !== null}
              loading={downloadingId === entry.id}
            >
              Download
            </Button>
            <Button mode="contained" onPress={() => onUseModel(entry)} disabled={!installed[entry.id]}>
              Use model
            </Button>
          </Card.Actions>
        </Card>
      ))}

      <Divider style={styles.divider} />
      <Button mode="outlined" onPress={refreshInstalled}>
        Refresh installed status
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { marginBottom: 8 },
  blurb: { marginBottom: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { marginRight: 4, marginBottom: 4 },
  card: { marginBottom: 12 },
  progress: { marginVertical: 8, height: 8 },
  filename: { marginTop: 8, opacity: 0.8 },
  divider: { marginVertical: 20 },
});
