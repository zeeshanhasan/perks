-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "basis" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "lines" TEXT NOT NULL DEFAULT '[]',
    "businessName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Invoice" ("amount", "basis", "businessId", "createdAt", "currency", "id", "number", "orderCount", "periodEnd", "periodStart", "shop") SELECT "amount", "basis", "businessId", "createdAt", "currency", "id", "number", "orderCount", "periodEnd", "periodStart", "shop" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_shop_businessId_idx" ON "Invoice"("shop", "businessId");
CREATE UNIQUE INDEX "Invoice_shop_number_key" ON "Invoice"("shop", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
