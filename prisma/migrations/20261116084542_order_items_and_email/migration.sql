-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL,
    "currency" TEXT NOT NULL,
    "spend" REAL NOT NULL,
    "total" REAL NOT NULL,
    "discount" REAL NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "items" TEXT NOT NULL DEFAULT '[]',
    "email" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_OrderUsage" ("businessId", "cancelled", "createdAt", "currency", "customerId", "discount", "id", "orderId", "orderName", "processedAt", "shop", "spend", "total") SELECT "businessId", "cancelled", "createdAt", "currency", "customerId", "discount", "id", "orderId", "orderName", "processedAt", "shop", "spend", "total" FROM "OrderUsage";
DROP TABLE "OrderUsage";
ALTER TABLE "new_OrderUsage" RENAME TO "OrderUsage";
CREATE INDEX "OrderUsage_shop_businessId_processedAt_idx" ON "OrderUsage"("shop", "businessId", "processedAt");
CREATE INDEX "OrderUsage_shop_customerId_processedAt_idx" ON "OrderUsage"("shop", "customerId", "processedAt");
CREATE UNIQUE INDEX "OrderUsage_shop_orderId_key" ON "OrderUsage"("shop", "orderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
