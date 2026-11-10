// Blood glucose reading routes, mounted at /readings. Every route requires a
// login and only ever touches the logged-in user's own readings.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  countReadingsOnDate,
  createReading,
  deleteReading,
  findReading,
  findReadingBySlot,
  listReadings,
  updateReading,
} from '../models/readings.js';
import {
  MAX_READINGS_PER_DAY,
  MESSAGES,
  isRealDate,
  slotLabel,
  validateReading,
} from '../validation/readings.js';

const router = Router();

router.use(requireAuth);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLOT_CONSTRAINT = 'readings_user_date_slot_key';

// Returns { status, error } when a reading cannot be saved on this date and
// slot, or null when it can. excludeId leaves out the reading being edited.
async function findConflict(userId, { date, slot }, excludeId = null) {
  const count = await countReadingsOnDate(userId, date, excludeId);
  if (count >= MAX_READINGS_PER_DAY) {
    return { status: 409, error: MESSAGES.maxPerDay };
  }

  if (await findReadingBySlot(userId, date, slot, excludeId)) {
    return { status: 409, error: MESSAGES.duplicateSlot(slotLabel(slot)) };
  }

  return null;
}

// Translates the database errors a save can hit into { status, error }, or
// returns null for anything unexpected.
function describeSaveError(err, slot) {
  // 23505 = unique_violation: another request saved this slot between our
  // check and our write.
  if (err.code === '23505' && err.constraint === SLOT_CONSTRAINT) {
    return { status: 409, error: MESSAGES.duplicateSlot(slotLabel(slot)) };
  }
  // 23514 = check_violation: backstop for the value range check.
  if (err.code === '23514') {
    return { status: 400, error: MESSAGES.valueOutOfRange };
  }
  return null;
}

// Reads ?date= or ?from=&to= into { from, to }, or returns { error }.
function parseDateFilter(query) {
  const { date, from, to } = query;

  for (const value of [date, from, to]) {
    if (value !== undefined && (typeof value !== 'string' || !isRealDate(value))) {
      return { error: MESSAGES.dateInvalid };
    }
  }

  if (date !== undefined) return { from: date, to: date };
  // Both are YYYY-MM-DD, so comparing the strings compares the dates.
  if (from !== undefined && to !== undefined && from > to) {
    return { error: MESSAGES.dateInvalid };
  }
  return { from, to };
}

// Anything that is not a UUID cannot be a reading id; answering 404 here keeps
// malformed ids away from the database.
router.param('id', (req, res, next, id) => {
  if (!UUID_PATTERN.test(id)) {
    return res.status(404).json({ error: MESSAGES.notFound });
  }
  next();
});

router.post('/', async (req, res) => {
  const { error, values } = validateReading(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const conflict = await findConflict(req.user.id, values);
  if (conflict) {
    return res.status(conflict.status).json({ error: conflict.error });
  }

  let reading;
  try {
    reading = await createReading(req.user.id, values);
  } catch (err) {
    const problem = describeSaveError(err, values.slot);
    if (problem) {
      return res.status(problem.status).json({ error: problem.error });
    }
    throw err;
  }

  res.status(201).json({ reading });
});

router.get('/', async (req, res) => {
  const filter = parseDateFilter(req.query);
  if (filter.error) {
    return res.status(400).json({ error: filter.error });
  }

  const readings = await listReadings(req.user.id, filter);
  res.json({ readings });
});

router.get('/:id', async (req, res) => {
  const reading = await findReading(req.user.id, req.params.id);
  if (!reading) {
    return res.status(404).json({ error: MESSAGES.notFound });
  }
  res.json({ reading });
});

router.patch('/:id', async (req, res) => {
  const { error, values } = validateReading(req.body, { partial: true });
  if (error) {
    return res.status(400).json({ error });
  }

  // Missing and someone else's reading look the same, so ids are not leaked.
  const existing = await findReading(req.user.id, req.params.id);
  if (!existing) {
    return res.status(404).json({ error: MESSAGES.notFound });
  }

  const merged = {
    date: values.date ?? existing.date,
    slot: values.slot ?? existing.slot,
  };

  if (merged.date !== existing.date || merged.slot !== existing.slot) {
    const conflict = await findConflict(req.user.id, merged, existing.id);
    if (conflict) {
      return res.status(conflict.status).json({ error: conflict.error });
    }
  }

  let reading;
  try {
    reading = await updateReading(req.user.id, existing.id, values);
  } catch (err) {
    const problem = describeSaveError(err, merged.slot);
    if (problem) {
      return res.status(problem.status).json({ error: problem.error });
    }
    throw err;
  }

  // Deleted by another request after we loaded it.
  if (!reading) {
    return res.status(404).json({ error: MESSAGES.notFound });
  }

  res.json({ reading });
});

router.delete('/:id', async (req, res) => {
  const deleted = await deleteReading(req.user.id, req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: MESSAGES.notFound });
  }
  res.status(204).end();
});

export default router;
