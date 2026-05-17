import { api } from './api';

export type CardFields = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
};

const PICK_OPTIONS = {
  quality: 0.7,
  base64: true,
  allowsEditing: true,
} as const;

async function parsePickedCard(
  ImagePicker: typeof import('expo-image-picker'),
  result: Awaited<ReturnType<typeof ImagePicker.launchCameraAsync>>,
): Promise<CardFields | null> {
  if (result.canceled || !result.assets[0]?.base64) {
    return null;
  }

  const { fields } = await api<{ fields: Record<string, string | undefined> }>('/ai/card-parse', {
    method: 'POST',
    body: { imageBase64: result.assets[0].base64 },
  });

  return fields;
}

export async function pickBusinessCardImage(): Promise<CardFields | null> {
  const ImagePicker = await import('expo-image-picker');

  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Camera permission is required to scan a business card.');
  }

  return parsePickedCard(
    ImagePicker,
    await ImagePicker.launchCameraAsync(PICK_OPTIONS),
  );
}

export async function pickBusinessCardFromGallery(): Promise<CardFields | null> {
  const ImagePicker = await import('expo-image-picker');

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Photo library permission is required to choose a business card image.');
  }

  return parsePickedCard(
    ImagePicker,
    await ImagePicker.launchImageLibraryAsync(PICK_OPTIONS),
  );
}
