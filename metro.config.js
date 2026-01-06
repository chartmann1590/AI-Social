const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Prefer the compiled JS entry for react-native-screens to avoid Metro resolving TS sources.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'react-native-screens': path.resolve(
    __dirname,
    'node_modules/react-native-screens/lib/module',
  ),
};

module.exports = config;
