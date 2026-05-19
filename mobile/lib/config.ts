import Constants from 'expo-constants';

/**
 * Emulator default: 10.0.2.2:3000. Physical phone APK: set at build time via EXPO_PUBLIC_API_URL (your PC LAN IP).
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://10.0.2.2:3000';
