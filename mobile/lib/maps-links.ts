import { Alert, Linking } from 'react-native';

export function buildGoogleMapsSearchUrl(query: string) {
  const q = query.trim();
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export async function openGoogleMaps(urlOrAddress: string) {
  const url =
    urlOrAddress.startsWith('http://') || urlOrAddress.startsWith('https://')
      ? urlOrAddress
      : buildGoogleMapsSearchUrl(urlOrAddress);
  if (!url) {
    Alert.alert('Maps', 'Enter an address first.');
    return;
  }
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Maps', 'Could not open Google Maps.');
  }
}
