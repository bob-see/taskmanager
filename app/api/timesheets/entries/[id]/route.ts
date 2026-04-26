import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createActivityLog } from "@/app/lib/activity-log";
import {
  buildCompletedTimeEntryData,
  ensureTimesheetProfile,
  parseOptionalNotes,
  parseRequiredDate,
  parseRequiredTime,
  parseRoundingMode,
  serializeTimeEntry,
  timeEntrySelect,
  validateTimeRange,
} from "@/app/api/timesheets/shared";
import { combineDateAndTime } from "@/app/timesheets/timesheet-utils";

type Ctx = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.timeEntry.findFirst({
    where: {
      id,
      profile: {
        user: {
          email: session.user.email,
        },
      },
    },
    select: {
      id: true,
      endTime: true,
      profileId: true,
      profile: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!existing) {
    return Response.json({ error: "Time entry not found" }, { status: 404 });
  }

  if (!existing.endTime) {
    return Response.json(
      { error: "Active timer entries cannot be edited here" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const profileId = await ensureTimesheetProfile(body?.profileId);
  if (profileId.error) return profileId.error;

  const profile = await prisma.profile.findFirst({
    where: {
      id: profileId.value,
      user: {
        email: session.user.email,
      },
    },
    select: { id: true, userId: true },
  });

  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  const entryDate = parseRequiredDate(body?.date, "date");
  if (entryDate.error) return entryDate.error;

  const startTime = parseRequiredTime(body?.startTime, "startTime");
  if (startTime.error) return startTime.error;

  const endTime = parseRequiredTime(body?.endTime, "endTime");
  if (endTime.error) return endTime.error;

  const notes = parseOptionalNotes(body?.notes);
  if (notes.error) return notes.error;

  const roundingMode = parseRoundingMode(body?.roundingMode, "nearest-15");
  if (roundingMode.error) return roundingMode.error;

  const startDateTime = combineDateAndTime(entryDate.value, startTime.value);
  const endDateTime = combineDateAndTime(entryDate.value, endTime.value);
  const rangeError = validateTimeRange(startDateTime, endDateTime);
  if (rangeError) return rangeError;

  const updated = await prisma.$transaction(async (tx) => {
    const updatedEntry = await tx.timeEntry.update({
      where: { id },
      data: buildCompletedTimeEntryData({
        entryDate: entryDate.value,
        startTime: startDateTime,
        endTime: endDateTime,
        notes: notes.value,
        profileId: profileId.value,
        roundingMode: roundingMode.value,
        source: "manual",
      }),
      select: timeEntrySelect,
    });

    if (profile.userId) {
      await createActivityLog(tx, {
        userId: profile.userId,
        profileId: profileId.value,
        timeEntryId: updatedEntry.id,
        type: "time_entry.update",
        description: "Updated time entry",
      });
    }

    return updatedEntry;
  });

  return Response.json(serializeTimeEntry(updated));
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.timeEntry.findFirst({
    where: {
      id,
      profile: {
        user: {
          email: session.user.email,
        },
      },
    },
    select: {
      id: true,
      profileId: true,
      profile: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!existing) {
    return Response.json({ error: "Time entry not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.timeEntry.delete({
      where: { id },
    });

    if (existing.profile.userId) {
      await createActivityLog(tx, {
        userId: existing.profile.userId,
        profileId: existing.profileId,
        timeEntryId: existing.id,
        type: "time_entry.delete",
        description: "Deleted time entry",
      });
    }
  });

  return Response.json({ ok: true });
}
