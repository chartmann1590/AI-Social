import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useInterstitialAd } from 'react-native-google-mobile-ads';
import { useFeedStore, usePostEngagementStore, useSettingsStore, useUserPostsStore } from '../store';
import { LlmService } from '../services/llm';
import { PostCard } from '../components/PostCard';
import { Post } from '../types';
import { FeedNativeAd } from '../ads/FeedNativeAd';
import { ADMOB_AD_UNIT_IDS, ADMOB_REQUEST_OPTIONS } from '../ads/adMobConfig';
import { useAdMobReady } from '../ads/AdMobProvider';
import { useAdFreeStatus } from '../rewards/useAdFreeStatus';

function sortPostsByCreatedAtDesc(list: Post[]): Post[] {
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

type FeedListItem =
  | { type: 'post'; post: Post }
  | { type: 'native-ad'; id: string };

export const FeedScreen = () => {
  const navigation = useNavigation<any>();
  const { posts, setPosts, appendPosts, updatePostLikes } = useFeedStore();
  const settings = useSettingsStore();
  const updateUserPostLikes = useUserPostsStore((s) => s.updatePostLikes);
  const theme = useTheme();
  const adMobReady = useAdMobReady();
  const { isAdFreeActive } = useAdFreeStatus();
  const interstitial = useInterstitialAd(
    adMobReady && !isAdFreeActive ? ADMOB_AD_UNIT_IDS.interstitial : null,
    ADMOB_REQUEST_OPTIONS,
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const feedItems = useMemo<FeedListItem[]>(() => {
    const items: FeedListItem[] = posts.map((post) => ({ type: 'post', post }));
    if (!isAdFreeActive && items.length >= 2) {
      items.splice(2, 0, { type: 'native-ad', id: 'feed-native-ad' });
    }
    return items;
  }, [isAdFreeActive, posts]);

  const loadPosts = async (mode: 'replace' | 'append') => {
    if (loading) {
      if (mode === 'replace') {
        setRefreshing(false);
      }
      return;
    }
    try {
      setLoading(true);
      const engagement = usePostEngagementStore.getState();
      if (mode === 'replace') {
        const newPosts = await LlmService.generateFeedPosts(settings, 5);
        // Hydrate persisted user posts at the top so the user's own content
        // reappears in the feed after a cold start, deduped by id.
        const userPosts = useUserPostsStore.getState().posts.map((post) => {
          const shouldGrow = Math.random() < 0.35;
          const likes = shouldGrow
            ? engagement.growLikeCount(post.id)
            : engagement.ensureLikeCount(post.id);
          updateUserPostLikes(post.id, likes);
          updatePostLikes(post.id, likes);
          return { ...post, likes };
        });
        const aiOnly = newPosts.filter(
          (p) => !userPosts.some((up) => up.id === p.id),
        );
        const aiWithLikes = aiOnly.map((post) => ({
          ...post,
          likes: engagement.ensureLikeCount(post.id, 8, 320),
        }));
        setPosts(sortPostsByCreatedAtDesc([...userPosts, ...aiWithLikes]));
        return;
      }
      const oldestMs =
        posts.length === 0
          ? Date.now()
          : Math.min(...posts.map((p) => new Date(p.createdAt).getTime()));
      const appendBaseTime = oldestMs - 60_000;
      const newPosts = await LlmService.generateFeedPosts(settings, 5, appendBaseTime);
      const aiWithLikes = newPosts.map((post) => ({
        ...post,
        likes: engagement.ensureLikeCount(post.id, 8, 320),
      }));
      appendPosts(aiWithLikes);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      Alert.alert('Failed to generate', detail);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (posts.length === 0) {
      loadPosts('replace');
    }
  }, []);

  useEffect(() => {
    if (adMobReady && !isAdFreeActive) {
      interstitial.load();
    }
  }, [adMobReady, interstitial.load, isAdFreeActive]);

  useEffect(() => {
    if (interstitial.error) {
      console.warn('AdMob interstitial failed to load', interstitial.error);
    }
  }, [interstitial.error]);

  useEffect(() => {
    if (interstitial.isClosed && adMobReady && !isAdFreeActive) {
      interstitial.load();
    }
  }, [adMobReady, interstitial.isClosed, interstitial.load, isAdFreeActive]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPosts('replace');
  };

  const handleLoadMore = () => {
    if (!isAdFreeActive && interstitial.isLoaded) {
      interstitial.show();
    } else if (adMobReady && !isAdFreeActive) {
      interstitial.load();
    }
    loadPosts('append');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {posts.length === 0 && !loading && (
        <View style={styles.center}>
          <Text>No posts yet.</Text>
          <Button onPress={() => loadPosts('replace')}>Generate Feed</Button>
        </View>
      )}

      <FlatList
        data={feedItems}
        keyExtractor={(item) => (item.type === 'post' ? item.post.id : item.id)}
        renderItem={({ item }) => {
          if (item.type === 'native-ad') {
            return <FeedNativeAd />;
          }

          return (
            <PostCard
              post={item.post}
              onPress={() => navigation.navigate('PostDetail', { post: item.post })}
            />
          );
        }}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          posts.length > 0 ? (
            <View style={styles.footer}>
              <Button
                mode="contained"
                onPress={handleLoadMore}
                disabled={loading}
                loading={loading && !refreshing}
              >
                Load more
              </Button>
            </View>
          ) : null
        }
      />

      {loading && !refreshing && posts.length === 0 && (
        <View style={[styles.loadingOverlay, { backgroundColor: theme.colors.surface }]}>
          <ActivityIndicator animating={true} size="large" />
          <Text style={{marginTop: 10}}>Generating Content...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e0e0e0',
  },
  list: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 20,
    borderRadius: 30,
    alignItems: 'center',
    elevation: 5,
  },
});
