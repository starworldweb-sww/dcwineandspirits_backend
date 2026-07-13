import "dotenv/config";
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis;

const prismaOptions = {
  log: ["error", "warn"],
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaOptions);

globalForPrisma.prisma = prisma;