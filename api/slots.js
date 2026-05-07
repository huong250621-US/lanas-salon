import { google } from "googleapis";

const TIMEZONE = "America/Chicago";
const SLOT_MINUTES = 60;
const DAYS_AHEAD = 10;
const DAY_START = 9;
const DAY_END = 17;

function isClosed(date) {
  const d = new Date(date.toLocaleString("en-US", { timeZone: TIMEZONE }));
  return d.getDay() === 1;
}

function generateSlots(date, busyTimes) {
  const slots = [];
  const now = new Date();

  for (let hour = DAY_START; hour <= DAY_END; hour++) {
    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);

    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + SLOT_MINUTES);

    if (slotStart <= new Date(now.getTime() + 30 * 60 * 1000)) continue;

    const busy = busyTimes.some(b => {
      const bs = new Date(b.start);
      const be = new Date(b.end);
      return slotStart < be && slotEnd > bs;
    });

    if (!busy) {
      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        label: slotStart.toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit", hour12: true,
          timeZone: TIMEZONE,
        }),
      });
    }
  }
  return slots;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    });

    const calendar = google.calendar({ version: "v3", auth });
    const calendarId = process.env.CALENDAR_ID;

    const now = new Date();
    const maxDate = new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);

    const freebusyRes = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: maxDate.toISOString(),
        timeZone: TIMEZONE,
        items: [{ id: calendarId }],
      },
    });

    const busyTimes = freebusyRes.data.calendars[calendarId]?.busy || [];

    const availability = [];
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);

    while (availability.length < DAYS_AHEAD) {
      cursor.setDate(cursor.getDate() + 1);
      if (isClosed(cursor)) continue;

      const slots = generateSlots(cursor, busyTimes);
      if (slots.length > 0) {
        availability.push({
          dateISO: cursor.toISOString().split("T")[0],
          dateLabel: cursor.toLocaleDateString("en-US", {
            weekday: "short", month: "short", day: "numeric",
            timeZone: TIMEZONE,
          }),
          slots,
        });
      }
    }

    return res.status(200).json({ availability });

  } catch (error) {
    console.error("Slots error:", error.message);
    return res.status(500).json({ error: "Could not fetch availability." });
  }
}
