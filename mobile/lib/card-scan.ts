import { api } from './api';

export async function pickBusinessCardImage(): Promise<{
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
} | null> {
  const ImagePicker = await import('expo-image-picker');

  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Camera permission is required to scan a business card.');
  }

  const picked = await ImagePicker.launchCameraAsync({
    quality: 0.7,
    base64: true,
    allowsEditing: true,
  });

  if (picked.canceled || !picked.assets[0]?.base64) {
    return null;
  }

  const { fields } = await api<{ fields: Record<string, string | undefined> }>('/ai/card-parse', {
    method: 'POST',
    body: { imageBase64: picked.assets[0].base64 },
  });

  return fields;
}
