import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { clearApiUrlCache } from './api-url-file';
import { API_URL_FILE_NAME } from './api-url-file';
import { parseApiUrlFromFileContents } from './api-url-parse';

export function getAppApiUrlFileUri(): string | null {
  if (!FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}${API_URL_FILE_NAME}`;
}

function normalizeUserInput(input: string): string {
  const url = parseApiUrlFromFileContents(input.trim());
  if (url) return url;
  throw new Error('Use a full URL, e.g. http://192.168.68.128:3000');
}

/** Save API URL inside the app (always works; no storage permission). */
export async function saveApiUrlToAppStorage(input: string): Promise<string> {
  const url = normalizeUserInput(input);
  const path = getAppApiUrlFileUri();
  if (!path) throw new Error('App storage is not available on this device.');
  await FileSystem.writeAsStringAsync(path, `${url}\n`, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  clearApiUrlCache();
  return url;
}

/** Pick api-url.txt via system file picker (works for Documents/WizCRM on Android 13+). */
export async function importApiUrlFromDocument(): Promise<string> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['text/plain', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]?.uri) {
    throw new Error('No file selected.');
  }
  const raw = await FileSystem.readAsStringAsync(picked.assets[0].uri);
  const url = parseApiUrlFromFileContents(raw);
  if (!url) {
    throw new Error('File must contain one line: http://YOUR_PC_IP:3000');
  }
  return saveApiUrlToAppStorage(url);
}
