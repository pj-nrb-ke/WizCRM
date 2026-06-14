import Constants from 'expo-constants';

/**
 * Fallback when no api-url.txt on the device (see MOBILE_DEV.md).
 * Emulator: 10.0.2.2:3000. Physical phone APK: EXPO_PUBLIC_API_URL at build time, or override via file.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://10.0.2.2:3000';
