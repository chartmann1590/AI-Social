import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, HelperText, IconButton, Text, TextInput, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useUserStore } from '../../store';
import { avatarUrl, makeSeedBatch, randomSeed } from './avatarUtils';
import type { OnboardingStackParamList } from './types';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Profile'>;

const HANDLE_RX = /^[a-z0-9_]{3,20}$/;

function suggestHandle(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 16);
  if (!base) return '';
  const tag = Math.floor(Math.random() * 90 + 10);
  return `${base}_${tag}`;
}

export const ProfileScreen = ({ navigation }: Props) => {
  const theme = useTheme();
  const { profile, setProfile } = useUserStore();
  const [name, setName] = useState(profile.name);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio);
  const [seeds, setSeeds] = useState<string[]>(() => {
    const initial = makeSeedBatch(6);
    if (profile.avatarSeed && !initial.includes(profile.avatarSeed)) {
      return [profile.avatarSeed, ...initial.slice(0, 5)];
    }
    return initial;
  });
  const [selectedSeed, setSelectedSeed] = useState<string>(profile.avatarSeed || seeds[0]!);

  const handleError = useMemo(() => {
    if (!handle) return null;
    if (!HANDLE_RX.test(handle)) {
      return 'Handle must be 3–20 lowercase letters, numbers, or underscores.';
    }
    return null;
  }, [handle]);

  const canContinue = name.trim().length >= 2 && HANDLE_RX.test(handle) && !!selectedSeed;

  const onContinue = () => {
    setProfile({
      name: name.trim(),
      handle,
      avatarSeed: selectedSeed,
      bio: bio.trim(),
    });
    navigation.navigate('ModelSetup');
  };

  const reshuffle = () => {
    const next = makeSeedBatch(6);
    setSeeds(next);
    setSelectedSeed(next[0]!);
  };

  const onNameBlur = () => {
    if (!handle && name.trim()) setHandle(suggestHandle(name));
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="labelMedium" style={{ color: theme.colors.primary, marginBottom: 4 }}>
        STEP 1 OF 3
      </Text>
      <Text variant="headlineMedium" style={styles.title}>
        Pick a vibe
      </Text>
      <Text variant="bodyMedium" style={[styles.blurb, { color: theme.colors.onSurfaceVariant }]}>
        This profile only lives on your device. Make it weird if you want — no one's watching.
      </Text>

      <View style={styles.avatarHeader}>
        <Text variant="titleSmall">Your avatar</Text>
        <IconButton icon="refresh" size={20} onPress={reshuffle} accessibilityLabel="Shuffle avatars" />
      </View>
      <View style={styles.avatarGrid}>
        {seeds.map((seed) => {
          const selected = seed === selectedSeed;
          return (
            <Pressable
              key={seed}
              onPress={() => setSelectedSeed(seed)}
              style={[
                styles.avatarTile,
                {
                  borderColor: selected ? theme.colors.primary : 'transparent',
                  backgroundColor: theme.colors.surfaceVariant,
                },
              ]}
            >
              <Image source={{ uri: avatarUrl(seed, 192) }} style={styles.avatarImg} />
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            const fresh = randomSeed();
            setSeeds((prev) => [fresh, ...prev.slice(0, 5)]);
            setSelectedSeed(fresh);
          }}
          style={[
            styles.avatarTile,
            { borderColor: 'transparent', backgroundColor: theme.colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' },
          ]}
          accessibilityLabel="Generate a new random avatar"
        >
          <Avatar.Icon
            size={48}
            icon="dice-multiple"
            style={{ backgroundColor: 'transparent' }}
            color={theme.colors.primary}
          />
        </Pressable>
      </View>

      <TextInput
        label="Display name"
        value={name}
        onChangeText={setName}
        onBlur={onNameBlur}
        mode="outlined"
        style={styles.input}
        autoCapitalize="words"
      />
      <TextInput
        label="Handle"
        value={handle}
        onChangeText={(t) => setHandle(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
        mode="outlined"
        style={styles.input}
        left={<TextInput.Affix text="@" />}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {handleError && <HelperText type="error" visible>{handleError}</HelperText>}

      <TextInput
        label="One-line bio (optional)"
        value={bio}
        onChangeText={setBio}
        mode="outlined"
        style={styles.input}
        placeholder="e.g. perpetually tired, big fan of soup"
        maxLength={80}
      />

      <Button
        mode="contained"
        onPress={onContinue}
        disabled={!canContinue}
        style={styles.cta}
        contentStyle={{ paddingVertical: 6 }}
      >
        Continue
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 60 },
  title: { fontWeight: '700', marginBottom: 6 },
  blurb: { marginBottom: 24 },
  avatarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  avatarTile: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  input: { marginBottom: 12 },
  cta: { marginTop: 16, borderRadius: 999 },
});
