-- Everything belongs to the couple (2026-10-04):
--  • no per-person splits, settlements or default split mode;
--  • `paidById` stays as information only ("quem pagou").
-- Also moves palette keys from the 10-hue palette to the "Planta" steel ramp tones.

-- DropForeignKey
ALTER TABLE "TransactionSplit" DROP CONSTRAINT "TransactionSplit_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "TransactionSplit" DROP CONSTRAINT "TransactionSplit_memberId_fkey";

-- DropForeignKey
ALTER TABLE "RecurringRuleSplit" DROP CONSTRAINT "RecurringRuleSplit_ruleId_fkey";

-- DropForeignKey
ALTER TABLE "RecurringRuleSplit" DROP CONSTRAINT "RecurringRuleSplit_memberId_fkey";

-- DropForeignKey
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_householdId_fkey";

-- DropForeignKey
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_fromMemberId_fkey";

-- DropForeignKey
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_toMemberId_fkey";

-- AlterTable
ALTER TABLE "Household" DROP COLUMN "defaultSplitMode";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "splitMode";

-- AlterTable
ALTER TABLE "RecurringRule" DROP COLUMN "splitMode";

-- DropTable
DROP TABLE "TransactionSplit";

-- DropTable
DROP TABLE "RecurringRuleSplit";

-- DropTable
DROP TABLE "Settlement";

-- DropEnum
DROP TYPE "SplitMode";

-- ─────────────────────────────────────────────────────────────────────────────
-- Data: 10-hue palette keys → steel ramp tones ("300" | "500" | "700" | "900" | "neutral")
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE "Category" SET "color" = CASE "color"
  WHEN 'clay' THEN '700' WHEN 'moss' THEN '700' WHEN 'olive' THEN '500'
  WHEN 'teal' THEN '500' WHEN 'rose' THEN '300' WHEN 'ochre' THEN '300'
  WHEN 'sand' THEN '300' WHEN 'slate' THEN '900' WHEN 'plum' THEN '900'
  WHEN 'ink' THEN 'neutral' ELSE "color" END;

UPDATE "Account" SET "color" = CASE "color"
  WHEN 'clay' THEN '700' WHEN 'moss' THEN '700' WHEN 'olive' THEN '500'
  WHEN 'teal' THEN '500' WHEN 'rose' THEN '300' WHEN 'ochre' THEN '300'
  WHEN 'sand' THEN '300' WHEN 'slate' THEN '900' WHEN 'plum' THEN '900'
  WHEN 'ink' THEN 'neutral' ELSE "color" END;

UPDATE "CreditCard" SET "color" = CASE "color"
  WHEN 'clay' THEN '700' WHEN 'moss' THEN '700' WHEN 'olive' THEN '500'
  WHEN 'teal' THEN '500' WHEN 'rose' THEN '300' WHEN 'ochre' THEN '300'
  WHEN 'sand' THEN '300' WHEN 'slate' THEN '900' WHEN 'plum' THEN '900'
  WHEN 'ink' THEN 'neutral' ELSE "color" END;

UPDATE "Tag" SET "color" = CASE "color"
  WHEN 'clay' THEN '700' WHEN 'moss' THEN '700' WHEN 'olive' THEN '500'
  WHEN 'teal' THEN '500' WHEN 'rose' THEN '300' WHEN 'ochre' THEN '300'
  WHEN 'sand' THEN '300' WHEN 'slate' THEN '900' WHEN 'plum' THEN '900'
  WHEN 'ink' THEN 'neutral' ELSE "color" END
WHERE "color" IS NOT NULL;

-- Members must keep distinct tones inside a household: reassign by join order.
UPDATE "HouseholdMember" AS m
   SET "color" = t.tone
  FROM (
    SELECT "id",
           (ARRAY['700', '300', '900', '500'])[
             ((ROW_NUMBER() OVER (PARTITION BY "householdId" ORDER BY "joinedAt") - 1) % 4) + 1
           ] AS tone
      FROM "HouseholdMember"
  ) AS t
 WHERE m."id" = t."id";
