import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  HelperText,
  Icon,
  ProgressBar,
  RadioButton,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
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
type Provider = 'local' | 'remote';

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

interface OllamaTestResult {
  ok: boolean;
  message: string;
}

async function testOllama(baseUrl: string, model: string): Promise<OllamaTestResult> {
  const trimmed = baseUrl.trim().replace(/\/$/, '');
  const wantedModel = model.trim();

  if (!trimmed) {
    return { ok: false, message: 'Enter the Ollama base URL (e.g. http://192.168.1.20:11434).' };
  }
  if (!wantedModel) {
    return { ok: false, message: 'Enter a model name pulled on your Ollama server.' };
  }

  let res: Response;
  try {
    res = await fetch(`${trimmed}/api/tags`);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: `Cannot reach ${trimmed} (${detail}). Check Wi-Fi/VPN and that OLLAMA_HOST=0.0.0.0.`,
    };
  }

  if (!res.ok) {
    return { ok: false, message: `Ollama responded with HTTP ${res.status}.` };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: 'Server reachable but did not return JSON. Is this really Ollama?' };
  }

  const rawModels = (data as { models?: Array<{ name?: string; model?: string }> })?.models ?? [];
  const tags = rawModels
    .map((m) => m?.name ?? m?.model ?? '')
    .filter((n): n is string => !!n);

  const hasModel = tags.some(
    (t) => t === wantedModel || t.startsWith(`${wantedModel}:`) || t.split(':')[0] === wantedModel,
  );

  if (!hasModel) {
    const preview = tags.slice(0, 4).join(', ');
    const more = tags.length > 4 ? `, +${tags.length - 4} more` : '';
    return {
      ok: false,
      message: tags.length
        ? `Server reachable, but model "${wantedModel}" not found. Available: ${preview}${more}.`
        : `Server reachable, but no models are pulled. Run "ollama pull ${wantedModel}" on the server.`,
    };
  }

  return { ok: true, message: `Connected. "${wantedModel}" is ready on the server.` };
}

