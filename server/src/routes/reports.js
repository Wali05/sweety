// Report routes, mounted at /reports. Every route requires a login and only
// ever reads the logged-in user's own readings.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listReadings } from '../models/readings.js';
import { dailyRange, monthToDateRange, previousMonthRange } from '../reports/ranges.js';
import { summarize } from '../reports/stats.js';
import { MESSAGES, isRealDate, todayInAppTimezone } from '../validation/readings.js';

const router = Router();

router.use(requireAuth);

const EMPTY_MESSAGE = 'No readings for this period yet.';

// Reads ?date= into { date }, defaulting to today, or returns { error }.
function parseReportDate(query) {
  const today = todayInAppTimezone();
  const { date } = query;

  if (date === undefined) return { date: today };
  if (typeof date !== 'string' || !isRealDate(date)) {
    return { error: MESSAGES.dateInvalid };
  }
  // Both are YYYY-MM-DD, so comparing the strings compares the dates.
  if (date > today) return { error: MESSAGES.dateInFuture };

  return { date };
}

// Builds the handler for one report. rangeFor turns the selected date into
// { from, to }; includeReadings adds the list of readings to the response.
function reportHandler(report, rangeFor, { includeReadings = false } = {}) {
  return async (req, res) => {
    const { error, date } = parseReportDate(req.query);
    if (error) {
      return res.status(400).json({ error });
    }

    const { from, to } = rangeFor(date);
    const readings = await listReadings(req.user.id, { from, to });
    const summary = summarize(readings.map((reading) => reading.value));
    const empty = summary.count === 0;

    const body = {
      report,
      date,
      from,
      to,
      ...summary,
      empty,
      message: empty ? EMPTY_MESSAGE : null,
    };

    if (includeReadings) {
      // listReadings already returns a day's readings in slot order.
      body.readings = readings.map(({ id, slot, slotLabel, value }) => ({
        id,
        slot,
        slotLabel,
        value,
      }));
    }

    res.json(body);
  };
}

router.get('/daily', reportHandler('daily', dailyRange, { includeReadings: true }));
router.get('/month-to-date', reportHandler('month-to-date', monthToDateRange));
router.get('/previous-month', reportHandler('previous-month', previousMonthRange));

export default router;
