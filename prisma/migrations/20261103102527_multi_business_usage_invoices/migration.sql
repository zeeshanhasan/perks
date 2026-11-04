-- AlterTable
ALTER TABLE "EmployeeMembership" ADD COLUMN "businessId" TEXT;

-- CreateTable
CREATE TABLE "Business" (
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
    "billingEmail" TEXT NOT NULL DEFAULT '',
    "billingAddress" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OrderUsage" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Invoice" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Business_shop_idx" ON "Business"("shop");

-- CreateIndex
CREATE INDEX "OrderUsage_shop_businessId_processedAt_idx" ON "OrderUsage"("shop", "businessId", "processedAt");

-- CreateIndex
CREATE INDEX "OrderUsage_shop_customerId_processedAt_idx" ON "OrderUsage"("shop", "customerId", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderUsage_shop_orderId_key" ON "OrderUsage"("shop", "orderId");

-- CreateIndex
CREATE INDEX "Invoice_shop_businessId_idx" ON "Invoice"("shop", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_shop_number_key" ON "Invoice"("shop", "number");
