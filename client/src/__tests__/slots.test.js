import { describe, expect, it } from 'vitest';
import { MESSAGES, SLOTS, slotLabel, sortBySlot, todayLocal } from '../readings/slots.js';

describe('reading slots', () => {
  it('lists the four slots in order with their labels', () => {
    expect(SLOTS.map((slot) => slot.key)).toEqual([
      'morning_fasting',
      'after_breakfast',
      'after_lunch',
      'after_dinner',
    ]);
    expect(slotLabel('after_lunch')).toBe('After lunch');
    expect(slotLabel('midnight')).toBeUndefined();
  });

  it('sorts readings into slot order without changing the input', () => {
    const readings = [{ slot: 'after_dinner' }, { slot: 'morning_fasting' }, { slot: 'after_lunch' }];

    expect(sortBySlot(readings).map((reading) => reading.slot)).toEqual([
      'morning_fasting',
      'after_lunch',
      'after_dinner',
    ]);
    expect(readings[0].slot).toBe('after_dinner');
  });

  it('uses a or an in the duplicate slot message, like the server', () => {
    expect(MESSAGES.duplicateSlot('After lunch')).toBe(
      'You already have an After lunch reading for this date.'
    );
    expect(MESSAGES.duplicateSlot('Morning (fasting)')).toBe(
      'You already have a Morning (fasting) reading for this date.'
    );
  });

  it("gives the browser's local date as YYYY-MM-DD", () => {
    expect(todayLocal(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
    expect(todayLocal(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});
