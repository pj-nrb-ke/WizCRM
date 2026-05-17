import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/** Reload data when a tab is focused, without flashing a full-screen loader every time. */
export function useRefreshOnFocus(load: () => Promise<void>) {
  const isFirst = useRef(true);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => {
        isFirst.current = false;
      });
    }, [load]),
  );

  return { isFirst: isFirst.current };
}
