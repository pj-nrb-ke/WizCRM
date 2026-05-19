import type { ExpoConfig } from 'expo/config';

/**
 * Set before building APK for a physical phone on the same Wi‑Fi as your PC:
 *   EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000';

const config: ExpoConfig = {
  name: 'WizCRM',
  slug: 'wizcrm',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'wizcrm',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0f172a',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.wizag.wizcrm',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0f172a',
    },
    package: 'com.wizag.wizcrm',
    versionCode: 1,
    edgeToEdgeEnabled: true,
    usesCleartextTraffic: true,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-audio',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission: 'WizCRM uses the camera to scan business cards.',
        cameraPermission: 'WizCRM uses the camera to scan business cards.',
      },
    ],
  ],
  extra: {
    apiUrl,
    router: {},
  },
};

export default config;
