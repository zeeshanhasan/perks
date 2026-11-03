/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// One SQLite DB per test worker, built once from the real migrations. Tests clean up their own shop's rows.
const g = globalThis as any;
if (!g.__perksTestPrisma) {
  const dir = path.resolve(__dirname, "../node_modules/.cache/perks-test");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `test-${process.pid}-${randomUUID()}.sqlite`);
  const prisma = new PrismaClient({ datasourceUrl: `file:${file}` });
  const migrationsDir = path.resolve(__dirname, "../prisma/migrations");
  const sql = readdirSync(migrationsDir)
    .filter((d) => !d.endsWith(".toml"))
    .sort()
    .map((d) => readFileSync(path.join(migrationsDir, d, "migration.sql"), "utf8"))
    .join("\n");
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  // Prisma's engine is shared per process, so a later test file in the same worker may land on an
  // already-migrated DB: only migrate when the schema isn't there yet.
  const existing = (await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='Invoice'",
  )) as unknown[];
  if (!existing.length) for (const s of statements) await prisma.$executeRawUnsafe(s);
  g.__perksTestPrisma = prisma;
}
g.prismaGlobal = g.__perksTestPrisma;
