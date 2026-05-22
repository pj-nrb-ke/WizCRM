import { Alert, Linking, Platform } from 'react-native';
import { digitsOnly, telUri, whatsAppUri } from './phone-utils';

export async function openTel(phone: string) {
  const url = telUri(phone);
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Call', 'Could not open the phone dialer.');
  }
}

export async function openWhatsApp(phone: string) {
  const nativeUrl = whatsAppUri(phone, true);
  const webUrl = whatsAppUri(phone, false);

  if (Platform.OS === 'android') {
    try {
      await Linking.openURL(nativeUrl);
      return;
    } catch {
      /* fall through to web */
    }
  } else {
    const canNative = await Linking.canOpenURL(nativeUrl).catch(() => false);
    if (canNative) {
      await Linking.openURL(nativeUrl);
      return;
    }
  }

  try {
    await Linking.openURL(webUrl);
  } catch {
    Alert.alert(
      'WhatsApp',
      'Could not open WhatsApp. Install WhatsApp or check the phone number includes country code (e.g. +27…).',
    );
  }
}
