import { Alert, Linking } from 'react-native';

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, '');
}

export async function openTel(phone: string) {
  const url = `tel:${digitsOnly(phone)}`;
  const ok = await Linking.canOpenURL(url);
  if (!ok) {
    Alert.alert('Call', 'Phone dialer is not available on this device.');
    return;
  }
  await Linking.openURL(url);
}

export async function openWhatsApp(phone: string) {
  const digits = digitsOnly(phone);
  const url = `https://wa.me/${digits}`;
  const ok = await Linking.canOpenURL(url);
  if (!ok) {
    Alert.alert('WhatsApp', 'Could not open WhatsApp. Check that it is installed.');
    return;
  }
  await Linking.openURL(url);
}
