import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { api } from '../lib/api';

async function readBase64FromUri(uri: string): Promise<string> {
  const { readAsStringAsync, EncodingType } = await import('expo-file-system/legacy');
  return readAsStringAsync(uri, { encoding: EncodingType.Base64 });
}

type Props = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
};

export function VoiceNoteButton({ onTranscript, disabled }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [processing, setProcessing] = useState(false);

  async function toggleRecord() {
    if (disabled || processing) return;
    try {
      if (!state.isRecording) {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          Alert.alert('Microphone', 'Allow microphone access to record voice notes.');
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      } else {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) {
          Alert.alert('Recording', 'No audio captured. Try again.');
          return;
        }
        setProcessing(true);
        const base64 = await readBase64FromUri(uri);
        const { transcript } = await api<{ transcript: string }>('/ai/transcribe', {
          method: 'POST',
          body: { audioBase64: base64, mimeType: 'audio/m4a' },
        });
        onTranscript(transcript);
      }
    } catch (e) {
      Alert.alert(
        'Voice note',
        e instanceof Error
          ? e.message
          : 'Could not record or transcribe. Type your note instead.',
      );
    } finally {
      setProcessing(false);
    }
  }

  const label = processing
    ? 'Transcribing…'
    : state.isRecording
      ? 'Stop recording'
      : 'Record voice note';

  return (
    <Pressable
      style={[styles.btn, (state.isRecording || processing) && styles.btnActive]}
      onPress={toggleRecord}
      disabled={disabled || processing}
    >
      {processing ? (
        <ActivityIndicator color="#0f172a" />
      ) : (
        <Text style={styles.btnText}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#475569',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  btnActive: { backgroundColor: '#f87171' },
  btnText: { color: '#f8fafc', fontWeight: '600' },
});
