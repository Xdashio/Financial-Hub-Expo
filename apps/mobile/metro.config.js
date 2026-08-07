const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('mjs', 'cjs');

// Workaround for Expo Router v57 web middleware bug
// Provide empty middleware context for web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo-router/build/getRoutesCore' && platform === 'web') {
    // Return a mock that doesn't try to use require.context
    return {
      filePath: __dirname + '/node_modules/expo-router/build/getRoutesCore.js',
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;