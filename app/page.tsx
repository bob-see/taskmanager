import { HomeClient } from "@/app/home-client";
import { getBrisbaneSnapshot } from "@/app/lib/date-time";

export default function Home() {
  const initialSnapshot = getBrisbaneSnapshot(new Date());
  return <HomeClient initialSnapshot={initialSnapshot} />;
}
