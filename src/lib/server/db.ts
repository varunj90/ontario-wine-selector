import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const adapter = connectionString ? new PrismaPg(new Pool({ connectionString })) : undefined;

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  global.prismaGlobal ??
  new PrismaClient({
    ...(adapter ? { adapter } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (!connectionString) {
  console.warn("DATABASE_URL is not configured. Database-backed API routes will fail until it is set.");
}

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}
