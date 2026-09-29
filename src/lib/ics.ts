export interface IcsEventInput {
  uid: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string | null;
  description?: string | null;
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toCompactDateTime(date: string, time: string): string {
  const [hh, mm, ss] = time.split(":");
  return `${date.replace(/-/g, "")}T${hh.padStart(2, "0")}${(mm ?? "00").padStart(2, "0")}${(ss ?? "00").padStart(2, "0")}`;
}

/** Builds a minimal single-event VCALENDAR/VEVENT block (floating local time, no TZID). */
export function buildIcsContent(event: IcsEventInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hustle of Stars//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTART:${toCompactDateTime(event.date, event.startTime)}`,
    `DTEND:${toCompactDateTime(event.date, event.endTime)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}
