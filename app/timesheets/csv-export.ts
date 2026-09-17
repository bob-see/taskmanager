type ExportEntry = {
  profileId: string;
  profileName: string;
  entryDate: Date;
  loggedMinutes: number | null;
};

type ExportWorkLocationDay = {
  date: Date;
  isWfh: boolean;
};

type TimesheetExportRow = {
  date: string;
  day: string;
  profile: string;
  minutes: number;
  workLocation: "WFH" | "Office";
  weekStart: string;
  weeklyTotalMinutes: number;
};

function escapeCsv(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatDecimalHours(minutes: number) {
  return (minutes / 60).toFixed(2);
}

function toDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMondayWeekStart(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const offset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() + offset);
  return toDateOnly(date);
}

function getWeekdayName(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    new Date(year, month - 1, day).getDay()
  ];
}

export function buildTimesheetExportRows(
  entries: ExportEntry[],
  workLocationDays: ExportWorkLocationDay[],
  defaultWfhDays: number[]
): TimesheetExportRow[] {
  const explicitLocations = new Map<string, boolean>();
  for (const day of workLocationDays) {
    // A later explicit Office entry must override an earlier WFH value for a day.
    if (!day.isWfh || !explicitLocations.has(toDateOnly(day.date))) {
      explicitLocations.set(toDateOnly(day.date), day.isWfh);
    }
  }

  const days = new Map<string, Map<string, { profile: string; minutes: number }>>();
  for (const entry of entries) {
    const date = toDateOnly(entry.entryDate);
    const profiles = days.get(date) ?? new Map<string, { profile: string; minutes: number }>();
    const profile = profiles.get(entry.profileId) ?? { profile: entry.profileName, minutes: 0 };
    profile.minutes += entry.loggedMinutes ?? 0;
    profiles.set(entry.profileId, profile);
    days.set(date, profiles);
  }

  const weeklyTotals = new Map<string, number>();
  for (const [date, profiles] of days) {
    const weekStart = getMondayWeekStart(date);
    const minutes = [...profiles.values()].reduce((total, profile) => total + profile.minutes, 0);
    weeklyTotals.set(weekStart, (weeklyTotals.get(weekStart) ?? 0) + minutes);
  }

  return [...days.entries()]
    .flatMap(([date, profiles]) => {
      const weekStart = getMondayWeekStart(date);
      const isWfh = explicitLocations.get(date) ?? defaultWfhDays.includes(new Date(`${date}T12:00:00`).getDay());
      return [...profiles.values()].map((profile) => ({
        date,
        day: getWeekdayName(date),
        profile: profile.profile,
        minutes: profile.minutes,
        workLocation: isWfh ? ("WFH" as const) : ("Office" as const),
        weekStart,
        weeklyTotalMinutes: weeklyTotals.get(weekStart) ?? 0,
      }));
    })
    .sort((left, right) => left.date.localeCompare(right.date) || left.profile.localeCompare(right.profile));
}

export function createTimesheetCsv(rows: TimesheetExportRow[]) {
  const header = ["Date", "Day", "Profile", "Hours", "Work location", "Week starting", "Weekly total hours"];
  const data = rows.map((row) => [
    row.date,
    row.day,
    row.profile,
    formatDecimalHours(row.minutes),
    row.workLocation,
    row.weekStart,
    formatDecimalHours(row.weeklyTotalMinutes),
  ]);

  return `\uFEFF${[header, ...data].map((row) => row.map(escapeCsv).join(",")).join("\r\n")}\r\n`;
}
