import * as Calendar from 'expo-calendar';

/**
 * Reads the next 36 hours of events so the app can offer real occasions
 * ("standup", "Erin's wedding") instead of asking the user to type one.
 */
export async function getUpcomingEvents() {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') return [];

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const ids = calendars.map((c) => c.id);
  if (!ids.length) return [];

  const start = new Date();
  const end = new Date(Date.now() + 36 * 60 * 60 * 1000);
  const events = await Calendar.getEventsAsync(ids, start, end);

  return events
    .filter((e) => e.title && !e.allDay)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      title: e.title,
      start: new Date(e.startDate),
      location: e.location || '',
    }));
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
