-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domains" TEXT NOT NULL DEFAULT '[]',
    "discountType" TEXT NOT NULL DEFAULT 'percentage',
    "discountValue" REAL NOT NULL DEFAULT 10,
    "discountTarget" TEXT NOT NULL DEFAULT '{}',
    "employeeOnlyTarget" TEXT NOT NULL DEFAULT '{}',
    "limitPeriod" TEXT NOT NULL DEFAULT 'none',
    "limitBasis" TEXT NOT NULL DEFAULT 'discount',
    "limitAmount" REAL,
    "limitOverflow" TEXT NOT NULL DEFAULT 'partial',
    "billingEmail" TEXT NOT NULL DEFAULT '',
    "billingAddress" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Business" ("active", "archivedAt", "billingAddress", "billingEmail", "createdAt", "discountTarget", "discountType", "discountValue", "domains", "employeeOnlyTarget", "id", "limitAmount", "limitBasis", "limitPeriod", "name", "shop", "updatedAt") SELECT "active", "archivedAt", "billingAddress", "billingEmail", "createdAt", "discountTarget", "discountType", "discountValue", "domains", "employeeOnlyTarget", "id", "limitAmount", "limitBasis", "limitPeriod", "name", "shop", "updatedAt" FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
CREATE INDEX "Business_shop_idx" ON "Business"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
