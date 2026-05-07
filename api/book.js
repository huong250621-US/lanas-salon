import { google } from "googleapis";

const TIMEZONE = "America/Chicago";

const SERVICE_DURATIONS = {
  "Haircut + Styling": 60,
  "Bang Trim": 30,
  "Single Color / Tint": 150,
  "Highlights (Partial)": 150,
  "Full Highlights": 210,
  "Balayage / Ombré": 210,
  "Color Correction": 300,
  "Gloss / Toner": 60,
  "Perm": 180,
  "Keratin / Straightening": 210,
  "Deep Conditioning Treatment": 60,
  "Blowout": 60,
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { name, phone, service, startTime } = req.body;

    if (!name || !phone || !service || !startTime) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({ version: "v3", auth });
    const calendarId = process.env.CALENDAR_ID;

    const durationMin = SERVICE_DURATIONS[service] || 120;
    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationMin * 60 * 1000);

    const event = {
      summary: `💇‍♀️ ${service} — ${name}`,
      description: [
        `📋 Service: ${service}`,
        `👤 Client: ${name}`,
        `📞 Phone: ${phone}`,
        `⏱ Duration: ~${Math.round(durationMin / 60 * 10) / 10} hrs`,
        ``,
        `Booked via Lana's Salon chatbot`,
      ].join("\n"),
      start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
      end:   { dateTime: end.toISOString(),   timeZone: TIMEZONE },
      colorId: "11",
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email",  minutes: 24 * 60 },
          { method: "popup",  minutes: 60 },
        ],
      },
    };

    const result = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    const confirmTime = start.toLocaleString("en-US", {
      weekday: "long", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
      timeZone: TIMEZONE,
    });

    return res.status(200).json({
      success: true,
      eventId: result.data.id,
      confirmTime,
    });

  } catch (error) {
    console.error("Booking error:", error.message);
    return res.status(500).json({ error: "Could not create booking. Please try again." });
  }
}
