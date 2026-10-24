import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioSource,
} from 'expo-audio';

import type { RingtoneId } from '@/types/call';

import { resolveRingtoneSource } from './catalog';

// Volume used when the speaker is off, to approximate an earpiece.
const EARPIECE_VOLUME = 0.6;

// A real call rings and speaks regardless of what the phone is doing, and the
// clip must keep playing when the app is backgrounded. Android additionally
// caps background playback without lock-screen controls, so the voice player
// registers them in startVoicePlayer().
let audioModeApplied = false;
function ensureAudioMode(): void {
  if (audioModeApplied) return;
  audioModeApplied = true;
  void setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  }).catch(() => {
    audioModeApplied = false;
  });
}

/**
 * Silences a player, then frees it.
 *
 * This exists because `player.remove()` in expo-audio does NOT stop playback:
 * on Android it only unregisters the player from the module's map
 * (`AudioModule.kt: removePlayer`), and on iOS it only drops it from the
 * component registry (`AudioModule.swift: remove`). Neither calls `pause()`,
 * which is what actually makes sound stop. Every stop path therefore pauses
 * first and releases second.
 */
function silence(player: AudioPlayer | null, clearLockScreen = false): void {
  if (!player) return;
  if (clearLockScreen) {
    try {
      player.clearLockScreenControls();
    } catch {
      /* already detached */
    }
  }
  try {
    player.pause();
  } catch {
    /* already paused or released */
  }
  try {
    player.remove();
  } catch {
    /* already removed */
  }
}

let ringtonePlayer: AudioPlayer | null = null;
let voicePlayer: AudioPlayer | null = null;
/** The clip the call owns, kept after it finishes so the play button can replay it. */
let voiceSource: AudioSource | null = null;
let voiceSpeakerOn = false;

/**
 * What `syncCallAudio` has already applied.
 * `undefined` means "out of sync": any start or stop made outside the sync
 * (settings previews) marks it dirty, so the next sync always re-decides
 * instead of trusting a stale key.
 */
let syncedRingtoneKey: string | null | undefined = null;
let syncedClipKey: string | null | undefined = null;

const voiceListeners = new Set<(playing: boolean) => void>();

function emitVoicePlaying(playing: boolean) {
  voiceListeners.forEach((fn) => fn(playing));
}

export function subscribeVoicePlaying(fn: (playing: boolean) => void): () => void {
  voiceListeners.add(fn);
  return () => {
    voiceListeners.delete(fn);
  };
}

/** Identity for a clip source, so the sync can tell "same clip" from "new clip". */
function clipKeyOf(source: AudioSource): string {
  if (typeof source === 'number') return `asset:${source}`;
  if (typeof source === 'string') return `uri:${source}`;
  if (source && typeof source === 'object') {
    return `uri:${source.uri ?? ''}|asset:${source.assetId ?? ''}`;
  }
  return 'none';
}

/* ------------------------------------------------------------- ringtone ---- */

/**
 * Plays the caller's ringtone. A real call loops until `stopRingtone()`;
 * the settings screen previews one cycle with `loop: false`.
 *
 * `systemUri` is the phone's own ringtone picked from the system ringtone
 * picker (a local file:// URI); a missing one falls back to the classic
 * bundled ring so a call never rings in silence.
 */
export function startRingtone(
  ringtone: RingtoneId,
  options: { loop?: boolean; systemUri?: string | null } = {},
): void {
  const { loop = true, systemUri = null } = options;
  syncedRingtoneKey = undefined; // owned outside the sync now
  silence(ringtonePlayer);
  ringtonePlayer = null;
  ensureAudioMode();

  const player = createAudioPlayer(resolveRingtoneSource(ringtone, systemUri));
  player.loop = loop;
  if (!loop) {
    player.addListener('playbackStatusUpdate', (status) => {
      // Only end ourselves — a newer ringtone may already have replaced us.
      if (status.didJustFinish && ringtonePlayer === player) stopRingtone();
    });
  }
  player.play();
  ringtonePlayer = player;
}

export function stopRingtone(): void {
  syncedRingtoneKey = undefined;
  silence(ringtonePlayer);
  ringtonePlayer = null;
}

/* ------------------------------------------------------------ voice clip ---- */

function stopVoicePlayer(): void {
  silence(voicePlayer, true);
  voicePlayer = null;
  voiceSource = null;
  emitVoicePlaying(false);
}

