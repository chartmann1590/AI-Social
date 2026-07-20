import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Text, Avatar, IconButton, useTheme } from 'react-native-paper';
import * as Sharing from 'expo-sharing';
import type ViewShot from 'react-native-view-shot';
import type { MediaAsset, Post } from '../types';
import { formatAbsoluteForA11y, formatRelativeTime } from '../utils/time';
import { ReportContentDialog } from './ReportContentDialog';
import { ShareablePostCard } from './ShareablePostCard';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type LightboxProps = {
  visible: boolean;
  items: MediaAsset[];
  initialIndex: number;
  onClose: () => void;
};

export function MediaLightbox({ visible, items, initialIndex, onClose }: LightboxProps) {
  const theme = useTheme();
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) {
      const safe = Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1));
      setIndex(safe);
    }
  }, [visible, initialIndex, items.length]);

  if (!items.length) {
    return null;
  }

  const safeIndex = Math.min(Math.max(0, index), items.length - 1);
  const asset = items[safeIndex]!;
  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(items.length - 1, i + 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[lightboxStyles.root, { backgroundColor: 'rgba(0,0,0,0.92)' }]}>
        <View style={lightboxStyles.topBar}>
          <IconButton icon="close" iconColor="#fff" onPress={onClose} accessibilityLabel="Close" />
          {items.length > 1 && (
            <Text variant="labelLarge" style={lightboxStyles.counter}>
              {safeIndex + 1} / {items.length}
            </Text>
          )}
        </View>

        <View style={lightboxStyles.mainTap}>
          <View style={lightboxStyles.mediaArea}>
            {asset.type === 'video' ? (
              <View style={lightboxStyles.videoWrap}>
                <Image
                  source={{ uri: asset.thumbnailUri || asset.uri }}
                  style={lightboxStyles.fullImage}
                  resizeMode="contain"
                />
                <Pressable
                  style={[lightboxStyles.playBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() => {
                    if (asset.uri) {
                      Linking.openURL(asset.uri).catch(() => {});
                    }
                  }}
                >
                  <Text variant="titleMedium" style={{ color: theme.colors.onPrimary }}>
                    Open video
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Image
                source={{ uri: asset.uri }}
                style={lightboxStyles.fullImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>

        {items.length > 1 && (
          <View style={lightboxStyles.navRow}>
            <IconButton
              icon="chevron-left"
              iconColor="#fff"
              disabled={safeIndex === 0}
              onPress={goPrev}
              accessibilityLabel="Previous"
            />
            <IconButton
              icon="chevron-right"
              iconColor="#fff"
              disabled={safeIndex >= items.length - 1}
              onPress={goNext}
              accessibilityLabel="Next"
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

interface PostCardProps {
  post: Post;
  onPress?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onPress }) => {
  const theme = useTheme();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareViewRef = useRef<ViewShot>(null);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing unavailable', 'Sharing isn’t supported on this device.');
        return;
      }
      const uri = await shareViewRef.current?.capture?.();
      if (!uri) throw new Error('Could not render a shareable image.');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share this post' });
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'Unknown error';
      Alert.alert('Could not share this post', detail);
    } finally {
      setSharing(false);
    }
  };

  const media = post.media ?? [];

  const relative = formatRelativeTime(post.createdAt);
  const subtitle = `${post.author.handle} · ${relative}`;
  const a11yWhen = formatAbsoluteForA11y(post.createdAt);
  const a11yLabel = a11yWhen
    ? `Post by ${post.author.name} at ${a11yWhen}. ${post.content.slice(0, 200)}`
    : `Post by ${post.author.name}. ${post.content.slice(0, 200)}`;

  return (
    <Card style={styles.card} mode="elevated">
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityLabel={a11yLabel}
        accessibilityRole={onPress ? 'button' : undefined}
      >
        <Card.Title
          title={post.author.name}
          subtitle={subtitle}
          subtitleStyle={{ color: theme.colors.onSurfaceVariant }}
          left={(props) => <Avatar.Image {...props} source={{ uri: post.author.avatar }} />}
        />
        <Card.Content>
          <Text variant="bodyMedium" style={styles.content}>{post.content}</Text>
        </Card.Content>
      </Pressable>

      {media.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mediaScroll}
        >
          {media.map((item, idx) => (
            <Pressable
              key={item.id}
              onPress={() => setLightboxIndex(idx)}
              style={[styles.thumbWrap, { borderColor: theme.colors.outlineVariant }]}
              accessibilityRole="imagebutton"
              accessibilityLabel={item.type === 'video' ? 'View video' : 'View full size image'}
            >
              <Image
                source={{ uri: item.thumbnailUri || item.uri }}
                style={styles.thumb}
              />
              {item.type === 'video' && (
                <View style={styles.videoBadge} pointerEvents="none">
                  <Ionicons name="play-circle" size={52} color="rgba(255,255,255,0.95)" />
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Card.Actions>
        <View style={styles.actionRow}>
          <IconButton icon="heart-outline" size={20} />
          <Text>{post.likes}</Text>
        </View>
        <View style={styles.actionRow}>
          <IconButton icon="comment-outline" size={20} />
          <Text>{post.commentsCount}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <IconButton
          icon="share-outline"
          size={20}
          onPress={handleShare}
          disabled={sharing}
          accessibilityLabel="Share this post as an image"
        />
        <IconButton
          icon="flag-outline"
          size={20}
          onPress={() => setReportVisible(true)}
          accessibilityLabel="Report this post"
        />
      </Card.Actions>

      <MediaLightbox
        visible={lightboxIndex !== null}
        items={media}
        initialIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
      />

      <ReportContentDialog
        visible={reportVisible}
        onDismiss={() => setReportVisible(false)}
        contentType="post"
        content={post.content}
      />

      {/* Off-screen: exists only so react-native-view-shot has a branded card to capture. */}
      <View style={styles.offscreen} pointerEvents="none">
        <ShareablePostCard post={post} ref={shareViewRef} />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
    marginHorizontal: 10,
  },
  offscreen: {
    position: 'absolute',
    top: 0,
    left: -9999,
    opacity: 0,
  },
  content: {
    marginTop: 5,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  mediaScroll: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  thumbWrap: {
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    marginRight: 8,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});

const lightboxStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  counter: {
    color: '#fff',
    marginRight: 16,
  },
  mainTap: {
    flex: 1,
    justifyContent: 'center',
  },
  mediaArea: {
    width: SCREEN_W,
    minHeight: SCREEN_H * 0.65,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_W,
    height: SCREEN_H * 0.72,
  },
  videoWrap: {
    alignItems: 'center',
    width: '100%',
  },
  playBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 24,
  },
});
