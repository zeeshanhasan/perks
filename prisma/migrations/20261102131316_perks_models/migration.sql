-- CreateTable
CREATE TABLE "Employer" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "domains" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BenefitPolicy" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "discountPercent" INTEGER NOT NULL DEFAULT 10,
    "eligibilityMonths" INTEGER DEFAULT 12,
    "discountScope" TEXT NOT NULL DEFAULT 'employee_only',
    "combinesWithProduct" BOOLEAN NOT NULL DEFAULT false,
    "combinesWithOrder" BOOLEAN NOT NULL DEFAULT false,
    "combinesWithShipping" BOOLEAN NOT NULL DEFAULT false,
    "employeeOnlyProducts" TEXT NOT NULL DEFAULT '[]',
    "excludedProducts" TEXT NOT NULL DEFAULT '[]',
    "discountId" TEXT,
    "validationId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmployeeMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "verifiedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subject" TEXT,
    "result" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "EmployeeMembership_shop_status_idx" ON "EmployeeMembership"("shop", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMembership_shop_customerId_key" ON "EmployeeMembership"("shop", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationChallenge_tokenHash_key" ON "VerificationChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "VerificationChallenge_shop_customerId_idx" ON "VerificationChallenge"("shop", "customerId");

-- CreateIndex
CREATE INDEX "AuditEvent_shop_createdAt_idx" ON "AuditEvent"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimitHit_shop_key_createdAt_idx" ON "RateLimitHit"("shop", "key", "createdAt");
