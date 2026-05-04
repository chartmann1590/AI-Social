import React, { useState } from 'react';
import { View, StyleSheet, Alert, Keyboard } from 'react-native';
import { TextInput, Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { LlmService } from '../services/llm';
import { useSettingsStore, useFeedStore, useUserStore } from '../store';
import { Post } from '../types';
import { avatarUrl } from './onboarding/avatarUtils';

export const ComposeScreen = () => {
  const navigation = useNavigation<any>();
  const settings = useSettingsStore();
  const theme = useTheme();
  const { addPost } = useFeedStore();
  const profile = useUserStore((s) => s.profile);

  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      Alert.alert('Topic Required', 'Please enter a topic for the AI to write about.');
      return;
    }
    setLoading(true);
    Keyboard.dismiss();
    try {
      const generated = await LlmService.generateDraft(settings, topic);
      setText(generated);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      Alert.alert('Failed to generate draft', detail);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = () => {
    if (!text.trim()) return;

    const newPost: Post = {
      id: Date.now().toString(),
      author: {
        id: 'me',
        name: profile.name || 'Me',
        handle: `@${profile.handle || 'me'}`,
        avatar: avatarUrl(profile.avatarSeed || 'me', 128),
      },
      content: text,
      createdAt: new Date().toISOString(),
      likes: 0,
      commentsCount: 0,
    };

    addPost(newPost);
    setText('');
    setTopic('');
    navigation.navigate('Feed');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="titleMedium" style={styles.label}>What's on your mind?</Text>
      
      <TextInput
        mode="outlined"
        placeholder="Post content..."
        multiline
        numberOfLines={6}
        value={text}
        onChangeText={setText}
        style={[styles.input, { backgroundColor: theme.colors.surface }]}
      />

      <View style={styles.row}>
        <Button mode="contained" onPress={handlePost} disabled={!text.trim()}>
          Post
        </Button>
      </View>

      <Text variant="titleMedium" style={[styles.label, { marginTop: 30 }]}>AI Assistant</Text>
      <TextInput
        mode="outlined"
        placeholder="Enter a topic (e.g., 'Coffee on a rainy day')"
        value={topic}
        onChangeText={setTopic}
        style={[styles.input, { backgroundColor: theme.colors.surface }]}
      />
      <Button 
        mode="outlined" 
        onPress={handleGenerate} 
        loading={loading}
        icon="magic-staff"
        style={styles.aiButton}
      >
        Generate Draft
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
  },
  label: {
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'white',
    marginBottom: 10,
  },
  row: {
    alignItems: 'flex-end',
  },
  aiButton: {
    marginTop: 10,
  },
});
