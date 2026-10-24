import type { CallPhase, CallerProfile, ScheduledCall } from '@/types/call';

export interface CallState {
  phase: CallPhase;
  /** A pending scheduled call. Only exists while phase is 'idle'. */
  schedule: ScheduledCall | null;
  /** Snapshot of the caller taken when the call started, so editing settings mid-call has no effect. */
  caller: CallerProfile | null;
  vibrate: boolean;
  answeredAt: number | null;
  muted: boolean;
  speakerOn: boolean;
}

export type CallAction =
  | { type: 'schedule'; call: ScheduledCall }
  | { type: 'cancelSchedule' }
  | { type: 'ring'; caller: CallerProfile; vibrate: boolean }
  | { type: 'answer'; at: number }
  | { type: 'end' }
  | { type: 'toggleMute' }
  | { type: 'toggleSpeaker' };

export const initialCallState: CallState = {
  phase: 'idle',
  schedule: null,
  caller: null,
  vibrate: false,
  answeredAt: null,
  muted: false,
  speakerOn: false,
};

/**
 * Every legal transition lives here. Illegal ones return the same state object,
 * which is what prevents duplicate triggers (e.g. a scheduled timer firing while
 * the user taps "Call Me Now").
 */
export function callReducer(state: CallState, action: CallAction): CallState {
  switch (action.type) {
    case 'schedule':
      return state.phase === 'idle' ? { ...state, schedule: action.call } : state;

    case 'cancelSchedule':
      return state.schedule ? { ...state, schedule: null } : state;

    case 'ring':
      if (state.phase !== 'idle') return state;
      return {
        ...initialCallState,
        phase: 'ringing',
        caller: action.caller,
        vibrate: action.vibrate,
      };

    case 'answer':
      if (state.phase !== 'ringing') return state;
      return { ...state, phase: 'active', answeredAt: action.at };

    case 'end':
      if (state.phase === 'idle') return state;
      return initialCallState;

    case 'toggleMute':
      return state.phase === 'active' ? { ...state, muted: !state.muted } : state;

    case 'toggleSpeaker':
      return state.phase === 'active' ? { ...state, speakerOn: !state.speakerOn } : state;
  }
}
