export interface DelayPreset {
  id: string;
  label: string;
  /** Accessible, spelled-out version of the label. */
  spoken: string;
  ms: number;
}

export const DELAY_PRESETS: readonly DelayPreset[] = [
  { id: '10s', label: '10 sec', spoken: '10 seconds', ms: 10_000 },
  { id: '30s', label: '30 sec', spoken: '30 seconds', ms: 30_000 },
  { id: '1m', label: '1 min', spoken: '1 minute', ms: 60_000 },
  { id: '5m', label: '5 min', spoken: '5 minutes', ms: 300_000 },
];

export const DEFAULT_DELAY_ID = '30s';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** m:ss for countdowns, e.g. 4:07. */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${Math.floor(totalSeconds / 60)}:${pad(totalSeconds % 60)}`;
}

/** mm:ss for call timers, switching to h:mm:ss after an hour. */
export function formatCallDuration(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
