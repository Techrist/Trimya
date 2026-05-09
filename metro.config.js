const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase v10 ne supporte pas le champ "exports" de package.json
// que Metro de Expo SDK 54 active par défaut. On force l'ancienne résolution.
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