/** Plays a fresh clip player. Deliberately leaves the sync keys alone. */
function startVoicePlayer(source: AudioSource, loop: boolean): void {
  silence(voicePlayer, true);
  voicePlayer = null;
  ensureAudioMode();

  const player = createAudioPlayer(source);
  player.loop = loop;
  player.volume = voiceSpeakerOn ? 1 : EARPIECE_VOLUME;
  try {
    // Lock-screen/media controls stop Android from ending background playback
    // after ~3 minutes, so a clip of any length plays through in the background.
    player.setActiveForLockScreen(true, { title: 'In call' });
  } catch {
    /* not available on web */
  }
  player.addListener('playbackStatusUpdate', (status) => {
    if (voicePlayer !== player) return; // stale listener from a replaced player
    if (status.didJustFinish) {
      // Reached the end: silence it but keep it configured so it can replay
      // and so the sync does not treat it as a new clip.
      silence(player, true);
      if (voicePlayer === player) voicePlayer = null;
      emitVoicePlaying(false);
    } else {
      emitVoicePlaying(status.playing);
    }
  });
  player.play();
  voicePlayer = player;
  voiceSource = source;
  emitVoicePlaying(true);
}

/**
 * Plays the clip that runs during the call. `source` accepts anything
 * expo-audio can load (a bundled asset id or a picked file's URI); null stops.
 */
export function startVoiceClip(source: AudioSource | null, loop = false): void {
  syncedClipKey = undefined; // owned outside the sync now
  if (source === null) {
    stopVoicePlayer();
    return;
  }
  startVoicePlayer(source, loop);
}

/** Settings-screen preview of a picked clip; plays once. */
export function playVoiceClip(source: AudioSource): void {
  startVoiceClip(source, false);
}

export function stopVoiceClip(): void {
  syncedClipKey = undefined;
  stopVoicePlayer();
}

/** Pause/resume the in-call clip, or replay it if it already finished. */
export function toggleVoiceClip(): void {
  if (!voiceSource) return;
  if (voicePlayer?.playing) {
    voicePlayer.pause();
    emitVoicePlaying(false);
  } else if (voicePlayer) {
    voicePlayer.play();
    emitVoicePlaying(true);
  } else {
    startVoicePlayer(voiceSource, false);
  }
}

/* -------------------------------------------------------------- speaker ----- */

/**
 * Speaker button during a call. There is no earpiece route in expo-audio, so
 * this is simulated with loudness: speaker off is quieter, like an earpiece.
 */
export function setVoiceSpeaker(on: boolean): void {
  voiceSpeakerOn = on;
  if (voicePlayer) {
    try {
      voicePlayer.volume = on ? 1 : EARPIECE_VOLUME;
    } catch {
      /* player already released */
    }
  }
}

/* --------------------------------------------------------------- the sync --- */

export interface CallAudioDesired {
  /** Ringtone to loop while the phone is ringing, or null when it is not. */
  ringtone: { ringtone: RingtoneId; systemUri: string | null } | null;
  /** Clip that must be running during the call, or null for silence. */
  clip: AudioSource | null;
  /** Speaker button state. */
  speaker: boolean;
}

/**
 * The single place call audio is started and stopped.
 *
 * It applies a desired state derived from the call reducer: start exactly
 * what that state requires and stop everything else. It is idempotent, so
 * re-running it with the same state never restarts sound — which is what lets
 * the provider express "ringtone while ringing, clip while active" in one
 * effect instead of scattered start/stop cleanups.
 */
export function syncCallAudio(desired: CallAudioDesired): void {
  // Speaker first, so a clip started below already has the right volume.
  setVoiceSpeaker(desired.speaker);

  const wantRingtone = desired.ringtone;
  const ringKey = wantRingtone
    ? `${wantRingtone.ringtone}|${wantRingtone.systemUri ?? ''}`
    : null;
  if (ringKey !== syncedRingtoneKey) {
    if (wantRingtone === null) {
      stopRingtone();
    } else {
      startRingtone(wantRingtone.ringtone, {
        systemUri: wantRingtone.systemUri,
        loop: true,
      });
    }
    syncedRingtoneKey = ringKey;
  }

  const clip = desired.clip;
  const clipKey = clip === null ? null : clipKeyOf(clip);
  if (clipKey !== syncedClipKey) {
    // startVoiceClip(null) stops, so both branches live in one call.
    startVoiceClip(clip, false);
    syncedClipKey = clipKey;
  }
}

/** Nothing keeps sounding, whatever state we were in. */
export function stopAllAudio(): void {
  stopRingtone();
  stopVoiceClip();
}
