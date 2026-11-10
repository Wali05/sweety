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
