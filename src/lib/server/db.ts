import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

declare global {
  var prismaGlobal: PrismaClient | null | undefined;
}

function createPrismaClient() {
  if (!connectionString) return null;

  const adapter = new PrismaPg(new Pool({ connectionString }));
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const prismaInstance = global.prismaGlobal ?? createPrismaClient();

export const prisma: PrismaClient =
  prismaInstance ??
  new Proxy({} as PrismaClient, {
    get() {
      throw new Error("DATABASE_URL is not configured. Database-backed API routes are unavailable.");
    },
  });

if (!connectionString) {
  console.warn("DATABASE_URL is not configured. Database-backed API routes will fail until it is set.");
}

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prismaInstance;
}
