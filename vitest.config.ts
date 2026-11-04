import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    pool: "forks",
    // Prisma's engine is shared per process; run files one at a time against one migrated DB.
    fileParallelism: false,
  },
});
