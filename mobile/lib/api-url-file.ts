import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { PermissionsAndroid, Platform } from 'react-native';
import { API_URL as BUILD_API_URL } from './config';
import { parseApiUrlFromFileContents } from './api-url-parse';

export { parseApiUrlFromFileContents } from './api-url-parse';

/** File name placed under a WizCRM folder (see MOBILE_DEV.md). */
export const API_URL_FILE_NAME = 'api-url.txt';
export const API_URL_FOLDER = 'WizCRM';

export type ApiUrlResolution = {
  url: string;
  source: string;
  /** Set when falling back to build default — shows which paths were tried. */
  debug?: string;
};

let cached: ApiUrlResolution | null = null;

export function clearApiUrlCache(): void {
  cached = null;
}

function androidPackageName(): string {
  return Constants.expoConfig?.android?.package ?? 'com.wizag.wizcrm';
}

/** App-specific external storage — no broad storage permission (best for adb push). */
export function getAndroidAppExternalApiUrlPath(): string {
  return `/storage/emulated/0/Android/data/${androidPackageName()}/files/${API_URL_FILE_NAME}`;
}

/**
 * Public folders (editable in Files app). Needs runtime storage permission on Android.
 */
export const ANDROID_PUBLIC_API_URL_PATHS = [
  `/storage/emulated/0/Download/${API_URL_FOLDER}/${API_URL_FILE_NAME}`,
  `/storage/emulated/0/Documents/${API_URL_FOLDER}/${API_URL_FILE_NAME}`,
] as const;

async function ensureAndroidReadStorage(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Read API settings file',
        message:
          'WizCRM reads Download/WizCRM/api-url.txt so you can change your PC IP without rebuilding the app.',
        buttonPositive: 'Allow',
        buttonNegative: 'Cancel',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function tryReadFileUri(
  fileUri: string,
): Promise<{ url: string | null; note: string }> {
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
      return { url: null, note: `${fileUri} (not found)` };
    }
    const raw = await FileSystem.readAsStringAsync(fileUri);
    const url = parseApiUrlFromFileContents(raw);
    if (!url) {
      return { url: null, note: `${fileUri} (invalid content)` };
    }
    return { url, note: fileUri };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'read failed';
    return { url: null, note: `${fileUri} (${msg})` };
  }
}

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function androidApiLevel(): number {
  return typeof Platform.Version === 'number' ? Platform.Version : 0;
}

/** Android 13+ blocks direct reads from Documents/Download without SAF. */
function canTryPublicStoragePaths(): boolean {
  return Platform.OS === 'android' && androidApiLevel() < 33;
}

function candidatePaths(): { path: string; needsStoragePermission: boolean }[] {
  const list: { path: string; needsStoragePermission: boolean }[] = [];

  if (FileSystem.documentDirectory) {
    list.push({
      path: `${FileSystem.documentDirectory}${API_URL_FILE_NAME}`,
      needsStoragePermission: false,
    });
  }

  list.push({ path: getAndroidAppExternalApiUrlPath(), needsStoragePermission: false });

  if (canTryPublicStoragePaths()) {
    for (const p of ANDROID_PUBLIC_API_URL_PATHS) {
      list.push({ path: p, needsStoragePermission: true });
    }
  }

  return list;
}

/**
 * Resolve API base URL: optional text file on device, else build-time default.
 */
export async function resolveApiUrl(force = false): Promise<ApiUrlResolution> {
  if (!force && cached) return cached;

  const tried: string[] = [];
  let storagePermission = false;

  for (const { path, needsStoragePermission } of candidatePaths()) {
    if (needsStoragePermission && Platform.OS === 'android') {
      if (!storagePermission) {
        storagePermission = await ensureAndroidReadStorage();
        if (!storagePermission) {
          tried.push(`${path} (storage permission denied)`);
          continue;
        }
      }
    }

    const { url, note } = await tryReadFileUri(toFileUri(path));
    tried.push(note);
    if (url) {
      cached = { url, source: path };
      return cached;
    }
  }

  const androidHint =
    Platform.OS === 'android' && androidApiLevel() >= 33
      ? 'On Android 13+, Documents/Download cannot be read automatically. Use “Save API URL” or “Import api-url.txt” on the login screen, or run push-api-url.ps1 from your PC.'
      : 'Save the URL on the login screen, import api-url.txt, or run .\\scripts\\push-api-url.ps1 from your PC.';

  cached = {
    url: BUILD_API_URL,
    source: 'build (APK default)',
    debug: `${androidHint}\n\nDetails:\n${tried.map((t) => `• ${t}`).join('\n')}`,
  };
  return cached;
}

export async function getApiUrl(): Promise<string> {
  return (await resolveApiUrl()).url;
}
