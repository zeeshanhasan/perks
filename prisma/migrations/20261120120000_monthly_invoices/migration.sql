-- Decision 018: one live invoice per business per month; order fulfilment; what each business is billed for.
ALTER TABLE "Business" ADD COLUMN "billFor" TEXT NOT NULL DEFAULT 'discount';

ALTER TABLE "OrderUsage" ADD COLUMN "fulfillment" TEXT NOT NULL DEFAULT 'unknown';

-- Old invoices were fixed snapshots over any range (test data only); the monthly invoices replace them.
DROP TABLE "Invoice";
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "businessName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Invoice_shop_number_key" ON "Invoice"("shop", "number");
CREATE UNIQUE INDEX "Invoice_shop_businessId_month_key" ON "Invoice"("shop", "businessId", "month");
