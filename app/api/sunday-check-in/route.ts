import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/app/lib/prisma";
import { isMissingDatabaseObjectError } from "@/app/lib/prisma-errors";
import { buildSundayCheckInSummary } from "@/app/lib/routine-support-summary";

const REFLECTION_OPTIONS = new Set([
  "I looked after my health",
  "I completed my routines",
  "I stayed organised",
  "I kept up with school",
  "Something else",
]);
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function currentDateValue() {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseDateValue(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function weekStartFor(value: string) {
  const date = parseDateValue(value);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (weekday - 1));
  return dateValue(date);
}

function getCheckInDate(req: Request) {
  const url = new URL(req.url);
  const devAccess = process.env.NODE_ENV !== "production" && url.searchParams.get("dev") === "1";
  const requestedDate = url.searchParams.get("date");
  const today =
    devAccess && requestedDate && DATE_ONLY_RE.test(requestedDate)
      ? requestedDate
      : currentDateValue();
  return {
    available: devAccess || parseDateValue(today).getUTCDay() === 0,
    today,
  };
}

async function getRoutineProfile(profileId: string, email: string) {
  try {
    return await prisma.profile.findFirst({
      where: { id: profileId, user: { email } },
      select: { id: true, name: true, routineSupportEnabled: true },
    });
  } catch (error) {
    if (isMissingDatabaseObjectError(error, "routineSupportEnabled", ["P2022"])) {
      return null;
    }
    throw error;
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profileId = new URL(req.url).searchParams.get("profileId")?.trim();
  if (!profileId) {
    return Response.json({ error: "profileId is required" }, { status: 400 });
  }

  const { available, today } = getCheckInDate(req);
  if (!available) return Response.json({ available: false });

  const profile = await getRoutineProfile(profileId, session.user.email);
  if (!profile?.routineSupportEnabled) {
    return Response.json({ available: false });
  }

  const weekStartValue = weekStartFor(today);
  const weekStart = parseDateValue(weekStartValue);
  let existing;
  try {
    existing = await prisma.sundayCheckIn.findUnique({
      where: { profileId_weekStart: { profileId, weekStart } },
      select: { completedAt: true },
    });
  } catch (error) {
    if (isMissingDatabaseObjectError(error, "sundaycheckin", ["P2021"])) {
      return Response.json({ available: false });
    }
    throw error;
  }

  const [tasks, projects] = await Promise.all([
    prisma.task.findMany({
      where: { profileId },
      select: {
        id: true,
        projectId: true,
        startDate: true,
        completedAt: true,
        completedOn: true,
        recurrenceSeriesId: true,
        repeatEnabled: true,
        repeatPattern: true,
        repeatInterval: true,
        repeatDays: true,
        repeatWeeklyDay: true,
        repeatMonthlyDay: true,
        repeatPaused: true,
        repeatPauseUntil: true,
      },
    }),
    prisma.project.findMany({
      where: { profileId, archived: false },
      select: { id: true, name: true },
    }),
  ]);

  return Response.json({
    available: true,
    completed: Boolean(existing),
    profileName: profile.name,
    summary: buildSundayCheckInSummary(tasks, projects, weekStartValue, today),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const profileId = typeof body?.profileId === "string" ? body.profileId.trim() : "";
  const selectedOptions = Array.isArray(body?.selectedOptions)
    ? body.selectedOptions.filter(
        (option: unknown): option is string =>
          typeof option === "string" && REFLECTION_OPTIONS.has(option)
      )
    : [];
  const reflection = typeof body?.reflection === "string" ? body.reflection.trim() : "";

  if (!profileId) {
    return Response.json({ error: "profileId is required" }, { status: 400 });
  }
  if (selectedOptions.length === 0 && !reflection) {
    return Response.json({ error: "Choose an option or add a reflection" }, { status: 400 });
  }
  if (reflection.length > 2000) {
    return Response.json({ error: "Reflection must be 2000 characters or fewer" }, { status: 400 });
  }

  const { available, today } = getCheckInDate(req);
  if (!available) {
    return Response.json({ error: "Sunday Check-In is available on Sundays" }, { status: 403 });
  }

  const profile = await getRoutineProfile(profileId, session.user.email);
  if (!profile?.routineSupportEnabled) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  const weekStart = parseDateValue(weekStartFor(today));
  const checkIn = await prisma.sundayCheckIn.upsert({
    where: { profileId_weekStart: { profileId, weekStart } },
    create: {
      profileId,
      weekStart,
      selectedOptions,
      reflection: reflection || null,
    },
    update: {},
    select: { completedAt: true },
  });

  return Response.json({ completed: true, completedAt: checkIn.completedAt });
}
