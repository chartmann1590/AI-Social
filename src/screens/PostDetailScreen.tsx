import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, List, Avatar, Divider, useTheme } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import { Post, Comment } from '../types';
import { PostCard } from '../components/PostCard';
import { LlmService } from '../services/llm';
import { useFeedStore, usePostCommentsStore, usePostEngagementStore, useSettingsStore, useUserPostsStore } from '../store';

export const PostDetailScreen = () => {
  const route = useRoute<any>();
  const { post } = route.params as { post: Post };
  const settings = useSettingsStore();
  const theme = useTheme();
  const updateFeedPostCommentCount = useFeedStore((s) => s.updatePostCommentCount);
  const updateFeedPostLikes = useFeedStore((s) => s.updatePostLikes);
  const updateUserPostLikes = useUserPostsStore((s) => s.updatePostLikes);
  const updateUserPostCommentCount = useUserPostsStore((s) => s.updatePostCommentCount);

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newComment, setNewComment] = useState('');

  const syncCommentCount = (nextCount: number) => {
    updateFeedPostCommentCount(post.id, nextCount);
    updateUserPostCommentCount(post.id, nextCount);
  };

  const loadComments = async (mode: 'replace' | 'append' = 'replace') => {
    if (loading || loadingMore) {
      return;
    }
    if (mode === 'replace') {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const generated = await LlmService.generateComments(settings, post.content, 3);
      if (mode === 'append') {
        const next = [...comments, ...generated];
        setComments(next);
        usePostCommentsStore.getState().appendCommentsForPost(post.id, generated);
        syncCommentCount(next.length);
      } else {
        setComments(generated);
        usePostCommentsStore.getState().setCommentsForPost(post.id, generated);
        syncCommentCount(generated.length);
      }
    } catch (error) {
      console.error(error);
      const detail = error instanceof Error ? error.message : String(error);
      Alert.alert('Failed to generate comments', detail);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    // Opening a post simulates engagement so likes can grow naturally.
    const engagement = usePostEngagementStore.getState();
    const likes = engagement.growLikeCount(post.id);
    updateFeedPostLikes(post.id, likes);
    updateUserPostLikes(post.id, likes);

    const cachedComments = usePostCommentsStore.getState().commentsByPostId[post.id] ?? [];
    if (cachedComments.length > 0) {
      setComments(cachedComments);
      syncCommentCount(cachedComments.length);
      return;
    }
    loadComments();
  }, [post.id]);

  const handlePostComment = () => {
    if (!newComment.trim()) return;
    const userComment: Comment = {
      id: Date.now().toString(),
      author: {
        id: 'me',
        name: 'You',
        handle: '@you',
        avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=me',
      },
      content: newComment,
      createdAt: new Date().toISOString(),
    };
    const next = [...comments, userComment];
    setComments(next);
    usePostCommentsStore.getState().setCommentsForPost(post.id, next);
    syncCommentCount(next.length);
    setNewComment('');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PostCard post={post} />
        
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">Comments</Text>
          <Button mode="text" onPress={() => loadComments('replace')} disabled={loading || loadingMore}>
            Regenerate
          </Button>
        </View>

        {loading && comments.length === 0 ? (
          <ActivityIndicator style={{ margin: 20 }} />
        ) : (
          <>
            {comments.map((comment) => (
              <React.Fragment key={comment.id}>
                <List.Item
                  title={comment.author.name}
                  description={comment.content}
                  descriptionNumberOfLines={10}
                  left={props => <Avatar.Image size={40} source={{ uri: comment.author.avatar }} style={{marginRight: 10}} />}
                  titleStyle={{ fontWeight: 'bold' }}
                />
                <Divider />
              </React.Fragment>
            ))}
            {loading && comments.length > 0 && (
              <ActivityIndicator style={{ margin: 20 }} />
            )}
            {comments.length > 0 && (
              <View style={styles.loadMore}>
                <Button
                  mode="contained"
                  onPress={() => loadComments('append')}
                  disabled={loading || loadingMore}
                  loading={loadingMore}
                >
                  Load more
                </Button>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline }]}>
        <TextInput
          mode="outlined"
          placeholder="Write a reply..."
          value={newComment}
          onChangeText={setNewComment}
          right={<TextInput.Icon icon="send" onPress={handlePostComment} />}
          style={[styles.input, { backgroundColor: theme.colors.surface }]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    paddingBottom: 80,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginTop: 10,
  },
  loadMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    backgroundColor: 'white',
  },
});
