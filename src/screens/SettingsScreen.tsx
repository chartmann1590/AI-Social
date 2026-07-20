import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Platform, NativeModules } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  TextInput,
  Button,
  Switch,
  Text,
  Divider,
  SegmentedButtons,
  useTheme,
} from 'react-native-paper';
import { useSettingsStore, useUserStore } from '../store';
import { DEFAULT_CONFIG } from '../config';
import type { LlmMode } from '../types';
import { cancelDailyReminder, scheduleDailyReminder } from '../services/notifications';

const nativeLiteRtPresent =
  Platform.OS === 'android' && NativeModules.AISocialLiteRtLlm != null;

export const SettingsScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const {
    baseUrl,
    model,
    useStreaming,
    themePreference,
    llmMode,
    enableRemoteFallback,
    localModelPath,
    localImageModelPath,
    localMaxTokens,
    localTemperature,
    pixabayApiKey,
    dailyReminderEnabled,
    setBaseUrl,
    setModel,
    setUseStreaming,
    setThemePreference,
    setLlmMode,
    setEnableRemoteFallback,
    setLocalModelPath,
    setLocalImageModelPath,
    setLocalMaxTokens,
    setLocalTemperature,
    setPixabayApiKey,
    setDailyReminderEnabled,
  } = useSettingsStore();

  const [localReady, setLocalReady] = useState<boolean | null>(null);
  const [checkingLocal, setCheckingLocal] = useState(false);

  const defaultUrl = DEFAULT_CONFIG.OLLAMA_BASE_URL || 'http://<your-server>:11434';
  const defaultModel = DEFAULT_CONFIG.OLLAMA_MODEL || 'llama3.2';

  const probeLocal = useCallback(async () => {
    if (!nativeLiteRtPresent) {
      setLocalReady(false);
      return;
    }
    const mod = NativeModules.AISocialLiteRtLlm as { isReady?: () => Promise<boolean> };
    if (!mod.isReady) {
      setLocalReady(false);
      return;
    }
    setCheckingLocal(true);
    try {
      const ok = await mod.isReady();
      setLocalReady(ok);
    } catch {
      setLocalReady(false);
    } finally {
      setCheckingLocal(false);
    }
  }, []);

  useEffect(() => {
    probeLocal();
  }, [probeLocal, localModelPath]);

  const llmModeButtons = [
    { value: 'hybrid' as const, label: 'Hybrid' },
    { value: 'local' as const, label: 'On-device' },
    { value: 'remote' as const, label: 'Remote' },
  ];

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="headlineMedium" style={styles.header}>
        Configuration
      </Text>

      <Button mode="text" icon="information-outline" compact onPress={() => navigation.navigate('About')} style={styles.aboutLink}>
        About this app
      </Button>

      <Button mode="contained-tonal" icon="download" onPress={() => navigation.navigate('Models')} style={styles.modelsLink}>
        Download models (Gemma, Qwen, DeepSeek, SD v1.5)
      </Button>

      <Button mode="contained-tonal" icon="gift-outline" onPress={() => navigation.navigate('Rewards')} style={styles.modelsLink}>
        Rewards and ad-free time
      </Button>

      <Button
        mode="contained-tonal"
        icon="bug-outline"
        onPress={() => {
          NativeModules.AISocialFeedback?.launchFeedback();
        }}
        style={styles.modelsLink}
      >
        Support & Feedback (Bug Reporter)
      </Button>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyLarge">Daily reminder</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            A once-a-day local notification — nothing is sent to a server.
          </Text>
        </View>
        <Switch
          value={dailyReminderEnabled}
          onValueChange={async (enabled) => {
            setDailyReminderEnabled(enabled);
            if (enabled) {
              const ok = await scheduleDailyReminder(19, 0);
              if (!ok) setDailyReminderEnabled(false);
            } else {
              await cancelDailyReminder();
            }
          }}
        />
      </View>

      <Text variant="titleSmall" style={styles.sectionTitle}>
        LLM mode
      </Text>
      <SegmentedButtons
        value={llmMode}
        onValueChange={(value) => setLlmMode(value as LlmMode)}
        buttons={llmModeButtons}
      />
      <Text variant="bodySmall" style={[styles.helper, { color: theme.colors.onSurfaceVariant }]}>
        Hybrid tries on-device first, then Ollama if enabled below. Remote uses Ollama only.
      </Text>

      <View style={styles.row}>
        <Text variant="bodyLarge">Remote fallback (hybrid)</Text>
        <Switch value={enableRemoteFallback} onValueChange={setEnableRemoteFallback} />
      </View>

      <Divider style={styles.divider} />

      <Text variant="titleSmall" style={styles.sectionTitle}>
        On-device (Android + dev build)
      </Text>
      <Text variant="bodySmall" style={[styles.helper, { color: theme.colors.onSurfaceVariant }]}>
        {nativeLiteRtPresent
          ? 'Native module present. Push a MediaPipe `.task` model to the device and set the absolute path.'
          : 'Expo Go cannot load this module. Run `npx expo run:android` once, then use `npm start` and open the dev client app (not Expo Go).'}
      </Text>
      {nativeLiteRtPresent && (
        <Text variant="bodySmall" style={[styles.helper, { color: theme.colors.primary }]}>
          Engine status:{' '}
          {checkingLocal
            ? 'Checking…'
            : localReady === null
              ? '—'
              : localReady
                ? 'Initialized'
                : 'Not initialized (set model path & use feed)'}
        </Text>
      )}
      <TextInput
        label="Local model absolute path"
        value={localModelPath}
        onChangeText={setLocalModelPath}
        mode="outlined"
        placeholder="/data/local/tmp/llm/your_model.task"
        style={[styles.input, { backgroundColor: theme.colors.surface }]}
      />
      <TextInput
        label="Max tokens (local)"
        value={String(localMaxTokens)}
        onChangeText={(t) => {
          const n = parseInt(t.replace(/[^\d]/g, ''), 10);
          if (!Number.isNaN(n)) setLocalMaxTokens(Math.min(8192, Math.max(256, n)));
        }}
        keyboardType="number-pad"
        mode="outlined"
        style={[styles.input, { backgroundColor: theme.colors.surface }]}
      />
      <TextInput
        label="Temperature (local)"
        value={String(localTemperature)}
        onChangeText={(t) => {
          const n = parseFloat(t.replace(/[^\d.]/g, ''));
          if (!Number.isNaN(n)) setLocalTemperature(Math.min(2, Math.max(0, n)));
        }}
        keyboardType="decimal-pad"
        mode="outlined"
        style={[styles.input, { backgroundColor: theme.colors.surface }]}
      />
      <TextInput
        label="Local image model absolute path"
        value={localImageModelPath}
        onChangeText={setLocalImageModelPath}
        mode="outlined"
        placeholder="/data/user/0/.../v1-5-pruned-emaonly.safetensors"
        style={[styles.input, { backgroundColor: theme.colors.surface }]}
      />

      <Divider style={styles.divider} />

      <Text variant="titleSmall" style={styles.sectionTitle}>
        Media search
      </Text>
      <TextInput
        label="Pixabay API key"
        value={pixabayApiKey}
        onChangeText={setPixabayApiKey}
        mode="outlined"
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { backgroundColor: theme.colors.surface }]}
      />
      <Text variant="bodySmall" style={[styles.helper, { color: theme.colors.onSurfaceVariant }]}>
        Create a free key at pixabay.com/api/docs and paste it here for Media tab search.
      </Text>

      <Divider style={styles.divider} />

      <Text variant="titleSmall" style={styles.sectionTitle}>
        Ollama (remote)
      </Text>
      <TextInput
        label="Ollama Base URL"
        value={baseUrl}
        onChangeText={setBaseUrl}
        mode="outlined"
        placeholder={defaultUrl}
        style={[styles.input, { backgroundColor: theme.colors.surface }]}
      />
      <Text variant="bodySmall" style={[styles.helper, { color: theme.colors.onSurfaceVariant }]}>
        Use your Ollama host's LAN / VPN URL. Leave empty if using On-device only.
      </Text>

      <TextInput
        label="Model Name"
        value={model}
        onChangeText={setModel}
        mode="outlined"
        placeholder={defaultModel}
        style={[styles.input, { backgroundColor: theme.colors.surface }]}
      />
      <Text variant="bodySmall" style={[styles.helper, { color: theme.colors.onSurfaceVariant }]}>
        e.g., llama3.2, mistral, gemma2
      </Text>

      <Divider style={styles.divider} />

      <View style={styles.row}>
        <Text variant="bodyLarge">Use Streaming (Experimental)</Text>
        <Switch value={useStreaming} onValueChange={setUseStreaming} />
      </View>

      <Divider style={styles.divider} />

      <Text variant="bodyLarge" style={styles.sectionTitle}>
        Theme
      </Text>
      <SegmentedButtons
        value={themePreference}
        onValueChange={(value) => setThemePreference(value as typeof themePreference)}
        buttons={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />
      <Text variant="bodySmall" style={[styles.helper, { color: theme.colors.onSurfaceVariant }]}>
        System follows your device appearance.
      </Text>

      <Button mode="contained" onPress={() => {}} style={styles.saveButton} disabled>
        Settings Auto-Saved
      </Button>

      <Button
        mode="outlined"
        icon="restart"
        onPress={() => useUserStore.getState().resetOnboarding()}
        style={{ marginTop: 16 }}
      >
        Re-run onboarding
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 4,
  },
  aboutLink: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  modelsLink: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 5,
    backgroundColor: 'white',
  },
  helper: {
    marginBottom: 15,
  },
  divider: {
    marginVertical: 20,
  },
  sectionTitle: {
    marginBottom: 10,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  saveButton: {
    marginTop: 40,
  },
});
