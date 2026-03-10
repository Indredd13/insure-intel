import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const hasTursoUrl = !!process.env.TURSO_DATABASE_URL;
  const hasTursoToken = !!process.env.TURSO_AUTH_TOKEN;

  console.log(`[prisma] TURSO_DATABASE_URL set: ${hasTursoUrl}`);
  console.log(`[prisma] TURSO_AUTH_TOKEN set: ${hasTursoToken}`);
  console.log(`[prisma] NODE_ENV: ${process.env.NODE_ENV}`);

  // Production: use Turso (libSQL) via driver adapter
  if (hasTursoUrl && hasTursoToken) {
    console.log("[prisma] Using Turso adapter");
    const adapter = new PrismaLibSQL({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
    return new PrismaClient({ adapter });
  }

  // Development: use local SQLite file
  console.log("[prisma] Using local SQLite");
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
