const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const escapeRegExp = (value) => value.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');

// Standalone native project from `expo prebuild` (APK builds). Expo Go ignores it, but
// Metro watches it and crashes when Gradle deletes/changes .gradle or build folders.
const nativeProjectDir = escapeRegExp(path.join(__dirname, 'android'));

const existingBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList)
    ? existingBlockList
    : existingBlockList
      ? [existingBlockList]
      : []),
  new RegExp(`${nativeProjectDir}[\\\\/].*`),
  /[\\/]node_modules[\\/].*[\\/](android|ios)[\\/]build[\\/].*/,
];

module.exports = config;
