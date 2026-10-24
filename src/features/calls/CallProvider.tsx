import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useSettings } from '@/features/settings/SettingsProvider';
import { resolveVoiceClipSource } from '@/services/audio/catalog';
import { stopAllAudio, stopRingtone, syncCallAudio } from '@/services/audio/callAudio';
import {
  confirmFeedback,
  endFeedback,
  startRingVibration,
  stopRingVibration,
  tapFeedback,
} from '@/services/feedback/feedback';

import { callReducer, initialCallState, type CallState } from './callReducer';

/** An unanswered call stops ringing after this long, like a missed call. */
const RING_TIMEOUT_MS = 45_000;

interface CallContextValue extends CallState {
  /** Ring immediately. Replaces any pending scheduled call. */
  callNow: () => void;
  /** Ring after `delayMs`, while the app is open. No-op if a call is already in progress. */
  scheduleCall: (delayMs: number) => void;
  cancelScheduledCall: () => void;
  answer: () => void;
  /** Declines a ringing call or ends an active one. */
  hangUp: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [state, dispatch] = useReducer(callReducer, initialCallState);
  const { phase, schedule, caller, vibrate, speakerOn } = state;

  // Timers and listeners must read the latest settings without being re-created.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const ring = useCallback(() => {
    const current = settingsRef.current;
    dispatch({ type: 'ring', caller: current.caller, vibrate: current.vibrate });
  }, []);

  // --- Scheduled call: fires while the app is open. -------------------------
  // JS timers are unreliable once Android suspends the app, so if the deadline
  // passes while backgrounded we ring as soon as the app returns to the foreground.
  useEffect(() => {
    if (!schedule) return;
    const timeout = setTimeout(
      () => {
        if (AppState.currentState === 'active') ring();
      },
      Math.max(0, schedule.fireAt - Date.now()),
    );
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && Date.now() >= schedule.fireAt) ring();
    });
    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [schedule, ring]);

  // --- Audio: one effect owns every sound, derived purely from call state. --
  // Ringtone while ringing, clip while active, speaker volume throughout. The
  // sync is idempotent, so re-running it never restarts audio mid-call, and a
  // phase change is the only thing that can ever start or stop a sound.
  useEffect(() => {
    syncCallAudio({
      ringtone:
        phase === 'ringing' && caller !== null
          ? { ringtone: caller.ringtone, systemUri: caller.ringtoneUri }
          : null,
      clip:
        phase === 'active' && caller !== null ? resolveVoiceClipSource(caller) : null,
      speaker: speakerOn,
    });
  }, [phase, caller, speakerOn]);

  // --- Ringing: vibration + the missed-call / backgrounded timeouts. ---------
  useEffect(() => {
    if (phase !== 'ringing') return;
    if (vibrate) startRingVibration();

    const missedTimer = setTimeout(() => dispatch({ type: 'end' }), RING_TIMEOUT_MS);
    // A ringing screen nobody can see should not keep making noise.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') dispatch({ type: 'end' });
    });

    return () => {
      clearTimeout(missedTimer);
      subscription.remove();
      stopRingVibration();
    };
  }, [phase, vibrate]);

  // Last line of defence: nothing keeps playing if the provider ever unmounts.
  useEffect(
    () => () => {
      stopAllAudio();
      stopRingVibration();
    },
    [],
  );

  const callNow = useCallback(() => {
    dispatch({ type: 'cancelSchedule' });
    ring();
  }, [ring]);

  const scheduleCall = useCallback((delayMs: number) => {
    dispatch({ type: 'schedule', call: { fireAt: Date.now() + delayMs, delayMs } });
  }, []);

  const cancelScheduledCall = useCallback(() => dispatch({ type: 'cancelSchedule' }), []);

  const answer = useCallback(() => {
    confirmFeedback();
    // Cut the ring at the transition itself: effects only run after the next
    // commit, so waiting for them would let the ringtone outlive the ring.
    stopRingtone();
    stopRingVibration();
    dispatch({ type: 'answer', at: Date.now() });
  }, []);

  const hangUp = useCallback(() => {
    endFeedback();
    // Cut everything at the transition itself — no audio survives the call.
    stopAllAudio();
    stopRingVibration();
    dispatch({ type: 'end' });
  }, []);

  const toggleMute = useCallback(() => {
    tapFeedback();
    dispatch({ type: 'toggleMute' });
  }, []);

  const toggleSpeaker = useCallback(() => {
    tapFeedback();
    dispatch({ type: 'toggleSpeaker' });
  }, []);

  const value = useMemo<CallContextValue>(
    () => ({
      ...state,
      callNow,
      scheduleCall,
      cancelScheduledCall,
      answer,
      hangUp,
      toggleMute,
      toggleSpeaker,
    }),
    [state, callNow, scheduleCall, cancelScheduledCall, answer, hangUp, toggleMute, toggleSpeaker],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used inside <CallProvider>');
  return ctx;
}
