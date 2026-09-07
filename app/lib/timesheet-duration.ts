export const TIMESHEET_ROUNDING_MODES = [
  "exact",
  "nearest-15",
  "up-15",
] as const;

export type TimesheetRoundingMode = (typeof TIMESHEET_ROUNDING_MODES)[number];

export function isTimesheetRoundingMode(
  value: unknown
): value is TimesheetRoundingMode {
  return (
    typeof value === "string" &&
    TIMESHEET_ROUNDING_MODES.includes(value as TimesheetRoundingMode)
  );
}

export function diffMinutes(startTime: Date, endTime: Date) {
  return Math.max(
    0,
    Math.round((endTime.getTime() - startTime.getTime()) / 60_000)
  );
}

export function roundMinutes(
  minutes: number,
  roundingMode: TimesheetRoundingMode
) {
  if (roundingMode === "exact") return minutes;
  if (roundingMode === "nearest-15") return Math.round(minutes / 15) * 15;
  return Math.ceil(minutes / 15) * 15;
}

export function calculateLoggedMinutes(
  startTime: Date,
  endTime: Date,
  roundingMode: TimesheetRoundingMode
) {
  const durationMinutes = diffMinutes(startTime, endTime);
  return {
    durationMinutes,
    loggedMinutes: roundMinutes(durationMinutes, roundingMode),
  };
}

type DailyTimeEntry = {
  profileId: string;
  durationMinutes: number;
};

/**
 * Rounds a day's time once, then apportions the rounded total across profiles.
 *
 * The largest-remainder method keeps every profile on the selected increment
 * while ensuring the profile figures add up to the day's rounded total.
 */
export function getDailyRoundedProfileMinutes(
  entries: DailyTimeEntry[],
  roundingMode: TimesheetRoundingMode
) {
  const actualByProfile = new Map<string, number>();

  for (const entry of entries) {
    actualByProfile.set(
      entry.profileId,
      (actualByProfile.get(entry.profileId) ?? 0) + Math.max(0, entry.durationMinutes)
    );
  }

  if (roundingMode === "exact") {
    return actualByProfile;
  }

  const increment = 15;
  const roundedTotal = roundMinutes(
    Array.from(actualByProfile.values()).reduce((sum, minutes) => sum + minutes, 0),
    roundingMode
  );
  const allocations = new Map<string, number>();
  const remainders = Array.from(actualByProfile.entries()).map(([profileId, minutes]) => {
    const wholeIncrements = Math.floor(minutes / increment);
    allocations.set(profileId, wholeIncrements * increment);
    return {
      profileId,
      remainder: minutes % increment,
    };
  });
  let remainingIncrements =
    (roundedTotal - Array.from(allocations.values()).reduce((sum, minutes) => sum + minutes, 0)) /
    increment;

  remainders
    .sort((left, right) => right.remainder - left.remainder || left.profileId.localeCompare(right.profileId))
    .forEach(({ profileId }) => {
      if (remainingIncrements <= 0) return;
      allocations.set(profileId, (allocations.get(profileId) ?? 0) + increment);
      remainingIncrements -= 1;
    });

  return allocations;
}
