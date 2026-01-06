import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useFeedStore, useSettingsStore } from '../store';
import { OllamaService } from '../services/ollama';
import { PostCard } from '../components/PostCard';
import { Post } from '../types';

export const FeedScreen = () => {
  const navigation = useNavigation<any>();
  const { posts, setPosts, appendPosts } = useFeedStore();
  const settings = useSettingsStore();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = async (mode: 'replace' | 'append') => {
    if (loading) {
      if (mode === 'replace') {
        setRefreshing(false);
      }
      return;
    }
    try {
      setLoading(true);
      const newPosts = await OllamaService.generateFeedPosts(settings, 5);
      if (mode === 'replace') {
        setPosts(newPosts);
        return;
      }
      appendPosts(newPosts);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate posts. Check your Ollama URL and Model in Settings.');
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

  const handleRefresh = () => {
    setRefreshing(true);
    loadPosts('replace');
  };

  const handleLoadMore = () => {
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
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard 
            post={item} 
            onPress={() => navigation.navigate('PostDetail', { post: item })} 
          />
        )}
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
