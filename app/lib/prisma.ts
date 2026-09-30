import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl = new URL(process.env.DATABASE_URL!);

// Each Vercel runtime owns its own MariaDB pool. Keeping the driver's defaults
// would reserve up to 10 idle connections per runtime, which can exhaust the
// Railway proxy during a burst or a recovery event.
databaseUrl.searchParams.set(
  "connectionLimit",
  process.env.DATABASE_CONNECTION_LIMIT ?? "2"
);
databaseUrl.searchParams.set("minimumIdle", "0");
databaseUrl.searchParams.set("acquireTimeout", "30000");

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaMariaDb(databaseUrl.toString()),
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
