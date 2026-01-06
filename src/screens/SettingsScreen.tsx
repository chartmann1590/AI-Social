import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Switch, Text, Divider, SegmentedButtons, useTheme } from 'react-native-paper';
import { useSettingsStore } from '../store';
import { DEFAULT_CONFIG } from '../config';

export const SettingsScreen = () => {
  const theme = useTheme();
  const {
    baseUrl,
    model,
    useStreaming,
    themePreference,
    setBaseUrl,
    setModel,
    setUseStreaming,
    setThemePreference,
  } = useSettingsStore();

  // Load defaults from config
  const defaultUrl = DEFAULT_CONFIG.OLLAMA_BASE_URL;
  const defaultModel = DEFAULT_CONFIG.OLLAMA_MODEL;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineMedium" style={styles.header}>Configuration</Text>
      
      <TextInput
        label="Ollama Base URL"
        value={baseUrl}
        onChangeText={setBaseUrl}
        mode="outlined"
        placeholder={defaultUrl}
        style={[styles.input, { backgroundColor: theme.colors.surface }]}
      />
      <Text variant="bodySmall" style={[styles.helper, { color: theme.colors.onSurfaceVariant }]}>
        e.g., http://192.168.1.50:11434 (Use LAN IP for physical devices)
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

      <Text variant="bodyLarge" style={styles.sectionTitle}>Theme</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    marginBottom: 20,
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
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveButton: {
    marginTop: 40,
  },
});
