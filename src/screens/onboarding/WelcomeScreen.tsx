import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Avatar, Button, Text, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from './types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

const FLOATER_ICONS = ['robot-happy', 'star-four-points', 'message-text', 'lightning-bolt', 'satellite-variant', 'flower', 'cloud'];

export const WelcomeScreen = ({ navigation }: Props) => {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;
  const floats = useRef(FLOATER_ICONS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    floats.forEach((value, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: 4000 + i * 500,
            delay: i * 200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 4000 + i * 500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });
  }, [fade, slide, floats]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {floats.map((value, i) => {
        const left = (i / FLOATER_ICONS.length) * width + (i % 2 === 0 ? 30 : -10);
        const top = ((i * 137) % (height - 200)) + 60;
        const translateY = value.interpolate({ inputRange: [0, 1], outputRange: [0, -28] });
        const size = 36 + (i % 3) * 10;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left,
              top,
              opacity: 0.14,
              transform: [{ translateY }],
            }}
            pointerEvents="none"
          >
            <Avatar.Icon
              size={size}
              icon={FLOATER_ICONS[i]!}
              style={{ backgroundColor: 'transparent' }}
              color={theme.colors.primary}
            />
          </Animated.View>
        );
      })}

      <Animated.View
        style={[
          styles.center,
          { opacity: fade, transform: [{ translateY: slide }] },
        ]}
      >
        <Avatar.Icon
          size={92}
          icon="robot-happy"
          style={{ backgroundColor: theme.colors.primaryContainer, marginBottom: 12 }}
          color={theme.colors.primary}
        />
        <Text variant="displaySmall" style={[styles.title, { color: theme.colors.primary }]}>
          AI Social
        </Text>
        <Text variant="titleMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          A make-believe social feed,{`\n`}powered by an LLM that lives on your phone.
        </Text>
        <Text variant="bodyMedium" style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
          No accounts. No servers. No strangers. Just you, your model, and a feed full of fictional people you'll
          probably get a little attached to.
        </Text>

        <Button
          mode="contained"
          onPress={() => navigation.navigate('Profile')}
          style={styles.cta}
          contentStyle={{ paddingVertical: 6 }}
        >
          Let's go
        </Button>
        <Text variant="labelSmall" style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
          ~2 minutes to set up · works fully offline once installed
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 28, paddingTop: 60, overflow: 'hidden' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', marginBottom: 18 },
  body: { textAlign: 'center', marginBottom: 36 },
  cta: { borderRadius: 999, paddingHorizontal: 24 },
});
