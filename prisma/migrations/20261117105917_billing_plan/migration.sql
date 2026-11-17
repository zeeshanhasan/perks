-- AlterTable
ALTER TABLE "BenefitPolicy" ADD COLUMN "billingPausedAt" DATETIME;
ALTER TABLE "BenefitPolicy" ADD COLUMN "planHandle" TEXT;
ALTER TABLE "BenefitPolicy" ADD COLUMN "planShopifyAtStart" TEXT;
