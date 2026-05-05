import React, { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { NavigationContainer, Theme as NavigationTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, IconButton } from 'react-native-paper';
import * as FileSystem from 'expo-file-system/legacy';

import { FeedScreen } from '../screens/FeedScreen';
import { PostDetailScreen } from '../screens/PostDetailScreen';
import { ComposeScreen } from '../screens/ComposeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { ModelsScreen } from '../screens/ModelsScreen';
import { RewardsScreen } from '../screens/RewardsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { ProfileScreen as OnboardingProfileScreen } from '../screens/onboarding/ProfileScreen';
import { ModelSetupScreen } from '../screens/onboarding/ModelSetupScreen';
import { TourScreen } from '../screens/onboarding/TourScreen';
import { avatarUrl } from '../screens/onboarding/avatarUtils';
import { useSettingsStore, useUserStore } from '../store';
import type { OnboardingStackParamList } from '../screens/onboarding/types';

const Stack = createNativeStackNavigator();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const Tab = createBottomTabNavigator();

function HeaderAvatar({ onPress }: { onPress: () => void }) {
  const avatarSeed = useUserStore((s) => s.profile.avatarSeed);
  const seed = avatarSeed || 'aisocial';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityLabel="Open profile"
      style={{ marginLeft: 12 }}
    >
      <Avatar.Image size={32} source={{ uri: avatarUrl(seed, 64) }} />
    </Pressable>
  );
}

function FeedStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="FeedList"
        component={FeedScreen}
        options={({ navigation }) => ({
          title: 'AI Social',
          headerLeft: () => (
            <HeaderAvatar onPress={() => navigation.navigate('Profile')} />
          ),
        })}
      />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: 'Post' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: 'Post' }} />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={({ navigation }) => ({
          title: 'Settings',
          headerRight: () => (
            <IconButton
              icon="information-outline"
              accessibilityLabel="About AISocial"
              onPress={() => navigation.navigate('About' as never)}
            />
          ),
        })}
      />
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About AISocial' }} />
    </Stack.Navigator>
  );
}

function OnboardingNavigator({
  initialRouteName,
}: {
  initialRouteName: keyof OnboardingStackParamList;
}) {
  return (
    <OnboardingStack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animation: 'slide_from_right',
      }}
    >
      <OnboardingStack.Screen name="Welcome" component={WelcomeScreen} />
      <OnboardingStack.Screen name="Profile" component={OnboardingProfileScreen} options={{ headerShown: true, title: '' }} />
      <OnboardingStack.Screen name="ModelSetup" component={ModelSetupScreen} options={{ headerShown: true, title: '' }} />
      <OnboardingStack.Screen name="Tour" component={TourScreen} options={{ headerShown: true, title: '' }} />
    </OnboardingStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Feed') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Compose') {
            iconName = focused ? 'create' : 'create-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else if (route.name === 'Models') {
            iconName = focused ? 'download' : 'download-outline';
          } else if (route.name === 'Rewards') {
            iconName = focused ? 'gift' : 'gift-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedStack} />
      <Tab.Screen name="Compose" component={ComposeScreen} options={{ headerShown: true, title: 'New Post' }} />
      <Tab.Screen name="Profile" component={ProfileStack} options={{ headerShown: false }} />
      <Tab.Screen name="Models" component={ModelsScreen} options={{ headerShown: true, title: 'Models' }} />
      <Tab.Screen name="Rewards" component={RewardsScreen} options={{ headerShown: true, title: 'Rewards' }} />
      <Tab.Screen name="Settings" component={SettingsStack} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

interface AppNavigatorProps {
  navigationTheme: NavigationTheme;
}

export const AppNavigator = ({ navigationTheme }: AppNavigatorProps) => {
  const onboardingComplete = useUserStore((s) => s.onboardingComplete);
  const profile = useUserStore((s) => s.profile);
  const localModelPath = useSettingsStore((s) => s.localModelPath);
  const setLocalModelPath = useSettingsStore((s) => s.setLocalModelPath);
  const baseUrl = useSettingsStore((s) => s.baseUrl);
  const ollamaModel = useSettingsStore((s) => s.model);

  const [bootChecked, setBootChecked] = useState(false);
  const [localFileOk, setLocalFileOk] = useState(false);

  // The persisted localModelPath can outlive the model file (e.g. after an APK reinstall
  // wipes app data). Verify the file actually exists at boot, and clear the path if not —
  // that way the user can never land on the Feed with a broken provider.
  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      const path = localModelPath.trim();
      if (!path) {
        if (!cancelled) {
          setLocalFileOk(false);
          setBootChecked(true);
        }
        return;
      }
      try {
        const uri = path.startsWith('file://') ? path : `file://${path}`;
        const info = await FileSystem.getInfoAsync(uri);
        if (cancelled) return;
        if (info.exists) {
          setLocalFileOk(true);
        } else {
          setLocalFileOk(false);
          setLocalModelPath('');
        }
      } catch {
        if (cancelled) return;
        setLocalFileOk(false);
        setLocalModelPath('');
      } finally {
        if (!cancelled) setBootChecked(true);
      }
    };
    verify();
    return () => {
      cancelled = true;
    };
  }, [localModelPath, setLocalModelPath]);

  const remoteOk = !!baseUrl.trim() && !!ollamaModel.trim();
  const hasProvider = localFileOk || remoteOk;
  const profileReady = !!profile.name?.trim() && !!profile.handle?.trim();
  const isReady = onboardingComplete && hasProvider;

  // Existing installs may have completed an older onboarding without picking a provider —
  // bounce them straight to ModelSetup so they don't redo their profile.
  const initialRoute: keyof OnboardingStackParamList = !profileReady
    ? 'Welcome'
    : 'ModelSetup';

  if (!bootChecked) {
    return null;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {isReady ? <MainTabs /> : <OnboardingNavigator initialRouteName={initialRoute} />}
    </NavigationContainer>
  );
};
