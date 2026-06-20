type ActivityLogCreateData = {
  userId: string;
  type: ActivityLogType;
  description: string;
  profileId: string | null;
  taskId: string | null;
  projectId: string | null;
  timeEntryId: string | null;
  spaceId: string | null;
  metadata?: ActivityLogMetadata;
};

export type ActivityLogMetadata = Record<
  string,
  string | number | boolean | null
>;

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
  | "profile.delete"
  | "space.create"
  | "space.delete"
  | "space.member_add"
  | "space.member_remove"
  | "space.column_create"
  | "space.column_rename"
  | "space.column_archive"
  | "space.column_restore"
  | "space.column_delete"
  | "space.item_create"
  | "space.item_complete"
  | "space.item_reopen"
  | "space.item_status_change"
  | "space.note_add";

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
    spaceId?: string | null;
    metadata?: ActivityLogMetadata;
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
      spaceId: data.spaceId ?? null,
      ...(data.metadata ? { metadata: data.metadata } : {}),
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
