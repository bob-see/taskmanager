import type { NotificationType } from "@prisma/client";
import {
  createNotification,
  type NotificationDatabase,
} from "@/app/lib/notifications";

type DelegatedNotificationEvent =
  | "received"
  | "accepted"
  | "declined"
  | "note-added"
  | "completed"
  | "closed";

type NotificationActor = {
  id: string;
  name: string | null;
  email: string | null;
};

type CreateDelegatedTaskNotificationInput = {
  event: DelegatedNotificationEvent;
  delegatedTaskId: string;
  taskTitle: string;
  recipientUserId: string | null;
  actor: NotificationActor;
  reason?: string | null;
  taskNoteId?: string;
  targetUrl?: "/delegated/assigned-to-me" | "/delegated/assigned-by-me";
};

const eventConfig: Record<
  DelegatedNotificationEvent,
  { type: NotificationType; title: string; targetUrl: string }
> = {
  received: {
    type: "DELEGATED_TASK_RECEIVED",
    title: "New delegated task",
    targetUrl: "/delegated/assigned-to-me",
  },
  accepted: {
    type: "DELEGATED_TASK_ACCEPTED",
    title: "Task accepted",
    targetUrl: "/delegated/assigned-by-me",
  },
  declined: {
    type: "DELEGATED_TASK_DECLINED",
    title: "Task declined",
    targetUrl: "/delegated/assigned-by-me",
  },
  "note-added": {
    type: "DELEGATED_TASK_NOTE_ADDED",
    title: "New task note",
    targetUrl: "/delegated/assigned-by-me",
  },
  completed: {
    type: "DELEGATED_TASK_COMPLETED",
    title: "Task completed",
    targetUrl: "/delegated/assigned-by-me",
  },
  closed: {
    type: "DELEGATED_TASK_CLOSED",
    title: "Task closed",
    targetUrl: "/delegated/assigned-to-me",
  },
};

function actorName(actor: NotificationActor) {
  return actor.name?.trim() || actor.email || "A user";
}

function eventKey(input: CreateDelegatedTaskNotificationInput) {
  if (input.event === "note-added") {
    if (!input.taskNoteId) {
      throw new Error("taskNoteId is required for delegated note notifications");
    }
    return `delegated-note:${input.taskNoteId}:created`;
  }

  const suffix = input.event === "received" ? "created" : input.event;
  return `delegated:${input.delegatedTaskId}:${suffix}`;
}

function notificationBody(input: CreateDelegatedTaskNotificationInput) {
  const name = actorName(input.actor);
  const messages: Record<DelegatedNotificationEvent, string> = {
    received: `${name} assigned you: ${input.taskTitle}`,
    accepted: `${name} accepted: ${input.taskTitle}`,
    declined: `${name} declined: ${input.taskTitle}`,
    "note-added": `${name} added a note on: ${input.taskTitle}`,
    completed: `${name} completed: ${input.taskTitle}`,
    closed: `${name} closed: ${input.taskTitle}`,
  };

  const message = messages[input.event];
  if (input.event !== "declined" || !input.reason?.trim()) {
    return message;
  }

  return `${message}\nReason: ${input.reason.trim()}`;
}

export function createDelegatedTaskNotification(
  input: CreateDelegatedTaskNotificationInput,
  db: NotificationDatabase
) {
  if (!input.recipientUserId || input.recipientUserId === input.actor.id) {
    return null;
  }

  const config = eventConfig[input.event];
  return createNotification(
    {
      recipientUserId: input.recipientUserId,
      actorUserId: input.actor.id,
      type: config.type,
      title: config.title,
      body: notificationBody(input),
      targetUrl: input.targetUrl ?? config.targetUrl,
      metadata: {
        delegatedTaskId: input.delegatedTaskId,
        ...(input.taskNoteId ? { taskNoteId: input.taskNoteId } : {}),
      },
      eventKey: eventKey(input),
    },
    db
  );
}
