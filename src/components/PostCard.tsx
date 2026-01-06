import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, Avatar, IconButton, useTheme } from 'react-native-paper';
import { Post } from '../types';

interface PostCardProps {
  post: Post;
  onPress?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onPress }) => {
  const theme = useTheme();

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Title
        title={post.author.name}
        subtitle={post.author.handle}
        left={(props) => <Avatar.Image {...props} source={{ uri: post.author.avatar }} />}
      />
      <Card.Content>
        <Text variant="bodyMedium" style={styles.content}>{post.content}</Text>
      </Card.Content>
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
      </Card.Actions>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
    marginHorizontal: 10,
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
});
