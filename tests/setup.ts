/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// Fresh SQLite DB per test file, built from the real migrations.
const dir = path.resolve(__dirname, "../node_modules/.cache/perks-test");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, `test-${process.pid}-${Date.now()}.sqlite`);
rmSync(file, { force: true });

const prisma = new PrismaClient({ datasourceUrl: `file:${file}` });
(globalThis as any).prismaGlobal = prisma;

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

await (async () => {
  for (const s of statements) await prisma.$executeRawUnsafe(s);
})();
