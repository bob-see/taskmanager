import assert from "node:assert/strict";
import test from "node:test";

import { buildTimesheetExportRows, createTimesheetCsv } from "../app/timesheets/csv-export.ts";

test("timesheet CSV combines entries by date/profile and includes weekly totals and WFH", () => {
  const rows = buildTimesheetExportRows(
    [
      { profileId: "simon", profileName: "Simon", entryDate: new Date("2026-07-06T00:00:00"), loggedMinutes: 90 },
      { profileId: "simon", profileName: "Simon", entryDate: new Date("2026-07-06T00:00:00"), loggedMinutes: 30 },
      { profileId: "sales", profileName: "Sales", entryDate: new Date("2026-07-07T00:00:00"), loggedMinutes: 120 },
    ],
    [{ date: new Date("2026-07-07T00:00:00"), isWfh: false }],
    [1, 2]
  );

  assert.deepEqual(rows.map(({ date, profile, minutes, workLocation, weekStart, weeklyTotalMinutes }) => ({ date, profile, minutes, workLocation, weekStart, weeklyTotalMinutes })), [
    { date: "2026-07-06", profile: "Simon", minutes: 120, workLocation: "WFH", weekStart: "2026-07-06", weeklyTotalMinutes: 240 },
    { date: "2026-07-07", profile: "Sales", minutes: 120, workLocation: "Office", weekStart: "2026-07-06", weeklyTotalMinutes: 240 },
  ]);
  assert.match(createTimesheetCsv(rows), /Date,Day,Profile,Hours,Work location,Week starting,Weekly total hours/);
  assert.match(createTimesheetCsv(rows), /2026-07-06,Monday,Simon,2\.00,WFH,2026-07-06,4\.00/);
});
