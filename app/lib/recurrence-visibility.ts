export type TaskOccurrenceVisibilityInput = {
  startDate: string;
  dueAt?: string | null;
  completedOn?: string | null;
  recurring: boolean;
  pausedOnDate: boolean;
};

export function isTaskOccurrenceVisibleOnDate(
  task: TaskOccurrenceVisibilityInput,
  dateValue: string
) {
  if (task.pausedOnDate || task.startDate > dateValue) {
    return false;
  }

  if (!task.recurring) {
    return true;
  }

  if (!task.completedOn) {
    // A recurring task row is one occurrence. Once that occurrence starts, it
    // remains the same open work item until completion; the recurrence rule is
    // used to schedule occurrences, not to hide an outstanding one.
    return true;
  }

  return task.startDate === dateValue || task.completedOn === dateValue;
}

export function isTaskOccurrenceRelevantToRange(
  task: Pick<
    TaskOccurrenceVisibilityInput,
    "startDate" | "dueAt" | "completedOn" | "recurring"
  >,
  rangeStart: string,
  rangeEnd: string
) {
  const startsInRange = task.startDate >= rangeStart && task.startDate <= rangeEnd;
  const dueInRange = Boolean(
    task.dueAt && task.dueAt >= rangeStart && task.dueAt <= rangeEnd
  );
  const carriedIntoRange =
    task.recurring && !task.completedOn && task.startDate < rangeStart;

  return startsInRange || dueInRange || carriedIntoRange;
}

export function isTaskOccurrenceInTodayBucket(
  task: Pick<
    TaskOccurrenceVisibilityInput,
    "startDate" | "dueAt" | "completedOn" | "recurring"
  >,
  dateValue: string
) {
  return (
    task.startDate === dateValue ||
    task.dueAt === dateValue ||
    (task.recurring && !task.completedOn && task.startDate < dateValue)
  );
}
