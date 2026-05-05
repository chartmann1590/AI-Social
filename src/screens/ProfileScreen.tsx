import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import {
  Button,
  Chip,
  Divider,
  Text,
  useTheme,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { PostCard } from '../components/PostCard';
import { usePostCommentsStore, useUserPostsStore, useUserStore, useSettingsStore } from '../store';
import { MediaAsset, Post } from '../types';
import { avatarUrl } from './onboarding/avatarUtils';

type ProfileReplyItem = {
  id: string;
  postId: string;
  postPreview: string;
  content: string;
  createdAt: string;
};

type ProfileMediaItem = {
  id: string;
  postId: string;
  createdAt: string;
  media: MediaAsset;
};

type Tab = 'posts' | 'replies' | 'media';

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatJoined(ts: number): string {
  if (!ts) return 'Just joined';
  const d = new Date(ts);
  const month = d.toLocaleString('en-US', { month: 'long' });
  return `Joined ${month} ${d.getFullYear()}`;
}

function fakeFollowCounts(handle: string): { followers: number; following: number } {
  const h = hashString(handle || 'aisocial');
  // Stable, cosmetic, obviously local-only.
  const followers = 120 + (h % 4800);
  const following = 30 + ((h >>> 7) % 480);
  return { followers, following };
}

function selectRepliesForProfile(
  commentsByPostId: Record<string, { id: string; author: { id: string }; content: string; createdAt: string }[]>,
  posts: Post[],
): ProfileReplyItem[] {
  const postMap = new Map(posts.map((post) => [post.id, post]));
  const replies: ProfileReplyItem[] = [];
  for (const [postId, comments] of Object.entries(commentsByPostId)) {
    const parentPost = postMap.get(postId);
    const postPreview = parentPost?.content ?? 'Original post';
    for (const comment of comments) {
      if (comment.author.id !== 'me') continue;
      replies.push({
        id: comment.id,
        postId,
        postPreview,
        content: comment.content,
        createdAt: comment.createdAt,
      });
    }
  }
  replies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return replies;
}

function selectMediaForProfile(posts: Post[]): ProfileMediaItem[] {
  const items: ProfileMediaItem[] = [];
  for (const post of posts) {
    for (const media of post.media ?? []) {
      items.push({
        id: `${post.id}-${media.id}`,
        postId: post.id,
        createdAt: post.createdAt,
        media,
      });
    }
  }
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

async function searchPixabayMedia(apiKey: string, query: string): Promise<MediaAsset[]> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error('Set your Pixabay API key in Settings first.');
  }
  const q = encodeURIComponent(query.trim() || 'nature');
  const [imageRes, videoRes] = await Promise.all([
    fetch(`https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${q}&image_type=photo&per_page=6&safesearch=true`),
    fetch(`https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&q=${q}&per_page=6&safesearch=true`),
  ]);
  if (!imageRes.ok || !videoRes.ok) {
    throw new Error(`Pixabay request failed (${imageRes.status}/${videoRes.status})`);
  }
  const images = (await imageRes.json()) as { hits: any[] };
  const videos = (await videoRes.json()) as { hits: any[] };

  const imageAssets: MediaAsset[] = images.hits.map((hit) => ({
    id: `pixabay-image-${hit.id}`,
    type: 'image' as const,
    uri: hit.largeImageURL || hit.webformatURL,
    thumbnailUri: hit.webformatURL,
    source: 'pixabay' as const,
    provider: `Pixabay · ${hit.user}`,
  }));
  const videoAssets: MediaAsset[] = videos.hits
    .map((hit) => ({
      id: `pixabay-video-${hit.id}`,
      type: 'video' as const,
      uri: hit.videos?.medium?.url || hit.videos?.small?.url || hit.videos?.tiny?.url || '',
      thumbnailUri: hit.picture_id
        ? `https://i.vimeocdn.com/video/${hit.picture_id}_295x166.jpg`
        : undefined,
      source: 'pixabay' as const,
      provider: `Pixabay · ${hit.user}`,
    }))
    .filter((v) => !!v.uri);

  return [...imageAssets, ...videoAssets];
}

