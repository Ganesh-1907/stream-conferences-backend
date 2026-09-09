// Human-friendly sequential ID generator.
// Format: <prefix><5-digit zero-padded sequence>  e.g. SCC00001, SCW00002, SCB00001
// The sequence is a single global counter per model (not year-scoped).

export async function nextEventId(Model, prefix) {
  const regex = new RegExp(`^${prefix}(\\d+)$`);
  const docs = await Model.find({ eventId: regex }).select('eventId').lean();
  let max = 0;
  for (const doc of docs) {
    const m = String(doc.eventId).match(regex);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  const next = max + 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}
