import { Prisma } from "@prisma/client";
import {
  buildDailyTaskDigest,
  formatDailyTaskDigestBody,
  getLocalDigestSnapshot,
  isDailyTaskDigestDue,
  normaliseDailyTaskDigestSettings,
} from "@/app/lib/daily-task-digest";
import { deliverWebPushNotification } from "@/app/lib/push-delivery";
import { prisma } from "@/app/lib/prisma";
import { dateOnlyToUtcDate } from "@/app/lib/date-time";

export const dynamic = "force-dynamic";

const CLAIM_LEASE_MS = 15 * 60 * 1000;

function isAuthorised(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

async function claimDigest(userId: string, digestDate: Date, now: Date) {
  try {
    await prisma.dailyTaskDigest.create({ data: { userId, digestDate } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
  }

  const claimed = await prisma.dailyTaskDigest.updateMany({
    where: {
      userId,
      digestDate,
      deliveredAt: null,
      OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - CLAIM_LEASE_MS) } }],
    },
    data: { claimedAt: now },
  });
  return claimed.count === 1;
}

export async function GET(req: Request) {
  if (!isAuthorised(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const users = await prisma.user.findMany({
    where: { archivedAt: null },
    select: { id: true, dailyTaskDigestSettings: true },
  });
  const result = { considered: users.length, due: 0, sent: 0, skipped: 0, failed: 0 };

  for (const user of users) {
    const settings = normaliseDailyTaskDigestSettings(user.dailyTaskDigestSettings);
    if (!isDailyTaskDigestDue(now, settings)) continue;
    result.due += 1;

    const snapshot = getLocalDigestSnapshot(now, settings.timeZone);
    const digestDate = dateOnlyToUtcDate(snapshot.date);
    const tasks = await prisma.task.findMany({
      where: {
        profile: { userId: user.id },
        completedOn: null,
        delegatedTask: { is: null },
        OR: [
          { startDate: digestDate },
          { dueAt: digestDate },
          { dueAt: { lt: digestDate } },
        ],
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        dueAt: true,
        completedOn: true,
      },
    });
    const digest = buildDailyTaskDigest(tasks, snapshot.date);
    if (digest.tasks.length === 0) {
      result.skipped += 1;
      continue;
    }

    if (!(await claimDigest(user.id, digestDate, now))) {
      result.skipped += 1;
      continue;
    }

    try {
      const delivery = await deliverWebPushNotification({
        recipientUserId: user.id,
        type: "DAILY_TASK_DIGEST",
        title: "Today’s tasks",
        body: formatDailyTaskDigestBody(digest),
        targetUrl: "/overview?focus=today",
        eventKey: `daily-task-digest:${user.id}:${snapshot.date}`,
      });
      if (delivery.failed > 0 || delivery.skippedReason === "missing-vapid") {
        result.failed += 1;
        continue;
      }
      await prisma.dailyTaskDigest.updateMany({
        where: { userId: user.id, digestDate, claimedAt: now, deliveredAt: null },
        data: { deliveredAt: new Date() },
      });
      result.sent += delivery.delivered;
      if (delivery.delivered === 0) result.skipped += 1;
    } catch (error) {
      result.failed += 1;
      console.warn("[daily-task-digest] delivery failed", {
        userId: user.id,
        date: snapshot.date,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