export const ProfileScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const profile = useUserStore((s) => s.profile);
  const joinedAt = useUserStore((s) => s.joinedAt);
  const posts = useUserPostsStore((s) => s.posts);
  const addUserPost = useUserPostsStore((s) => s.addPost);
  const commentsByPostId = usePostCommentsStore((s) => s.commentsByPostId);
  const pixabayApiKey = useSettingsStore((s) => s.pixabayApiKey);

  const [tab, setTab] = useState<Tab>('posts');
  const [mediaQuery, setMediaQuery] = useState('');
  const [searchingMedia, setSearchingMedia] = useState(false);
  const [remoteMedia, setRemoteMedia] = useState<MediaAsset[]>([]);

  const totalLikes = useMemo(
    () => posts.reduce((sum, p) => sum + (p.likes || 0), 0),
    [posts],
  );
  const { followers, following } = useMemo(
    () => fakeFollowCounts(profile.handle),
    [profile.handle],
  );

  const displayName = profile.name || 'Your AI';
  const handle = profile.handle ? `@${profile.handle}` : '@you';
  const bio = profile.bio?.trim();
  const sortedProfilePosts = useMemo(
    () =>
      [...posts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [posts],
  );

  const replies = useMemo(
    () => selectRepliesForProfile(commentsByPostId, posts),
    [commentsByPostId, posts],
  );
  const mediaItems = useMemo(() => selectMediaForProfile(posts), [posts]);

  const postsById = useMemo(() => {
    const map = new Map<string, Post>();
    for (const post of posts) {
      map.set(post.id, post);
    }
    return map;
  }, [posts]);

  const runMediaSearch = async () => {
    try {
      setSearchingMedia(true);
      const assets = await searchPixabayMedia(pixabayApiKey, mediaQuery);
      setRemoteMedia(assets);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      Alert.alert('Media search failed', detail);
    } finally {
      setSearchingMedia(false);
    }
  };

  const importMediaToProfile = (asset: MediaAsset) => {
    const postId = `media-${Date.now()}`;
    const newPost: Post = {
      id: postId,
      author: {
        id: 'me',
        name: profile.name || 'Me',
        handle: `@${profile.handle || 'me'}`,
        avatar: avatarUrl(profile.avatarSeed || 'me', 128),
      },
      content: asset.provider ? `Imported from ${asset.provider}` : 'Imported media',
      createdAt: new Date().toISOString(),
      likes: 0,
      commentsCount: 0,
      media: [{ ...asset, id: `${asset.id}-${postId}` }],
    };
    addUserPost(newPost);
    Alert.alert('Imported', 'Media added to your profile.');
  };

  const renderHeader = () => (
    <View>
      {/* Banner — two stacked tinted views fake a soft gradient with no extra deps. */}
      <View style={styles.bannerWrap}>
        <View
          style={[
            styles.bannerLayer,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        />
        <View
          style={[
            styles.bannerLayer,
            styles.bannerLayerOverlay,
            { backgroundColor: theme.colors.tertiaryContainer, opacity: 0.55 },
          ]}
        />
        <View style={styles.bannerActions}>
          <Button
            mode="contained-tonal"
            icon="pencil"
            compact
            onPress={() => navigation.navigate('EditProfile')}
            style={styles.editBtn}
          >
            Edit profile
          </Button>
        </View>
      </View>

      <View style={styles.identityRow}>
        <View
          style={[
            styles.avatarRing,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <Image
            source={{ uri: avatarUrl(profile.avatarSeed || 'aisocial', 256) }}
            style={styles.avatar}
          />
        </View>
      </View>

      <View style={styles.identityBlock}>
        <View style={styles.nameRow}>
          <Text variant="headlineSmall" style={styles.name}>
            {displayName}
          </Text>
          <Chip
            compact
            icon="cellphone"
            style={styles.deviceChip}
            textStyle={styles.deviceChipText}
          >
            on-device
          </Chip>
        </View>
        <Text
          variant="bodyMedium"
          style={[styles.handle, { color: theme.colors.onSurfaceVariant }]}
        >
          {handle}
        </Text>

        {bio ? (
          <Text variant="bodyMedium" style={styles.bio}>
            {bio}
          </Text>
        ) : (
          <Text
            variant="bodyMedium"
            style={[
              styles.bio,
              { color: theme.colors.onSurfaceVariant, fontStyle: 'italic' },
            ]}
          >
            Add a bio to tell people what you're about.
          </Text>
        )}

        <View style={styles.metaRow}>
          <Ionicons
            name="calendar-outline"
            size={14}
            color={theme.colors.onSurfaceVariant}
            style={{ marginRight: 4 }}
          />
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {formatJoined(joinedAt)}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Posts" value={formatCount(posts.length)} />
          <Stat label="Likes" value={formatCount(totalLikes)} />
          <Stat label="Following" value={formatCount(following)} />
          <Stat label="Followers" value={formatCount(followers)} />
        </View>
      </View>

      <Divider />

      <View style={styles.tabsRow}>
        <TabChip label="Posts" active={tab === 'posts'} onPress={() => setTab('posts')} />
        <TabChip label="Replies" active={tab === 'replies'} onPress={() => setTab('replies')} />
        <TabChip label="Media" active={tab === 'media'} onPress={() => setTab('media')} />
      </View>

      <Divider />
    </View>
  );

  const renderPost = ({ item }: { item: Post }) => (
    <PostCard
      post={item}
      onPress={() => navigation.navigate('PostDetail', { post: item })}
    />
  );

  const renderReply = ({ item }: { item: ProfileReplyItem }) => (
    <Pressable
      style={[styles.replyCard, { borderColor: theme.colors.outlineVariant }]}
      onPress={() => {
        const post = postsById.get(item.postId);
        if (!post) return;
        navigation.navigate('PostDetail', { post });
      }}
    >
      <Text variant="titleSmall" style={styles.replyLabel}>
        Reply
      </Text>
      <Text variant="bodyMedium">{item.content}</Text>
      <Text
        variant="bodySmall"
        style={[styles.replySub, { color: theme.colors.onSurfaceVariant }]}
      >
        In reply to: {item.postPreview}
      </Text>
    </Pressable>
  );

  const renderMediaTile = ({ item }: { item: { id: string; postId: string; media: MediaAsset } }) => (
    <Pressable
      style={styles.mediaTileWrap}
      onPress={() => {
        const post = postsById.get(item.postId);
        if (!post) return;
        navigation.navigate('PostDetail', { post });
      }}
    >
      <Image source={{ uri: item.media.thumbnailUri || item.media.uri }} style={styles.mediaTile} />
      {item.media.type === 'video' && (
        <View style={styles.videoBadge}>
          <Ionicons name="play" color="#fff" size={12} />
        </View>
      )}
    </Pressable>
  );

  const renderRemoteMedia = () => {
    if (tab !== 'media') return null;
    return (
      <View style={styles.remoteSearchWrap}>
        <RNTextInput
          style={[
            styles.searchInput,
            { borderColor: theme.colors.outline, color: theme.colors.onSurface },
          ]}
          placeholder="Search free images and videos"
          placeholderTextColor={theme.colors.onSurfaceVariant}
          value={mediaQuery}
          onChangeText={setMediaQuery}
        />
        <Button
          mode="contained-tonal"
          icon="magnify"
          onPress={runMediaSearch}
          loading={searchingMedia}
          disabled={searchingMedia}
          style={styles.searchBtn}
        >
          Search Pixabay
        </Button>
        {remoteMedia.map((asset) => (
          <View key={asset.id} style={styles.remoteResultRow}>
            <Image source={{ uri: asset.thumbnailUri || asset.uri }} style={styles.remoteThumb} />
            <View style={styles.remoteMeta}>
              <Text variant="bodySmall" numberOfLines={2}>
                {asset.provider || 'Pixabay media'}
              </Text>
              <Button mode="outlined" compact onPress={() => importMediaToProfile(asset)}>
                Import
              </Button>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderEmpty = () => {
    if (tab === 'replies') {
      return (
        <View style={styles.emptyWrap}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={36}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="titleMedium"
            style={[styles.emptyTitle, { color: theme.colors.onSurface }]}
          >
            No replies yet
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}
          >
            Reply to posts and your replies will appear here.
          </Text>
        </View>
      );
    }
    if (tab === 'media') {
      return (
        <View style={styles.emptyWrap}>
          <Ionicons
            name="images-outline"
            size={36}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="titleMedium"
            style={[styles.emptyTitle, { color: theme.colors.onSurface }]}
          >
            No media yet
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}
          >
            Attach media in Compose or import from Pixabay in this tab.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Ionicons
          name="create-outline"
          size={36}
          color={theme.colors.onSurfaceVariant}
        />
        <Text
          variant="titleMedium"
          style={[styles.emptyTitle, { color: theme.colors.onSurface }]}
        >
          You haven't posted yet
        </Text>
        <Text
          variant="bodyMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            textAlign: 'center',
            marginBottom: 14,
          }}
        >
          Share what's on your mind — your posts will live here on your profile.
        </Text>
        <Button
          mode="contained"
          icon="pencil"
          onPress={() => {
            const parent = navigation.getParent?.();
            if (parent) {
              parent.navigate('Compose');
            } else {
              navigation.navigate('Compose');
            }
          }}
        >
          Compose your first post
        </Button>
      </View>
    );
  };

  const data =
    tab === 'posts' ? sortedProfilePosts : tab === 'replies' ? replies : mediaItems;

  return (
    <FlatList
      style={{ backgroundColor: theme.colors.background }}
      data={data as any[]}
      keyExtractor={(item: any) => item.id}
      renderItem={
        tab === 'posts'
          ? (renderPost as any)
          : tab === 'replies'
            ? (renderReply as any)
            : (renderMediaTile as any)
      }
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderRemoteMedia}
      ListEmptyComponent={renderEmpty}
      contentContainerStyle={styles.listContent}
      numColumns={tab === 'media' ? 3 : 1}
      key={tab}
    />
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text variant="titleMedium" style={styles.statValue}>
        {value}
      </Text>
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {label}
      </Text>
    </View>
  );
};

const TabChip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.tabChipWrap}>
      <Text
        variant="titleSmall"
        style={{
          color: active ? theme.colors.primary : theme.colors.onSurfaceVariant,
          fontWeight: active ? '700' : '500',
        }}
      >
        {label}
      </Text>
      <View
        style={[
          styles.tabUnderline,
          {
            backgroundColor: active ? theme.colors.primary : 'transparent',
          },
        ]}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 40,
  },
  bannerWrap: {
    height: 160,
    width: '100%',
    overflow: 'hidden',
  },
  bannerLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerLayerOverlay: {
    transform: [{ translateY: 40 }],
  },
  bannerActions: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  editBtn: {
    borderRadius: 999,
  },
  identityRow: {
    paddingHorizontal: 16,
    marginTop: -55,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  avatarRing: {
    width: 118,
    height: 118,
    borderRadius: 59,
    padding: 4,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 55,
  },
  identityBlock: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  name: {
    fontWeight: '700',
  },
  deviceChip: {
    height: 26,
  },
  deviceChipText: {
    fontSize: 11,
    lineHeight: 14,
    marginVertical: 0,
  },
  handle: {
    marginTop: 2,
  },
  bio: {
    marginTop: 10,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  stat: {
    marginRight: 22,
  },
  statValue: {
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  tabChipWrap: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabUnderline: {
    marginTop: 6,
    height: 3,
    width: 36,
    borderRadius: 2,
  },
  emptyWrap: {
    paddingHorizontal: 28,
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 10,
    marginBottom: 6,
    fontWeight: '700',
  },
  replyCard: {
    marginHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  replyLabel: {
    marginBottom: 6,
    fontWeight: '700',
  },
  replySub: {
    marginTop: 8,
  },
  mediaTileWrap: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 1,
  },
  mediaTile: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteSearchWrap: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchBtn: {
    marginTop: 8,
    marginBottom: 8,
  },
  remoteResultRow: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 10,
  },
  remoteThumb: {
    width: 84,
    height: 84,
    borderRadius: 8,
  },
  remoteMeta: {
    flex: 1,
    justifyContent: 'space-between',
  },
});
