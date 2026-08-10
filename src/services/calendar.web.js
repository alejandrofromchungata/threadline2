/** Device calendars are not available in the browser. */
export async function getUpcomingEvents() {
  return [];
}

/** Rough dress-code read from an event title, used as a prompt hint. */
export function occasionFromEvent(event) {
  const t = `${event.title} ${event.location}`.toLowerCase();
  if (/wedding|gala|ceremony|black tie/.test(t)) return { occasion: event.title, floor: 5 };
  if (/interview|board|client|pitch|investor/.test(t)) return { occasion: event.title, floor: 4 };
  if (/standup|1:1|sync|review|meeting|office|class|lecture/.test(t)) return { occasion: event.title, floor: 3 };
  if (/dinner|drinks|date|party|birthday/.test(t)) return { occasion: event.title, floor: 3 };
  if (/gym|run|training|yoga|climb|football|soccer/.test(t)) return { occasion: event.title, floor: 1 };
  return { occasion: event.title, floor: 2 };
}
