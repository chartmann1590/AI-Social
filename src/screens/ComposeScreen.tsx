import React, { useState } from 'react';
import { View, StyleSheet, Alert, Keyboard, ScrollView } from 'react-native';
import { TextInput, Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { LlmService } from '../services/llm';
import { checkTextSafety } from '../services/imageSafety';
import { useSettingsStore, useFeedStore, usePostEngagementStore, useUserStore, useUserPostsStore } from '../store';
import { Post } from '../types';
import { avatarUrl } from './onboarding/avatarUtils';

/**
 * Text-only composer. The app has no image generation, image links or media
 * import: posts are text, and every post and AI draft goes through the on-device
 * content filter (src/services/imageSafety.ts checkTextSafety) before it is saved.
 */
export const ComposeScreen = () => {
  const navigation = useNavigation<any>();
  const settings = useSettingsStore();
  const theme = useTheme();
  const { addPost } = useFeedStore();
  const addUserPost = useUserPostsStore((s) => s.addPost);
  const profile = useUserStore((s) => s.profile);

  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      Alert.alert('Topic Required', 'Please enter a topic for the AI to write about.');
      return;
    }
    const topicCheck = checkTextSafety(topic);
    if (!topicCheck.allowed) {
      Alert.alert('Not allowed', topicCheck.reason ?? 'That topic is not allowed.');
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
    const textCheck = checkTextSafety(text);
    if (!textCheck.allowed) {
      Alert.alert('Not allowed', textCheck.reason ?? 'That post is not allowed.');
      return;
    }
    const postId = Date.now().toString();
    const likes = usePostEngagementStore.getState().ensureLikeCount(postId, 3, 48);

    const newPost: Post = {
      id: postId,
      author: {
        id: 'me',
        name: profile.name || 'Me',
        handle: `@${profile.handle || 'me'}`,
        avatar: avatarUrl(profile.avatarSeed || 'me', 128),
      },
      content: text,
      createdAt: new Date().toISOString(),
      likes,
      commentsCount: 0,
    };

    addPost(newPost);
    addUserPost(newPost);
    setText('');
    setTopic('');
    navigation.navigate('Feed');
  };

  return (
    <View style={[styles.outer, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
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
        <Text
          variant="bodySmall"
          style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
        >
          Posts are text only. Sexual, explicit or hateful topics and drafts are blocked on this phone.
          Tap the flag on any AI post or comment to report it.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    marginBottom: 10,
  },
  hint: {
    marginTop: 12,
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
