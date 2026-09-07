import {
  buildWeeklySummary, DEFAULT_WEEKLY_SUMMARY_SETTINGS, parseWeeklySummarySettings,
  type WeeklySummarySettings, type WeeklySummaryTask,
} from "./weekly-summary.ts";
import { getBrisbaneDate } from "./date-time.ts";

export type WeeklySummaryDependencies = {
  currentUser(): Promise<{ id: string; weeklySummarySettings: unknown } | null>;
  profiles(userId: string): Promise<{ id: string; name: string; tasks: WeeklySummaryTask[] }[]>;
  saveSettings(userId: string, settings: WeeklySummarySettings): Promise<void>;
  now(): Date;
};

const headers = { "Cache-Control": "private, no-store" };

export function weeklySummaryHandlers(deps: WeeklySummaryDependencies) {
  return {
    async GET() {
      const user = await deps.currentUser();
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
      const settings = parseWeeklySummarySettings(user.weeklySummarySettings) ?? { ...DEFAULT_WEEKLY_SUMMARY_SETTINGS };
      if (!settings.enabled) return Response.json({ settings, summary: null }, { headers });
      const profiles = await deps.profiles(user.id);
      const summary = buildWeeklySummary(profiles, profiles.flatMap((profile) => profile.tasks), getBrisbaneDate(deps.now()), settings);
      return Response.json({ settings, summary }, { headers });
    },
    async PATCH(req: Request) {
      const user = await deps.currentUser();
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
      const settings = parseWeeklySummarySettings(await req.json().catch(() => null));
      if (!settings) return Response.json({ error: "Choose two different weekdays and a valid on/off setting." }, { status: 400, headers });
      await deps.saveSettings(user.id, settings);
      return Response.json({ settings }, { headers });
    },
  };
}
