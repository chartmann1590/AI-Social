import React from 'react';
import { NavigationContainer, Theme as NavigationTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { FeedScreen } from '../screens/FeedScreen';
import { PostDetailScreen } from '../screens/PostDetailScreen';
import { ComposeScreen } from '../screens/ComposeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function FeedStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="FeedList" component={FeedScreen} options={{ title: 'AI Social' }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: 'Post' }} />
    </Stack.Navigator>
  );
}

interface AppNavigatorProps {
  navigationTheme: NavigationTheme;
}

export const AppNavigator = ({ navigationTheme }: AppNavigatorProps) => {
  return (
    <NavigationContainer theme={navigationTheme}>
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
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Feed" component={FeedStack} />
        <Tab.Screen name="Compose" component={ComposeScreen} options={{ headerShown: true, title: 'New Post' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};
