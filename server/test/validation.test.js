// Unit tests for validateReading; these do not touch the database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateReading } from '../src/validation/readings.js';

test('accepts a valid reading and returns its values', () => {
  const result = validateReading({ date: '2026-10-01', slot: 'after_lunch', value: 120 });
  assert.deepEqual(result, {
    error: null,
    values: { date: '2026-10-01', slot: 'after_lunch', value: 120 },
  });
});

test('rejects a date that does not exist', () => {
  const result = validateReading({ date: '2026-02-30', slot: 'after_lunch', value: 120 });
  assert.equal(result.error, 'Date is not valid.');
});

test('rejects malformed dates, impossible months and years PostgreSQL cannot store', () => {
  for (const date of ['2026-13-01', '2026-00-10', 'not-a-date', '2026-1-5', '0000-01-01', '0099-06-15', 20261001]) {
    const result = validateReading({ date, slot: 'after_lunch', value: 120 });
    assert.equal(result.error, 'Date is not valid.', String(date));
  }
});

test('accepts the leap day only in a leap year', () => {
  assert.equal(validateReading({ date: '2024-02-29', slot: 'after_lunch', value: 120 }).error, null);
  assert.equal(
    validateReading({ date: '2025-02-29', slot: 'after_lunch', value: 120 }).error,
    'Date is not valid.'
  );
});

test('a null, empty or blank value asks for a value', () => {
  for (const value of [null, '', '   ']) {
    const result = validateReading({ date: '2026-10-01', slot: 'after_lunch', value });
    assert.equal(result.error, 'Please enter a glucose value.', JSON.stringify(value));
  }
  // Sent explicitly in an edit, null is not the same as leaving the field out.
  assert.equal(
    validateReading({ value: null }, { partial: true }).error,
    'Please enter a glucose value.'
  );
});

test('rejects exponent, decimal and signed value strings and non-numbers', () => {
  for (const value of ['1e2', '120.5', '+120', '120 mg', 120.5, false, [120], { value: 120 }]) {
    const result = validateReading({ date: '2026-10-01', slot: 'after_lunch', value });
    assert.equal(result.error, 'Value must be between 40 and 600 mg/dl.', JSON.stringify(value));
  }
});

test('reports the first failing rule', () => {
  assert.equal(validateReading({}).error, 'Please choose a date.');
  assert.equal(validateReading({ date: '2026-10-01' }).error, 'Please choose a time slot.');
  assert.equal(
    validateReading({ date: '2026-10-01', slot: 'bedtime', value: 120 }).error,
    'Time slot is not valid.'
  );
});

test('converts digit strings to numbers', () => {
  const result = validateReading({ date: '2026-10-01', slot: 'after_lunch', value: ' 120 ' });
  assert.equal(result.error, null);
  assert.equal(result.values.value, 120);
});

test('rejects values that are not whole numbers', () => {
  for (const value of ['12.5', 'abc', '-50', true]) {
    const result = validateReading({ date: '2026-10-01', slot: 'after_lunch', value });
    assert.equal(result.error, 'Value must be between 40 and 600 mg/dl.', String(value));
  }
});

test('partial validation checks only the fields that are present', () => {
  assert.deepEqual(validateReading({ value: 90 }, { partial: true }), {
    error: null,
    values: { value: 90 },
  });
  assert.equal(
    validateReading({ value: 700 }, { partial: true }).error,
    'Value must be between 40 and 600 mg/dl.'
  );
});

test('partial validation with no fields has nothing to update', () => {
  assert.equal(validateReading({}, { partial: true }).error, 'Nothing to update.');
});
