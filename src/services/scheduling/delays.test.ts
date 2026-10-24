import { DELAY_PRESETS, formatCallDuration, formatCountdown } from './delays';

describe('delay presets', () => {
  it('offers 10 seconds, 30 seconds, 1 minute and 5 minutes', () => {
    expect(DELAY_PRESETS.map((p) => p.ms)).toEqual([10_000, 30_000, 60_000, 300_000]);
  });
});

describe('formatCountdown', () => {
  it('rounds up so the display never shows 0:00 before the call fires', () => {
    expect(formatCountdown(10_000)).toBe('0:10');
    expect(formatCountdown(9_001)).toBe('0:10');
    expect(formatCountdown(300_000)).toBe('5:00');
    expect(formatCountdown(61_000)).toBe('1:01');
  });

  it('never goes negative', () => {
    expect(formatCountdown(-500)).toBe('0:00');
  });
});

describe('formatCallDuration', () => {
  it('formats mm:ss and switches to h:mm:ss after an hour', () => {
    expect(formatCallDuration(0)).toBe('00:00');
    expect(formatCallDuration(5_999)).toBe('00:05');
    expect(formatCallDuration(65_000)).toBe('01:05');
    expect(formatCallDuration(3_661_000)).toBe('1:01:01');
  });

  it('clamps negative elapsed time', () => {
    expect(formatCallDuration(-1000)).toBe('00:00');
  });
});
