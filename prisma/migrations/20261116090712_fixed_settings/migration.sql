-- Decision 015: perks by work-email login are always on, and email-link verifications last 12 months.
UPDATE "BenefitPolicy" SET "autoDomain" = true, "eligibilityMonths" = 12;
