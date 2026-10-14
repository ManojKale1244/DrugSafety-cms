/**
 * Date and timezone utilities for Pharmacovigilance deadlines.
 * Enforces Asia/Kolkata (IST = UTC+05:30) deadlines.
 * Rule: A task expires at the END of its due day (23:59:59.999 IST).
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // +05:30 in ms

/**
 * Converts a date to the end of its day in Asia/Kolkata (23:59:59.999 IST) represented in UTC Date.
 *
 * @param {Date|string|number} date
 * @returns {Date}
 */
export function getEndOfDayIST(date) {
  const d = new Date(date);
  // Shift by +5:30 to find local IST year, month, date
  const istTime = new Date(d.getTime() + IST_OFFSET_MS);

  const year = istTime.getUTCFullYear();
  const month = istTime.getUTCMonth();
  const day = istTime.getUTCDate();

  // Create Date for 23:59:59.999 IST in UTC:
  // Local IST 23:59:59.999 minus 5:30 offset
  const endOfDayUTC = Date.UTC(year, month, day, 23, 59, 59, 999) - IST_OFFSET_MS;
  return new Date(endOfDayUTC);
}

/**
 * Checks whether an action item with a given due date is overdue right now.
 *
 * @param {Date|string} dueOn
 * @param {string} status Status of the action item ('pending', 'in_progress', 'completed')
 * @returns {boolean}
 */
export function isTaskOverdue(dueOn, status) {
  if (status === 'completed') return false;
  if (!dueOn) return false;

  const deadline = getEndOfDayIST(dueOn);
  return Date.now() > deadline.getTime();
}

/**
 * Returns urgency category for an action item.
 *
 * @param {Date|string} dueOn
 * @param {string} status
 * @returns {'overdue' | 'due_today' | 'due_soon' | 'normal'}
 */
export function getTaskUrgency(dueOn, status) {
  if (status === 'completed') return 'normal';
  if (!dueOn) return 'normal';

  const now = Date.now();
  const deadline = getEndOfDayIST(dueOn).getTime();

  if (now > deadline) {
    return 'overdue';
  }

  // Today in IST
  const endOfTodayIST = getEndOfDayIST(new Date()).getTime();
  if (deadline <= endOfTodayIST) {
    return 'due_today';
  }

  // Next 3 days
  const threeDaysFromNow = endOfTodayIST + 3 * 24 * 60 * 60 * 1000;
  if (deadline <= threeDaysFromNow) {
    return 'due_soon';
  }

  return 'normal';
}
