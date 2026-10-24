import { DEFAULT_SETTINGS } from '@/features/settings/defaults';

import { callReducer, initialCallState, type CallState } from './callReducer';

const caller = DEFAULT_SETTINGS.caller;

const ringing: CallState = callReducer(initialCallState, { type: 'ring', caller, vibrate: true });
const active: CallState = callReducer(ringing, { type: 'answer', at: 1000 });

describe('callReducer', () => {
  it('starts ringing from idle and snapshots the caller', () => {
    expect(ringing.phase).toBe('ringing');
    expect(ringing.caller).toEqual(caller);
    expect(ringing.vibrate).toBe(true);
  });

  it('ignores a second ring while a call is already in progress (no duplicate triggers)', () => {
    const other = { ...caller, name: 'Someone else' };
    expect(callReducer(ringing, { type: 'ring', caller: other, vibrate: false })).toBe(ringing);
    expect(callReducer(active, { type: 'ring', caller: other, vibrate: false })).toBe(active);
  });

  it('clears a pending schedule when the call starts', () => {
    const scheduled = callReducer(initialCallState, {
      type: 'schedule',
      call: { fireAt: 5000, delayMs: 5000 },
    });
    expect(scheduled.schedule).not.toBeNull();
    expect(callReducer(scheduled, { type: 'ring', caller, vibrate: false }).schedule).toBeNull();
  });

  it('only allows scheduling while idle', () => {
    const call = { fireAt: 5000, delayMs: 5000 };
    expect(callReducer(ringing, { type: 'schedule', call })).toBe(ringing);
    expect(callReducer(active, { type: 'schedule', call })).toBe(active);
  });

  it('cancels a scheduled call', () => {
    const scheduled = callReducer(initialCallState, {
      type: 'schedule',
      call: { fireAt: 5000, delayMs: 5000 },
    });
    expect(callReducer(scheduled, { type: 'cancelSchedule' }).schedule).toBeNull();
    // Cancelling with nothing pending changes nothing.
    expect(callReducer(initialCallState, { type: 'cancelSchedule' })).toBe(initialCallState);
  });

  it('answers only a ringing call and records when', () => {
    expect(active.phase).toBe('active');
    expect(active.answeredAt).toBe(1000);
    expect(callReducer(initialCallState, { type: 'answer', at: 1 })).toBe(initialCallState);
    expect(callReducer(active, { type: 'answer', at: 2 })).toBe(active);
  });

  it('declining or ending resets everything to idle', () => {
    expect(callReducer(ringing, { type: 'end' })).toEqual(initialCallState);
    expect(callReducer(active, { type: 'end' })).toEqual(initialCallState);
    expect(callReducer(initialCallState, { type: 'end' })).toBe(initialCallState);
  });

  it('mute and speaker toggle only during an active call, and reset afterwards', () => {
    expect(callReducer(ringing, { type: 'toggleMute' })).toBe(ringing);
    const muted = callReducer(active, { type: 'toggleMute' });
    const loud = callReducer(muted, { type: 'toggleSpeaker' });
    expect(loud.muted).toBe(true);
    expect(loud.speakerOn).toBe(true);
    expect(callReducer(loud, { type: 'toggleMute' }).muted).toBe(false);

    const next = callReducer(callReducer(loud, { type: 'end' }), {
      type: 'ring',
      caller,
      vibrate: false,
    });
    expect(next.muted).toBe(false);
    expect(next.speakerOn).toBe(false);
  });
});
