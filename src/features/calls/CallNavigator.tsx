import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import type { CallPhase } from '@/types/call';

import { useCall } from './CallProvider';

/**
 * Keeps the visible screen in step with the call phase. Screens never navigate
 * themselves for call transitions; they only call answer() / hangUp().
 *
 * - ringing -> push the incoming screen over whatever the user was doing
 * - active  -> replace incoming with the active-call screen
 * - idle    -> pop back to where the user was (home, or settings if they were there)
 */
export function CallNavigator() {
  const { phase } = useCall();
  const router = useRouter();
  const previous = useRef<CallPhase>('idle');

  useEffect(() => {
    const before = previous.current;
    previous.current = phase;
    if (phase === before) return;

    if (phase === 'ringing') {
      router.push('/incoming');
    } else if (phase === 'active') {
      router.replace('/active');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [phase, router]);

  return null;
}
