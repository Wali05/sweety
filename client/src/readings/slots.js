// Reading slots, limits and messages, kept the same as the server's
// (server/src/validation/readings.js). The server still validates everything
// itself.

// The four daily slots, in the order they are shown.
export const SLOTS = [
  { key: 'morning_fasting', label: 'Morning (fasting)' },
  { key: 'after_breakfast', label: 'After breakfast' },
  { key: 'after_lunch', label: 'After lunch' },
  { key: 'after_dinner', label: 'After dinner' },
];

export const MAX_READINGS_PER_DAY = 4;

// Allowed glucose range in mg/dl.
export const MIN_VALUE = 40;
export const MAX_VALUE = 600;

export const MESSAGES = {
  dateRequired: 'Please choose a date.',
  dateInvalid: 'Date is not valid.',
  dateInFuture: 'Date cannot be in the future.',
  slotRequired: 'Please choose a time slot.',
  slotInvalid: 'Time slot is not valid.',
  valueRequired: 'Please enter a glucose value.',
  valueOutOfRange: `Value must be between ${MIN_VALUE} and ${MAX_VALUE} mg/dl.`,
  nothingToUpdate: 'Nothing to update.',
  duplicateSlot: (label) =>
    `You already have ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label} reading for this date.`,
  maxPerDay: `You can add only ${MAX_READINGS_PER_DAY} readings per day.`,
  notFound: 'Reading not found.',
};

// Label for a slot key, or undefined if the key is unknown.
export function slotLabel(key) {
  return SLOTS.find((slot) => slot.key === key)?.label;
}

// A copy of readings sorted into slot order.
export function sortBySlot(readings) {
  const position = (reading) => SLOTS.findIndex((slot) => slot.key === reading.slot);
  return [...readings].sort((a, b) => position(a) - position(b));
}

// The browser's local date as 'YYYY-MM-DD'. Built from the local date parts
// because toISOString() would give the UTC date.
export function todayLocal(now = new Date()) {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
