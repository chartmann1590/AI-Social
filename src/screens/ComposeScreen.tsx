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
import { buildSafeImagePrompt, checkImagePrompt, checkTextSafety } from '../services/imageSafety';
import { BlockedImageError, deleteCheckedImage, fetchAndScreenImage } from '../services/safeImage';
import { ReportContentDialog } from '../components/ReportContentDialog';
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
  const [reportedMedia, setReportedMedia] = useState<MediaAsset | null>(null);

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
    // Layer 1: prompt filter BEFORE any network request. A blocked prompt
    // throws "Not allowed ..." here and never reaches the image provider
    // (src/services/imageSafety.ts).
    const safePrompt = buildSafeImagePrompt(trimmedPrompt);
    const seed = Math.floor(Math.random() * 1000000);
    // Layer 2: the provider's strict safe filter (safe=true) + safe framing.
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?width=1024&height=1024&seed=${seed}&nologo=true&safe=true&private=true`;
    // Layer 3: download, classify the pixels on-device, discard if flagged.
    // Only the checked local file is ever displayed.
    const localUri = await fetchAndScreenImage(imageUrl, `ai-${seed}`);
    return {
      id: `ai-image-${Date.now()}`,
      type: 'image',
      uri: localUri,
      source: 'ai',
      provider: 'AI image (safety checked on this phone)',
    };
  };

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

  const handleAttachManualImage = async () => {
    const uri = manualImageUrl.trim();
    if (!uri) return;
    // Same prompt filter on the URL text, then the same on-device pixel
    // classifier as generated images. Only the checked local copy is used.
    if (!checkImagePrompt(uri).allowed) {
      Alert.alert(
        'Not allowed',
        'That image link looks like sexual or explicit content, which AI Social does not allow.',
      );
      return;
    }
    try {
      setGeneratingImage(true);
      const localUri = await fetchAndScreenImage(uri, 'manual');
      setMedia((prev) => [
        ...prev,
        {
          id: `manual-${Date.now()}`,
          type: 'image',
          uri: localUri,
          source: 'local',
          provider: 'Image link (safety checked on this phone)',
        },
      ]);
      setManualImageUrl('');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      Alert.alert(error instanceof BlockedImageError ? 'Not allowed' : 'Could not attach image', detail);
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imageGenReady || !imagePrompt.trim()) return;
    try {
      setGeneratingImage(true);
      const asset = await generateImageAsset(imagePrompt);
      setMedia((prev) => [...prev, asset]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const blocked = error instanceof BlockedImageError || /^Not allowed/.test(detail);
      Alert.alert(blocked ? 'Not allowed' : 'Image generation failed', detail);
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
        <Text
          variant="bodySmall"
          style={[styles.setupHint, { color: theme.colors.onSurfaceVariant }]}
        >
          AI images are always filtered: sexual, nude or revealing prompts are blocked before anything is
          generated, the image service runs in strict safe mode, and every image is checked on this phone
          and discarded if it is not appropriate. Tap the flag on any image, post or comment to report it.
        </Text>

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
                    deleteCheckedImage(item.uri).catch(() => {});
                  }}
                  style={[styles.composeRemove, { backgroundColor: theme.colors.surface }]}
                />
                <IconButton
                  icon="flag-outline"
                  size={20}
                  accessibilityLabel="Report this image"
                  onPress={() => setReportedMedia(item)}
                  style={[styles.composeReport, { backgroundColor: theme.colors.surface }]}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <ReportContentDialog
        visible={reportedMedia !== null}
        onDismiss={() => setReportedMedia(null)}
        contentType="image"
        contentId={reportedMedia?.id ?? ''}
        content={reportedMedia ? `AI image: ${reportedMedia.provider ?? ''} ${imagePrompt.trim()}`.trim() : ''}
        onReported={() => {
          const item = reportedMedia;
          if (!item) return;
          setMedia((prev) => prev.filter((m) => m.id !== item.id));
          deleteCheckedImage(item.uri).catch(() => {});
        }}
      />

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
  composeReport: {
    position: 'absolute',
    bottom: -10,
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
