import { useId, useRef, useState } from 'react';
import { isUnauthorized } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  MAX_READINGS_PER_DAY,
  MAX_VALUE,
  MESSAGES,
  MIN_VALUE,
  SLOTS,
  slotLabel,
  todayLocal,
} from './slots.js';
import { useDayReadings } from './useDayReadings.js';

// Fields in form order, so the first one with a problem can get focus.
const FIELDS = ['date', 'slot', 'value'];

// The server's checks, so the spec's messages show before anything is sent.
// takenSlots are the slots already used on the date, as far as they are known.
// Returns { field: message } for each field with a problem.
function validateReading({ date, slot, value }, { today, takenSlots }) {
  const errors = {};

  if (!date) errors.date = MESSAGES.dateRequired;
  else if (date > today) errors.date = MESSAGES.dateInFuture;

  if (takenSlots.includes(slot)) errors.slot = MESSAGES.duplicateSlot(slotLabel(slot));

  // Whole numbers only: no sign, decimal point or exponent.
  const text = value.trim();
  if (!text) {
    errors.value = MESSAGES.valueRequired;
  } else if (!/^\d+$/.test(text) || Number(text) < MIN_VALUE || Number(text) > MAX_VALUE) {
    errors.value = MESSAGES.valueOutOfRange;
  }

  return errors;
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error">
      {message}
    </p>
  );
}

// Form for one reading: date, time slot and value in mg/dl. It adds a reading
// by default; to edit one, pass its values, its id and an onSave that updates.
//
// - initialValues: { date, slot, value } to start with. When initialValues.date
//   changes (the page moved to another date), the form's date follows it.
// - dayReadings: { date, readings } already loaded by the page (readings is
//   null while loading), so that day is not fetched twice. The readings on any
//   other date are loaded here.
// - readingId: the reading being edited; its own slot does not count as taken.
// - onSave(values): resolves with { reading } or rejects with an ApiError.
// - onSaved(reading): called after a successful save.
export default function ReadingForm({
  initialValues,
  dayReadings = null,
  readingId = null,
  submitLabel = 'Add reading',
  onSave,
  onSaved,
}) {
  const { logout } = useAuth();
  const id = useId();
  const dateRef = useRef(null);
  const slotRef = useRef(null);
  const valueRef = useRef(null);
  const today = todayLocal();

  const [date, setDate] = useState(initialValues.date);
  const [followedDate, setFollowedDate] = useState(initialValues.date);
  // '' until the user picks a slot; the first free slot is shown until then.
  const [chosenSlot, setChosenSlot] = useState(initialValues.slot ?? '');
  const [value, setValue] = useState(initialValues.value ?? '');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // Changing a field hides its error, the server's error and the saved status.
  function clearMessages(...fields) {
    setErrors((current) => {
      const next = { ...current };
      for (const field of fields) delete next[field];
      return next;
    });
    setServerError('');
    setStatus('');
  }

  function changeDate(nextDate) {
    setDate(nextDate);
    // Which slots are taken depends on the date.
    clearMessages('date', 'slot');
  }

  // Follow the page to a new date. After a save the page moves to the saved
  // date, which the form is already on, so the saved status stays.
  if (initialValues.date !== followedDate) {
    setFollowedDate(initialValues.date);
    if (initialValues.date !== date) changeDate(initialValues.date);
  }

  // The readings already on the form's date: the page's when they are for the
  // same date, otherwise loaded here (never for a missing or future date).
  // null while not known; the server checks again on save either way.
  const checkable = Boolean(date) && date <= today;
  const ownDate = checkable && date !== dayReadings?.date ? date : null;
  const own = useDayReadings(ownDate);
  let readings = null;
  if (ownDate) readings = own.readings;
  else if (checkable) readings = dayReadings.readings;

  const takenSlots = (readings ?? [])
    .filter((reading) => reading.id !== readingId)
    .map((reading) => reading.slot);
  const dayIsFull = takenSlots.length >= MAX_READINGS_PER_DAY;
  const firstFree = SLOTS.find((option) => !takenSlots.includes(option.key)) ?? SLOTS[0];
  const slot = chosenSlot || firstFree.key;

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving || dayIsFull) return;

    const problems = validateReading({ date, slot, value }, { today, takenSlots });
    setErrors(problems);
    setServerError('');
    setStatus('');

    const firstProblem = FIELDS.find((field) => problems[field]);
    if (firstProblem) {
      const refs = { date: dateRef, slot: slotRef, value: valueRef };
      refs[firstProblem].current?.focus();
      return;
    }

    setSaving(true);
    let saved;
    try {
      saved = await onSave({ date, slot, value: Number(value.trim()) });
    } catch (err) {
      if (isUnauthorized(err)) {
        logout();
        return;
      }
      // Shown as sent, e.g. a slot saved from another tab, or a date that is
      // already in the future in the server's time zone.
      setServerError(err.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setChosenSlot('');
    setValue('');
    setStatus('Reading saved.');
    onSaved?.(saved.reading);
  }

  // Ties a field to its error message for screen readers.
  function errorProps(field) {
    if (!errors[field]) return {};
    return { 'aria-invalid': true, 'aria-describedby': `${id}-${field}-error` };
  }

  return (
    <form className="reading-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor={`${id}-date`}>Reading date</label>
        <input
          ref={dateRef}
          id={`${id}-date`}
          name="date"
          type="date"
          max={today}
          required
          value={date}
          onChange={(event) => changeDate(event.target.value)}
          {...errorProps('date')}
        />
        <FieldError id={`${id}-date-error`} message={errors.date} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-slot`}>Time slot</label>
        <select
          ref={slotRef}
          id={`${id}-slot`}
          name="slot"
          disabled={dayIsFull}
          value={slot}
          onChange={(event) => {
            setChosenSlot(event.target.value);
            clearMessages('slot');
          }}
          {...errorProps('slot')}
        >
          {SLOTS.map((option) => (
            <option key={option.key} value={option.key}>
              {takenSlots.includes(option.key) ? `${option.label} – taken` : option.label}
            </option>
          ))}
        </select>
        <FieldError id={`${id}-slot-error`} message={errors.slot} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-value`}>Value (mg/dl)</label>
        <input
          ref={valueRef}
          id={`${id}-value`}
          name="value"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required
          disabled={dayIsFull}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            clearMessages('value');
          }}
          {...errorProps('value')}
        />
        <FieldError id={`${id}-value-error`} message={errors.value} />
      </div>
      {dayIsFull && (
        <p className="alert alert-info" role="status">
          {MESSAGES.maxPerDay}
        </p>
      )}
      {serverError && (
        <p className="alert alert-error" role="alert">
          {serverError}
        </p>
      )}
      {status && (
        <p className="alert alert-success" role="status">
          {status}
        </p>
      )}
      <button type="submit" className="button" disabled={saving || dayIsFull}>
        {saving ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
