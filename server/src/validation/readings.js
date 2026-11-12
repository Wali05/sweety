// Validation rules and user-facing messages for blood glucose readings.
import config from '../config.js';

// The four daily slots, in the order they are shown.
export const SLOTS = [
  { key: 'morning_fasting', label: 'Morning (fasting)' },
  { key: 'after_breakfast', label: 'After breakfast' },
  { key: 'after_lunch', label: 'After lunch' },
  { key: 'after_dinner', label: 'After dinner' },
];

export const MAX_READINGS_PER_DAY = 4;

// Allowed glucose range in mg/dl; matches the check constraint on the table.
export const MIN_VALUE = 40;
export const MAX_VALUE = 600;

// Earliest year a reading or report date may have.
export const MIN_YEAR = 1900;

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
  pageInvalid: 'Page is not valid.',
  limitInvalid: 'Limit is not valid.',
};

// Label for a slot key, or undefined if the key is unknown.
export function slotLabel(key) {
  return SLOTS.find((slot) => slot.key === key)?.label;
}

// Today's date as 'YYYY-MM-DD' in the app time zone, so the result does not
// depend on the time zone of the machine the server runs on.
export function todayInAppTimezone() {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.appTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

// True for a 'YYYY-MM-DD' string that names a real calendar date.
export function isRealDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // PostgreSQL has no year 0, and Date.UTC reads years below 100 as 19xx
  // (which breaks the report ranges), so very old years are not valid.
  if (year < MIN_YEAR) return false;

  // Date rolls impossible days over (Feb 30 becomes Mar 2), so the parts
  // only survive the round trip when the date exists.
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Each check returns { value } on success or { error } with the message.

function checkDate(input) {
  if (isMissing(input)) return { error: MESSAGES.dateRequired };
  if (typeof input !== 'string') return { error: MESSAGES.dateInvalid };

  const date = input.trim();
  if (!isRealDate(date)) return { error: MESSAGES.dateInvalid };

  // Both are YYYY-MM-DD, so comparing the strings compares the dates.
  if (date > todayInAppTimezone()) return { error: MESSAGES.dateInFuture };

  return { value: date };
}

function checkSlot(input) {
  if (isMissing(input)) return { error: MESSAGES.slotRequired };
  if (!SLOTS.some((slot) => slot.key === input)) return { error: MESSAGES.slotInvalid };
  return { value: input };
}

function checkValue(input) {
  if (isMissing(input)) return { error: MESSAGES.valueRequired };

  let number;
  if (typeof input === 'number' && Number.isInteger(input)) {
    number = input;
  } else if (typeof input === 'string' && /^\d+$/.test(input.trim())) {
    number = Number(input.trim());
  } else {
    return { error: MESSAGES.valueOutOfRange };
  }

  if (number < MIN_VALUE || number > MAX_VALUE) return { error: MESSAGES.valueOutOfRange };
  return { value: number };
}

// Fields in the order they are validated.
const CHECKS = [
  ['date', checkDate],
  ['slot', checkSlot],
  ['value', checkValue],
];

// Validates the body of a create or edit request.
// Returns { error: null, values } on success or { error: 'message' } for the
// first rule that fails. With partial: true (edits) only the fields that are
// present are validated and returned.
export function validateReading(input, { partial = false } = {}) {
  const body = input !== null && typeof input === 'object' ? input : {};
  const values = {};

  for (const [field, check] of CHECKS) {
    if (partial && body[field] === undefined) continue;

    const result = check(body[field]);
    if (result.error) return { error: result.error };
    values[field] = result.value;
  }

  if (partial && Object.keys(values).length === 0) {
    return { error: MESSAGES.nothingToUpdate };
  }

  return { error: null, values };
}
