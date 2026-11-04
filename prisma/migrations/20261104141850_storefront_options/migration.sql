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
    "storefront" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BenefitPolicy" ("autoDomain", "combinesWithOrder", "combinesWithProduct", "combinesWithShipping", "discountId", "discountPercent", "discountScope", "discountedProducts", "eligibilityMonths", "employeeOnlyHandles", "employeeOnlyProducts", "enabled", "excludedProducts", "shop", "updatedAt", "validationId") SELECT "autoDomain", "combinesWithOrder", "combinesWithProduct", "combinesWithShipping", "discountId", "discountPercent", "discountScope", "discountedProducts", "eligibilityMonths", "employeeOnlyHandles", "employeeOnlyProducts", "enabled", "excludedProducts", "shop", "updatedAt", "validationId" FROM "BenefitPolicy";
DROP TABLE "BenefitPolicy";
ALTER TABLE "new_BenefitPolicy" RENAME TO "BenefitPolicy";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
