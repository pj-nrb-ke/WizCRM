import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { openGoogleMaps, buildGoogleMapsSearchUrl } from '../lib/maps-links';

type Props = {
  phone: string;
  email: string;
  extraPhones: string[];
  extraEmails: string[];
  address: string;
  googleMapsUrl: string;
  onPhoneChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onExtraPhonesChange: (v: string[]) => void;
  onExtraEmailsChange: (v: string[]) => void;
  onAddressChange: (v: string) => void;
  onGoogleMapsUrlChange: (v: string) => void;
};

function updateAt(list: string[], index: number, value: string) {
  const next = [...list];
  next[index] = value;
  return next;
}

export function ContactFields({
  phone,
  email,
  extraPhones,
  extraEmails,
  address,
  googleMapsUrl,
  onPhoneChange,
  onEmailChange,
  onExtraPhonesChange,
  onExtraEmailsChange,
  onAddressChange,
  onGoogleMapsUrlChange,
}: Props) {
  function pinMapsFromAddress() {
    const url = buildGoogleMapsSearchUrl(address);
    if (url) onGoogleMapsUrlChange(url);
  }

  return (
    <View>
      <Text style={styles.label}>Phone (primary)</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={onPhoneChange}
        keyboardType="phone-pad"
        placeholder="+27 …"
        placeholderTextColor="#64748b"
      />
      {extraPhones.map((p, i) => (
        <View key={`p-${i}`} style={styles.extraRow}>
          <TextInput
            style={[styles.input, styles.extraInput]}
            value={p}
            onChangeText={(v) => onExtraPhonesChange(updateAt(extraPhones, i, v))}
            keyboardType="phone-pad"
            placeholder={`Phone ${i + 2}`}
            placeholderTextColor="#64748b"
          />
          <Pressable
            style={styles.removeBtn}
            onPress={() => onExtraPhonesChange(extraPhones.filter((_, j) => j !== i))}
          >
            <Text style={styles.removeBtnText}>−</Text>
          </Pressable>
        </View>
      ))}
      {extraPhones.length < 4 ? (
        <Pressable style={styles.addLink} onPress={() => onExtraPhonesChange([...extraPhones, ''])}>
          <Text style={styles.addLinkText}>+ Add phone</Text>
        </Pressable>
      ) : null}

      <Text style={styles.label}>Email (primary)</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#64748b"
      />
      {extraEmails.map((e, i) => (
        <View key={`e-${i}`} style={styles.extraRow}>
          <TextInput
            style={[styles.input, styles.extraInput]}
            value={e}
            onChangeText={(v) => onExtraEmailsChange(updateAt(extraEmails, i, v))}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder={`Email ${i + 2}`}
            placeholderTextColor="#64748b"
          />
          <Pressable
            style={styles.removeBtn}
            onPress={() => onExtraEmailsChange(extraEmails.filter((_, j) => j !== i))}
          >
            <Text style={styles.removeBtnText}>−</Text>
          </Pressable>
        </View>
      ))}
      {extraEmails.length < 4 ? (
        <Pressable style={styles.addLink} onPress={() => onExtraEmailsChange([...extraEmails, ''])}>
          <Text style={styles.addLinkText}>+ Add email</Text>
        </Pressable>
      ) : null}

      <Text style={styles.label}>Address</Text>
      <TextInput
        style={[styles.input, styles.addressInput]}
        value={address}
        onChangeText={onAddressChange}
        placeholder="Street, city, country…"
        placeholderTextColor="#64748b"
        multiline
      />
      <View style={styles.mapRow}>
        <Pressable style={styles.mapBtn} onPress={() => openGoogleMaps(address || googleMapsUrl)}>
          <Text style={styles.mapBtnText}>Open in Maps</Text>
        </Pressable>
        <Pressable style={styles.mapBtnSecondary} onPress={pinMapsFromAddress}>
          <Text style={styles.mapBtnSecondaryText}>Save map link</Text>
        </Pressable>
      </View>
      {googleMapsUrl ? (
        <Text style={styles.mapSaved} numberOfLines={2}>
          Map pin saved
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: '#94a3b8', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  addressInput: { minHeight: 72, textAlignVertical: 'top' },
  extraRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  extraInput: { flex: 1 },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  addLink: { marginTop: 8 },
  addLinkText: { color: '#38bdf8', fontWeight: '600' },
  mapRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  mapBtn: {
    flex: 1,
    backgroundColor: '#38bdf8',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  mapBtnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#475569',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBtnSecondaryText: { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
  mapSaved: { color: '#4ade80', fontSize: 12, marginTop: 6 },
});
