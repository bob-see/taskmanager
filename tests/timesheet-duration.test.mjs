import assert from "node:assert/strict";
import test from "node:test";

import { getDailyRoundedProfileMinutes } from "../app/lib/timesheet-duration.ts";

test("daily rounding happens once and profile allocations reconcile", () => {
  const totals = getDailyRoundedProfileMinutes(
    [
      { profileId: "simon", durationMinutes: 285 },
      { profileId: "sales", durationMinutes: 258 },
      { profileId: "dream", durationMinutes: 96 },
    ],
    "nearest-15"
  );

  assert.deepEqual(Array.from(totals.entries()), [
    ["simon", 285],
    ["sales", 255],
    ["dream", 105],
  ]);
  assert.equal(Array.from(totals.values()).reduce((sum, minutes) => sum + minutes, 0), 645);
});

test("daily allocations retain actual durations when rounding is exact", () => {
  const totals = getDailyRoundedProfileMinutes(
    [
      { profileId: "simon", durationMinutes: 25 },
      { profileId: "sales", durationMinutes: 16 },
    ],
    "exact"
  );

  assert.deepEqual(Array.from(totals.entries()), [
    ["simon", 25],
    ["sales", 16],
  ]);
});