export const ModelSetupScreen = ({ navigation }: Props) => {
  const theme = useTheme();
  const setLocalModelPath = useSettingsStore((s) => s.setLocalModelPath);
  const setLlmMode = useSettingsStore((s) => s.setLlmMode);
  const baseUrl = useSettingsStore((s) => s.baseUrl);
  const ollamaModel = useSettingsStore((s) => s.model);
  const setBaseUrl = useSettingsStore((s) => s.setBaseUrl);
  const setOllamaModel = useSettingsStore((s) => s.setModel);

  const choices = useMemo(
    () =>
      ONBOARDING_CHOICE_IDS.map(
        (id) => ON_DEVICE_MODEL_CATALOG.find((m) => m.id === id)!,
      ).filter(Boolean),
    [],
  );

  const onDeviceAvailable = Platform.OS === 'android';
  const [provider, setProvider] = useState<Provider>(onDeviceAvailable ? 'local' : 'remote');
  const [selectedId, setSelectedId] = useState<ChoiceId>(RECOMMENDED);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ written: 0, total: 0 });
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [installedId, setInstalledId] = useState<string | null>(null);
  const [funMsg, setFunMsg] = useState<string>(FUN_LOG_LINES[0]!);

  const [ollamaUrl, setOllamaUrl] = useState(baseUrl);
  const [ollamaModelName, setOllamaModelName] = useState(ollamaModel);
  const [ollamaTesting, setOllamaTesting] = useState(false);
  const [ollamaResult, setOllamaResult] = useState<OllamaTestResult | null>(null);

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

  // Invalidate the test result whenever URL/model changes, so the user must re-test.
  useEffect(() => {
    setOllamaResult(null);
  }, [ollamaUrl, ollamaModelName]);

  const selected = choices.find((c) => c.id === selectedId)!;
  const ratio = progress.total > 0 ? Math.min(1, progress.written / progress.total) : 0;
  const writtenStr = formatApproxSize(progress.written || 0);
  const totalStr =
    progress.total > 0 ? formatApproxSize(progress.total) : formatApproxSize(selected.approxSizeBytes);

  const startDownload = async (entry: OnDeviceModelEntry) => {
    if (!onDeviceAvailable) {
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

  const runOllamaTest = async () => {
    setOllamaTesting(true);
    setOllamaResult(null);
    try {
      const result = await testOllama(ollamaUrl, ollamaModelName);
      setOllamaResult(result);
      if (result.ok) {
        setBaseUrl(ollamaUrl.trim().replace(/\/$/, ''));
        setOllamaModel(ollamaModelName.trim());
      }
    } finally {
      setOllamaTesting(false);
    }
  };

  const localReady = !!installedId;
  const remoteReady = !!ollamaResult?.ok;
  const canContinue = provider === 'local' ? localReady : remoteReady;

  const onContinue = async () => {
    if (provider === 'local') {
      const entry = choices.find((c) => c.id === installedId);
      if (!entry) return;
      const uri = await getLocalModelUriIfExists(entry.filename, entry.approxSizeBytes);
      if (!uri) {
        Alert.alert('Model missing', 'Re-download the model and try again.');
        await refreshInstalled();
        return;
      }
      resetLocalLlmInitCache();
      setLocalModelPath(uriToNativePath(uri));
      setLlmMode('local');
    } else {
      if (!remoteReady) return;
      setBaseUrl(ollamaUrl.trim().replace(/\/$/, ''));
      setOllamaModel(ollamaModelName.trim());
      setLlmMode('remote');
    }
    navigation.navigate('Tour');
  };

  const providerButtons = [
    {
      value: 'local' as const,
      label: 'On-device',
      icon: 'cellphone',
      disabled: !onDeviceAvailable,
    },
    {
      value: 'remote' as const,
      label: 'Use Ollama',
      icon: 'server-network',
    },
  ];

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="labelMedium" style={{ color: theme.colors.primary, marginBottom: 4 }}>
        STEP 2 OF 3
      </Text>
      <Text variant="headlineMedium" style={styles.title}>
        Bring your brain
      </Text>
      <Text variant="bodyMedium" style={[styles.blurb, { color: theme.colors.onSurfaceVariant }]}>
        AI Social needs a language model to generate posts. Download one to your phone, or point
        the app at your own Ollama server. You can swap later in Settings.
      </Text>

      <SegmentedButtons
        value={provider}
        onValueChange={(v) => setProvider(v as Provider)}
        buttons={providerButtons}
        style={styles.providerSwitch}
      />

      {!onDeviceAvailable && (
        <HelperText type="info" visible style={styles.helperInline}>
          On-device models require Android. Use Ollama for now.
        </HelperText>
      )}

      {provider === 'local' && (
        <>
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
                            <Chip
                              compact
                              mode="flat"
                              icon="check"
                              style={{
                                height: 24,
                                backgroundColor: theme.colors.primaryContainer,
                              }}
                              textStyle={{ fontSize: 10 }}
                            >
                              Installed
                            </Chip>
                          )}
                        </View>
                        <Text
                          variant="bodySmall"
                          style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}
                        >
                          ~{formatApproxSize(entry.approxSizeBytes)} download
                        </Text>
                      </View>
                      <RadioButton value={entry.id} />
                    </View>
                    <Text
                      variant="bodyMedium"
                      style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
                    >
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
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}
                >
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
                <Text
                  variant="labelSmall"
                  style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}
                >
                  Keep the screen on while this finishes — large downloads can take a few minutes
                  on Wi-Fi.
                </Text>
              </Card.Content>
            </Card>
          )}

          {!localReady && !downloading && (
            <Button
              mode="contained"
              icon="download"
              onPress={() => startDownload(selected)}
              loading={downloading}
              disabled={downloading || !onDeviceAvailable}
              style={styles.cta}
              contentStyle={{ paddingVertical: 6 }}
            >
              Download {selected.name.replace(/\s*\([^)]*\)\s*$/, '')}
            </Button>
          )}
        </>
      )}

      {provider === 'remote' && (
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.remoteHeader}>
              <Icon source="server-network" size={22} color={theme.colors.primary} />
              <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                Connect your Ollama server
              </Text>
            </View>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}
            >
              Run Ollama on a machine reachable from this device, then enter its URL and the name
              of a model you've already pulled. We'll verify the connection before continuing.
            </Text>

            <TextInput
              label="Ollama base URL"
              value={ollamaUrl}
              onChangeText={setOllamaUrl}
              mode="outlined"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://192.168.1.20:11434"
              style={styles.input}
            />
            <TextInput
              label="Model name"
              value={ollamaModelName}
              onChangeText={setOllamaModelName}
              mode="outlined"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="llama3.2"
              style={styles.input}
            />

            <Button
              mode="contained-tonal"
              icon="lan-connect"
              onPress={runOllamaTest}
              loading={ollamaTesting}
              disabled={
                ollamaTesting || !ollamaUrl.trim() || !ollamaModelName.trim()
              }
              style={{ marginTop: 4, borderRadius: 999 }}
              contentStyle={{ paddingVertical: 4 }}
            >
              {remoteReady ? 'Test again' : 'Test connection'}
            </Button>

            {ollamaResult && (
              <View
                style={[
                  styles.resultBox,
                  {
                    backgroundColor: ollamaResult.ok
                      ? theme.colors.primaryContainer
                      : theme.colors.errorContainer,
                  },
                ]}
              >
                <Icon
                  source={ollamaResult.ok ? 'check-circle' : 'alert-circle'}
                  size={18}
                  color={ollamaResult.ok ? theme.colors.primary : theme.colors.error}
                />
                <Text
                  variant="bodySmall"
                  style={{
                    flex: 1,
                    color: ollamaResult.ok
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.onErrorContainer,
                  }}
                >
                  {ollamaResult.message}
                </Text>
              </View>
            )}

            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}
            >
              Tip: launch Ollama with OLLAMA_HOST=0.0.0.0 so your phone can reach it on the LAN.
            </Text>
          </Card.Content>
        </Card>
      )}

      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="arrow-right"
          onPress={onContinue}
          disabled={!canContinue || downloading}
          style={styles.cta}
          contentStyle={{ paddingVertical: 6 }}
        >
          Continue
        </Button>
        {!canContinue && (
          <Text
            variant="labelSmall"
            style={{
              color: theme.colors.onSurfaceVariant,
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            {provider === 'local'
              ? 'Download a model above to continue, or switch to Ollama.'
              : 'Test the Ollama connection above to continue, or switch to On-device.'}
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 60 },
  title: { fontWeight: '700', marginBottom: 6 },
  blurb: { marginBottom: 18 },
  providerSwitch: { marginBottom: 14 },
  helperInline: { marginTop: -8, marginBottom: 8 },
  card: { marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  progress: { height: 10, borderRadius: 6 },
  actions: { marginTop: 16 },
  cta: { borderRadius: 999 },
  remoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  input: { marginBottom: 10 },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
  },
});
