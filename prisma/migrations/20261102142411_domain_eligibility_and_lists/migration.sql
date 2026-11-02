-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BenefitPolicy" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "discountPercent" INTEGER NOT NULL DEFAULT 10,
    "eligibilityMonths" INTEGER DEFAULT 12,
    "discountScope" TEXT NOT NULL DEFAULT 'selected',
    "autoDomain" BOOLEAN NOT NULL DEFAULT true,
    "combinesWithProduct" BOOLEAN NOT NULL DEFAULT false,
    "combinesWithOrder" BOOLEAN NOT NULL DEFAULT false,
    "combinesWithShipping" BOOLEAN NOT NULL DEFAULT false,
    "employeeOnlyProducts" TEXT NOT NULL DEFAULT '[]',
    "excludedProducts" TEXT NOT NULL DEFAULT '[]',
    "discountedProducts" TEXT NOT NULL DEFAULT '[]',
    "employeeOnlyHandles" TEXT NOT NULL DEFAULT '[]',
    "discountId" TEXT,
    "validationId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BenefitPolicy" ("combinesWithOrder", "combinesWithProduct", "combinesWithShipping", "discountId", "discountPercent", "discountScope", "eligibilityMonths", "employeeOnlyProducts", "enabled", "excludedProducts", "shop", "updatedAt", "validationId") SELECT "combinesWithOrder", "combinesWithProduct", "combinesWithShipping", "discountId", "discountPercent", "discountScope", "eligibilityMonths", "employeeOnlyProducts", "enabled", "excludedProducts", "shop", "updatedAt", "validationId" FROM "BenefitPolicy";
DROP TABLE "BenefitPolicy";
ALTER TABLE "new_BenefitPolicy" RENAME TO "BenefitPolicy";
CREATE TABLE "new_EmployeeMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'link',
    "status" TEXT NOT NULL,
    "verifiedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_EmployeeMembership" ("createdAt", "customerId", "expiresAt", "id", "revokedAt", "shop", "status", "updatedAt", "verifiedAt", "workEmail") SELECT "createdAt", "customerId", "expiresAt", "id", "revokedAt", "shop", "status", "updatedAt", "verifiedAt", "workEmail" FROM "EmployeeMembership";
DROP TABLE "EmployeeMembership";
ALTER TABLE "new_EmployeeMembership" RENAME TO "EmployeeMembership";
CREATE INDEX "EmployeeMembership_shop_status_idx" ON "EmployeeMembership"("shop", "status");
CREATE UNIQUE INDEX "EmployeeMembership_shop_customerId_key" ON "EmployeeMembership"("shop", "customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
