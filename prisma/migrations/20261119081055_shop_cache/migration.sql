-- CreateTable
CREATE TABLE "ShopCache" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "shopGid" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "shopifyPlan" TEXT NOT NULL DEFAULT '',
    "infoAt" DATETIME NOT NULL,
    "billing" TEXT,
    "billingAt" DATETIME
);
