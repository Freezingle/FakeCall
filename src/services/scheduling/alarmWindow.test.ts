import { RING_GRACE_MS, isAlarmStillPending, shouldRingOnLaunch } from './alarmWindow';

const NOW = 1_700_000_000_000;

describe('shouldRingOnLaunch', () => {
  it('rings when the OS alarm just fired', () => {
    expect(shouldRingOnLaunch({ fireAt: NOW, firedAt: NOW + 200 }, NOW + 200)).toBe(true);
  });

  it('rings when the deadline passed without the alarm being observed', () => {
    expect(shouldRingOnLaunch({ fireAt: NOW - 5_000, firedAt: 0 }, NOW)).toBe(true);
  });

  it('ignores an alarm that fired longer ago than the grace window', () => {
    expect(shouldRingOnLaunch({ fireAt: NOW, firedAt: NOW }, NOW + RING_GRACE_MS + 1)).toBe(false);
  });

  it('does not ring before the deadline', () => {
    expect(shouldRingOnLaunch({ fireAt: NOW + 1_000, firedAt: 0 }, NOW)).toBe(false);
  });

  it('keeps ringing when the fired flag is stale but the deadline is near', () => {
    expect(shouldRingOnLaunch({ fireAt: NOW - 1_000, firedAt: 0 }, NOW + 1_000)).toBe(true);
  });
});

describe('isAlarmStillPending', () => {
  it('is true while the deadline is ahead', () => {
    expect(isAlarmStillPending({ fireAt: NOW + 1, firedAt: 0 }, NOW)).toBe(true);
  });

  it('is false once the deadline has passed', () => {
    expect(isAlarmStillPending({ fireAt: NOW, firedAt: 0 }, NOW)).toBe(false);
  });
});
