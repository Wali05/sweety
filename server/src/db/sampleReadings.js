// Deterministic sample readings for the demo user. Pure: no database, no
// clock. Given today's 'YYYY-MM-DD' it returns readings for every day of the
// previous month and the current month up to today.
import { SLOTS, MIN_VALUE, MAX_VALUE } from '../validation/readings.js';
import { previousMonthRange } from '../reports/ranges.js';

const SEED = 20240611;
const DAY_MS = 24 * 60 * 60 * 1000;

// mulberry32: tiny seeded generator returning floats in [0, 1).
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toTimestamp(date) {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function sampleValue(random, slot) {
  const between = (min, max) => min + Math.floor(random() * (max - min + 1));
  const roll = random();

  let value;
  if (roll < 0.04) value = between(60, 70);
  else if (roll < 0.09) value = between(250, 320);
  else if (slot === 'morning_fasting') value = between(95, 150);
  else value = between(130, 230);

  return Math.min(MAX_VALUE, Math.max(MIN_VALUE, value));
}

// Which slots get a reading on one day: usually all four, sometimes two or
// three, now and then none.
function pickSlots(random) {
  const keys = SLOTS.map((slot) => slot.key);
  const roll = random();

  if (roll < 0.08) return [];
  if (roll < 0.3) {
    const count = random() < 0.5 ? 2 : 3;
    // Drop random slots until count remain, keeping the daily order.
    const kept = [...keys];
    while (kept.length > count) kept.splice(Math.floor(random() * kept.length), 1);
    return kept;
  }
  return keys;
}

// Returns [{ date, slot, value }] ordered by date, then slot.
export function generateSampleReadings(today) {
  const random = createRandom(SEED);
  const start = toTimestamp(previousMonthRange(today).from);
  const end = toTimestamp(today);
  const readings = [];

  for (let time = start; time <= end; time += DAY_MS) {
    const date = new Date(time).toISOString().slice(0, 10);
    let slots = pickSlots(random);
    // Keep today non-empty so the daily report has something to show.
    if (time === end && slots.length === 0) slots = ['morning_fasting'];
    for (const slot of slots) {
      readings.push({ date, slot, value: sampleValue(random, slot) });
    }
  }

  return readings;
}
