import React, { forwardRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import ViewShot from 'react-native-view-shot';
import type { Post } from '../types';

interface ShareablePostCardProps {
  post: Post;
}

/**
 * Rendered off-screen (see PostCard's shareViewRef) purely so react-native-view-shot
 * has something branded to capture — deliberately excludes the report/like/comment
 * action row that PostCard shows on-device, since none of that makes sense in a
 * screenshot someone shares outside the app.
 */
export const ShareablePostCard = forwardRef<ViewShot, ShareablePostCardProps>(({ post }, ref) => {
  const media = post.media?.[0];

  return (
    <ViewShot ref={ref} options={{ format: 'png', quality: 1 }}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Avatar.Image size={44} source={{ uri: post.author.avatar }} />
          <View style={styles.headerText}>
            <Text variant="titleMedium" style={styles.name}>{post.author.name}</Text>
            <Text variant="bodySmall" style={styles.handle}>{post.author.handle}</Text>
          </View>
        </View>
        <Text variant="bodyLarge" style={styles.content}>{post.content}</Text>
        {media?.type === 'image' && (
          <Image source={{ uri: media.uri }} style={styles.media} resizeMode="cover" />
        )}
        <View style={styles.footer}>
          <Text variant="labelMedium" style={styles.watermark}>AI Social — a make-believe feed, written by AI</Text>
        </View>
      </View>
    </ViewShot>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: '#141026',
    padding: 20,
    borderRadius: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerText: {
    marginLeft: 12,
  },
  name: {
    color: '#fff',
    fontWeight: '700',
  },
  handle: {
    color: '#b8adf0',
  },
  content: {
    color: '#f2f0fa',
    lineHeight: 24,
  },
  media: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginTop: 14,
  },
  footer: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  watermark: {
    color: '#8a7fc0',
  },
});
