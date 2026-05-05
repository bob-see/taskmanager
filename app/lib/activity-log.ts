type ActivityLogCreateData = {
  userId: string;
  type: ActivityLogType;
  description: string;
  profileId: string | null;
  taskId: string | null;
  projectId: string | null;
  timeEntryId: string | null;
};

type ActivityLogClient = {
  activityLog: {
    create(args: {
      data: ActivityLogCreateData;
    }): Promise<unknown>;
  };
};

export type ActivityLogType =
  | "task.create"
  | "task.complete"
  | "task.reopen"
  | "task.delete"
  | "task.priority_toggle"
  | "project.create"
  | "project.update"
  | "project.delete"
  | "time_entry.create"
  | "time_entry.update"
  | "time_entry.delete"
  | "profile.create"
  | "profile.update"
  | "profile.delete";

export function createActivityLog(
  db: ActivityLogClient,
  data: {
    userId: string;
    type: ActivityLogType;
    description: string;
    profileId?: string | null;
    taskId?: string | null;
    projectId?: string | null;
    timeEntryId?: string | null;
  }
) {
  return db.activityLog.create({
    data: {
      userId: data.userId,
      type: data.type,
      description: data.description,
      profileId: data.profileId ?? null,
      taskId: data.taskId ?? null,
      projectId: data.projectId ?? null,
      timeEntryId: data.timeEntryId ?? null,
    },
  });
}

export function formatActivityType(type: string) {
  return type
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
