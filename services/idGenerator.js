// Human-friendly sequential ID generator.
// Format: <prefix><5-digit zero-padded sequence>  e.g. SCC00001, SCW00002, SCB00001
// The sequence is a single global counter per model (not year-scoped).

import { CourseCohort } from '../models/CourseCohort.js';

function maxFromIds(ids, regex) {
  let max = 0;
  for (const id of ids) {
    const m = String(id).match(regex);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

export async function nextEventId(Model, prefix) {
  const regex = new RegExp(`^${prefix}(\\d+)$`);
  const docs = await Model.find({ eventId: regex }).select('eventId').lean();
  let max = maxFromIds(docs.map((d) => d.eventId), regex);

  // Cohorts are named "<eventId>-<batchNo>". If a cohort still exists for an
  // eventId whose parent course was deleted, that sequence number must never be
  // reused, otherwise cohort creation on the next create hits the unique
  // cohortId index and the request fails with a 500.
  const cohortRegex = new RegExp(`^${prefix}\\d+(-\\d+)?$`);
  try {
    const baseRegex = new RegExp(`^${prefix}(\\d+)`);
    const cohorts = await CourseCohort.find({ cohortId: cohortRegex }).select('cohortId').lean();
    max = Math.max(max, maxFromIds(cohorts.map((c) => c.cohortId), baseRegex));
  } catch {
    // Cohort collection unavailable -> fall back to the course-derived max.
  }

  const next = max + 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}
