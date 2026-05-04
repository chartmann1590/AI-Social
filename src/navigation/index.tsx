import React from 'react';
import { NavigationContainer, Theme as NavigationTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { IconButton } from 'react-native-paper';

import { FeedScreen } from '../screens/FeedScreen';
import { PostDetailScreen } from '../screens/PostDetailScreen';
import { ComposeScreen } from '../screens/ComposeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { ModelsScreen } from '../screens/ModelsScreen';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { ProfileScreen } from '../screens/onboarding/ProfileScreen';
import { ModelSetupScreen } from '../screens/onboarding/ModelSetupScreen';
import { TourScreen } from '../screens/onboarding/TourScreen';
import { useUserStore } from '../store';
import type { OnboardingStackParamList } from '../screens/onboarding/types';

const Stack = createNativeStackNavigator();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const Tab = createBottomTabNavigator();

function FeedStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="FeedList" component={FeedScreen} options={{ title: 'AI Social' }} />
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

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animation: 'slide_from_right',
      }}
    >
      <OnboardingStack.Screen name="Welcome" component={WelcomeScreen} />
      <OnboardingStack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true, title: '' }} />
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
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedStack} />
      <Tab.Screen name="Compose" component={ComposeScreen} options={{ headerShown: true, title: 'New Post' }} />
      <Tab.Screen name="Models" component={ModelsScreen} options={{ headerShown: true, title: 'Models' }} />
      <Tab.Screen name="Settings" component={SettingsStack} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

interface AppNavigatorProps {
  navigationTheme: NavigationTheme;
}

export const AppNavigator = ({ navigationTheme }: AppNavigatorProps) => {
  const onboardingComplete = useUserStore((s) => s.onboardingComplete);
  return (
    <NavigationContainer theme={navigationTheme}>
      {onboardingComplete ? <MainTabs /> : <OnboardingNavigator />}
    </NavigationContainer>
  );
};
