#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

const DEFAULT_PROFILE_ID = "default";
const DEFAULT_PROFILE_NAME = "Default";

async function main() {
  await prisma.profile.upsert({
    where: { id: DEFAULT_PROFILE_ID },
    update: { name: DEFAULT_PROFILE_NAME },
    create: { id: DEFAULT_PROFILE_ID, name: DEFAULT_PROFILE_NAME },
  });

  await prisma.$executeRawUnsafe(
    `UPDATE Task SET profileId = '${DEFAULT_PROFILE_ID}' WHERE profileId IS NULL OR profileId = ''`
  );

  await prisma.$executeRawUnsafe(
    "UPDATE Task SET startDate = createdAt WHERE startDate IS NULL OR startDate > createdAt"
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    return prisma.$disconnect().finally(() => {
      process.exit(1);
    });
  });
