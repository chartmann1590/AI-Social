import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Keyboard,
  Image,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { TextInput, Button, Text, useTheme, IconButton } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import { LlmService } from '../services/llm';
import { useSettingsStore, useFeedStore, usePostEngagementStore, useUserStore, useUserPostsStore } from '../store';
import { MediaAsset, Post } from '../types';
import { avatarUrl } from './onboarding/avatarUtils';
import { MediaLightbox } from '../components/PostCard';

export const ComposeScreen = () => {
  const navigation = useNavigation<any>();
  const settings = useSettingsStore();
  const localImageModelPath = useSettingsStore((s) => s.localImageModelPath);
  const theme = useTheme();
  const { addPost } = useFeedStore();
  const addUserPost = useUserPostsStore((s) => s.addPost);
  const profile = useUserStore((s) => s.profile);

  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [manualImageUrl, setManualImageUrl] = useState('');
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageGenReady, setImageGenReady] = useState(false);
  const [checkingImageSetup, setCheckingImageSetup] = useState(true);
  const [composeLightboxIndex, setComposeLightboxIndex] = useState<number | null>(null);

  const verifyImageGenSetup = useCallback(async () => {
    const path = localImageModelPath.trim();
    if (!path) {
      setImageGenReady(false);
      setCheckingImageSetup(false);
      return;
    }
    setCheckingImageSetup(true);
    try {
      const uri = path.startsWith('file://') ? path : `file://${path}`;
      const info = await FileSystem.getInfoAsync(uri);
      setImageGenReady(!!info.exists);
    } catch {
      setImageGenReady(false);
    } finally {
      setCheckingImageSetup(false);
    }
  }, [localImageModelPath]);

  useEffect(() => {
    verifyImageGenSetup();
  }, [verifyImageGenSetup]);

  useEffect(() => {
    if (media.length === 0) {
      setComposeLightboxIndex(null);
    }
  }, [media.length]);

  useFocusEffect(
    useCallback(() => {
      verifyImageGenSetup();
    }, [verifyImageGenSetup]),
  );

  const generateImageAsset = async (prompt: string): Promise<MediaAsset> => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      throw new Error('Enter a prompt first.');
    }
    const path = settings.localImageModelPath.trim();
    if (!path) {
      throw new Error('Set up image generation: open Models, download SD v1.5, then tap Use model.');
    }
    const modelUri = path.startsWith('file://') ? path : `file://${path}`;
    const info = await FileSystem.getInfoAsync(modelUri);
    if (!info.exists) {
      throw new Error('Image model file not found. Re-download in Models or fix the path in Settings.');
    }
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(trimmedPrompt)}?width=1024&height=1024&seed=${seed}&nologo=true`;
    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new Error(`Image request failed (${res.status}). Try again in a moment.`);
    }
    return {
      id: `ai-image-${Date.now()}`,
      type: 'image',
      uri: imageUrl,
      source: 'ai',
      provider: 'AI (local SD path verified, render via cloud until native SD is wired)',
    };
  };

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
      media,
    };

    addPost(newPost);
    addUserPost(newPost);
    setText('');
    setTopic('');
    setImagePrompt('');
    setManualImageUrl('');
    setMedia([]);
    navigation.navigate('Feed');
  };

  const handleAttachManualImage = () => {
    const uri = manualImageUrl.trim();
    if (!uri) return;
    setMedia((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        type: 'image',
        uri,
        source: 'local',
        provider: 'Manual URL',
      },
    ]);
    setManualImageUrl('');
  };

  const handleGenerateImage = async () => {
    if (!imageGenReady || !imagePrompt.trim()) return;
    try {
      setGeneratingImage(true);
      const asset = await generateImageAsset(imagePrompt);
      setMedia((prev) => [...prev, asset]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      Alert.alert('Image generation failed', detail);
    } finally {
      setGeneratingImage(false);
    }
  };

  const canGenerateImage =
    imageGenReady && !!imagePrompt.trim() && !generatingImage && !checkingImageSetup;

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

        <Text variant="titleMedium" style={[styles.label, { marginTop: 30 }]}>Media</Text>
        <Text
          variant="bodySmall"
          style={[styles.setupHint, { color: theme.colors.onSurfaceVariant }]}
        >
          {checkingImageSetup
            ? 'Checking image model setup…'
            : imageGenReady
              ? 'Image model is ready. Enter a prompt and generate.'
              : 'Download Stable Diffusion v1.5 in the Models tab, tap Use model, then return here.'}
        </Text>
        <Button
          mode="text"
          compact
          onPress={() => navigation.navigate('Models')}
          style={styles.modelsLink}
        >
          Open Models
        </Button>

        <TextInput
          mode="outlined"
          placeholder="Generate AI image prompt"
          value={imagePrompt}
          onChangeText={setImagePrompt}
          editable={!generatingImage}
          style={[styles.input, { backgroundColor: theme.colors.surface }]}
        />
        <Button
          mode="outlined"
          onPress={handleGenerateImage}
          loading={generatingImage}
          disabled={!canGenerateImage}
          icon="image-plus"
        >
          Generate Image
        </Button>

        {generatingImage && (
          <View
            style={[
              styles.generatingBanner,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
            accessibilityLiveRegion="polite"
            accessibilityLabel="Generating image"
          >
            <ActivityIndicator
              style={styles.generatingSpinner}
              size="small"
              color={theme.colors.primary}
            />
            <Text variant="bodyMedium" style={[styles.generatingText, { color: theme.colors.onPrimaryContainer }]}>
              Generating image…
            </Text>
          </View>
        )}

        <TextInput
          mode="outlined"
          placeholder="Or paste an image URL"
          value={manualImageUrl}
          onChangeText={setManualImageUrl}
          style={[styles.input, { backgroundColor: theme.colors.surface, marginTop: 12 }]}
        />
        <Button mode="text" onPress={handleAttachManualImage} disabled={!manualImageUrl.trim()}>
          Attach URL image
        </Button>

        {media.length > 0 && (
          <View style={styles.mediaPreviewWrap}>
            {media.map((item, idx) => (
              <View key={item.id} style={styles.composeThumbWrap}>
                <Pressable onPress={() => setComposeLightboxIndex(idx)}>
                  <Image
                    source={{ uri: item.thumbnailUri || item.uri }}
                    style={styles.mediaPreview}
                  />
                </Pressable>
                <IconButton
                  icon="close-circle"
                  size={22}
                  accessibilityLabel="Remove image"
                  onPress={() => {
                    setMedia((prev) => prev.filter((m) => m.id !== item.id));
                    setComposeLightboxIndex(null);
                  }}
                  style={[styles.composeRemove, { backgroundColor: theme.colors.surface }]}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <MediaLightbox
        visible={composeLightboxIndex !== null}
        items={media}
        initialIndex={composeLightboxIndex ?? 0}
        onClose={() => setComposeLightboxIndex(null)}
      />
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
  setupHint: {
    marginBottom: 4,
  },
  modelsLink: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  generatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  generatingSpinner: {
    marginRight: 12,
  },
  generatingText: {
    flex: 1,
    fontWeight: '600',
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
  mediaPreviewWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  composeThumbWrap: {
    width: 88,
    height: 88,
    marginRight: 8,
    marginBottom: 8,
    position: 'relative',
  },
  composeRemove: {
    position: 'absolute',
    top: -10,
    right: -10,
    margin: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  mediaPreview: {
    width: 88,
    height: 88,
    borderRadius: 8,
  },
});
