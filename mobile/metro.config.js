const { getDefaultConfig } = require('expo/metro-config');

// Use mobile-only config (no parent watchFolders) to avoid reload loops when api/shared files change.
module.exports = getDefaultConfig(__dirname);
