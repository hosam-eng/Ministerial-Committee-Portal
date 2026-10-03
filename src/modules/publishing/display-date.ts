const CALENDAR_DATE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/u;

/** Calendar date stored as UTC midnight (PostgreSQL DATE convention). */
export function calendarDateFromParts(
  year: number,
  month: number,
  day: number,
): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatCalendarDateInput(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseCalendarDateInput(
  value: string | null | undefined,
): Date | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = CALENDAR_DATE.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = calendarDateFromParts(year, month, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function todayCalendarDate(): Date {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
  }).format(new Date());
  return parseCalendarDateInput(iso)!;
}

export function calendarDateTimeAttribute(value: Date): string {
  return formatCalendarDateInput(value);
}

export function formatPublicCalendarDate(value: Date, locale: string): string {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const day = value.getUTCDate();
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, day)));
}
