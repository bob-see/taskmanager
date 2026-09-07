import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth-options";
import { prisma } from "@/app/lib/prisma";
import { weeklySummaryHandlers } from "@/app/lib/weekly-summary-service";

const dateOnly = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;

const handlers = weeklySummaryHandlers({
  async currentUser() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;
    return prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, weeklySummarySettings: true },
    });
  },
  async profiles(userId) {
    const profiles = await prisma.profile.findMany({
      where: { userId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, name: true,
        tasks: {
          select: {
            id: true, title: true, startDate: true, dueAt: true, createdAt: true,
            completedOn: true, completedAt: true, recurrenceSeriesId: true,
            repeatEnabled: true, repeatPattern: true, repeatInterval: true,
            repeatDays: true, repeatWeeklyDay: true, repeatMonthlyDay: true,
            repeatPaused: true, repeatPauseUntil: true,
            project: { select: { archived: true } },
          },
        },
      },
    });
    return profiles.map((profile) => ({
      id: profile.id, name: profile.name,
      tasks: profile.tasks.map(({ project, ...task }) => ({
        ...task, profileId: profile.id, projectArchived: project?.archived ?? false, startDate: dateOnly(task.startDate)!,
        dueAt: dateOnly(task.dueAt), createdAt: task.createdAt.toISOString(),
        completedOn: dateOnly(task.completedOn), completedAt: task.completedAt?.toISOString() ?? null,
        repeatPauseUntil: dateOnly(task.repeatPauseUntil),
      })),
    }));
  },
  async saveSettings(userId, settings) {
    await prisma.user.update({ where: { id: userId }, data: { weeklySummarySettings: settings } });
  },
  now: () => new Date(),
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
