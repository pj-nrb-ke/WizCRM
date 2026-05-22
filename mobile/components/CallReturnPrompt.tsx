import { useEffect, useRef } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { clearLastCallLead, peekLastCallLead } from '../lib/call-return';
import { flushOfflineNotes } from '../lib/offline-notes';

/** After returning from the phone dialer, offer to log the call (Lite LITE-009). */
export function CallReturnPrompt() {
  const prevState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      const wasBackground = prevState.current === 'background' || prevState.current === 'inactive';
      prevState.current = next;
      if (next !== 'active' || !wasBackground) return;

      void flushOfflineNotes().catch(() => {});

      const last = await peekLastCallLead();
      if (!last) return;

      Alert.alert(
        'Log this call?',
        `You called ${last.leadName}. Add notes while it is fresh.`,
        [
          {
            text: 'Not now',
            style: 'cancel',
            onPress: () => void clearLastCallLead(),
          },
          {
            text: 'Log call',
            onPress: () => {
              void clearLastCallLead();
              router.push({
                pathname: '/lead/post-call',
                params: { leadId: last.leadId, leadName: last.leadName },
              });
            },
          },
        ],
      );
    });
    return () => sub.remove();
  }, []);

  return null;
}
