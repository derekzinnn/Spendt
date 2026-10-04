-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('EXPENSE', 'INCOME');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CASH', 'BENEFIT');

-- CreateEnum
CREATE TYPE "CardBrand" AS ENUM ('VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PAID', 'PENDING');

-- CreateEnum
CREATE TYPE "SplitMode" AS ENUM ('INDIVIDUAL', 'EQUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "activeHouseholdId" UUID,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Household" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdMember" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
    "displayName" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(3),

    CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdInvite" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
    "tokenHash" TEXT NOT NULL,
    "invitedById" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "monthlyBudgetCents" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "holderId" UUID,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "color" TEXT NOT NULL,
    "initialBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "initialBalanceDate" DATE NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCard" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "holderId" UUID,
    "paymentAccountId" UUID,
    "name" TEXT NOT NULL,
    "brand" "CardBrand" NOT NULL DEFAULT 'OTHER',
    "color" TEXT NOT NULL,
    "lastFour" CHAR(4),
    "limitCents" INTEGER NOT NULL,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "creditCardId" UUID NOT NULL,
    "referenceMonth" DATE NOT NULL,
    "periodStart" DATE NOT NULL,
    "closingDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PAID',
    "amountCents" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "dueDate" DATE,
    "paidDate" DATE,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "categoryId" UUID,
    "accountId" UUID,
    "toAccountId" UUID,
    "creditCardId" UUID,
    "invoiceId" UUID,
    "paidById" UUID,
    "splitMode" "SplitMode" NOT NULL DEFAULT 'INDIVIDUAL',
    "installmentPlanId" UUID,
    "installmentNumber" INTEGER,
    "recurringRuleId" UUID,
    "occurrenceDate" DATE,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionSplit" (
    "transactionId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "shareBps" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "TransactionSplit_pkey" PRIMARY KEY ("transactionId","memberId")
);

-- CreateTable
CREATE TABLE "InstallmentPlan" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "totalAmountCents" INTEGER NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "InstallmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringRule" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "categoryId" UUID,
    "accountId" UUID,
    "creditCardId" UUID,
    "paidById" UUID,
    "splitMode" "SplitMode" NOT NULL DEFAULT 'INDIVIDUAL',
    "frequency" "RecurrenceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "interval" INTEGER NOT NULL DEFAULT 1,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "autoConfirm" BOOLEAN NOT NULL DEFAULT false,
    "generatedUntil" DATE,
    "pausedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecurringRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringRuleSplit" (
    "ruleId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "shareBps" INTEGER NOT NULL,

    CONSTRAINT "RecurringRuleSplit_pkey" PRIMARY KEY ("ruleId","memberId")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "fromMemberId" UUID NOT NULL,
    "toMemberId" UUID NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TagToTransaction" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_TagToTransaction_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdMember_householdId_userId_key" ON "HouseholdMember"("householdId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdInvite_tokenHash_key" ON "HouseholdInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "HouseholdInvite_householdId_idx" ON "HouseholdInvite"("householdId");

-- CreateIndex
CREATE INDEX "Category_householdId_kind_idx" ON "Category"("householdId", "kind");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Account_householdId_idx" ON "Account"("householdId");

-- CreateIndex
CREATE INDEX "CreditCard_householdId_idx" ON "CreditCard"("householdId");

-- CreateIndex
CREATE INDEX "Invoice_householdId_dueDate_idx" ON "Invoice"("householdId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_creditCardId_referenceMonth_key" ON "Invoice"("creditCardId", "referenceMonth");

-- CreateIndex
CREATE INDEX "Transaction_householdId_date_idx" ON "Transaction"("householdId", "date");

-- CreateIndex
CREATE INDEX "Transaction_householdId_status_dueDate_idx" ON "Transaction"("householdId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Transaction_householdId_categoryId_date_idx" ON "Transaction"("householdId", "categoryId", "date");

-- CreateIndex
CREATE INDEX "Transaction_accountId_date_idx" ON "Transaction"("accountId", "date");

-- CreateIndex
CREATE INDEX "Transaction_toAccountId_idx" ON "Transaction"("toAccountId");

-- CreateIndex
CREATE INDEX "Transaction_creditCardId_date_idx" ON "Transaction"("creditCardId", "date");

-- CreateIndex
CREATE INDEX "Transaction_invoiceId_idx" ON "Transaction"("invoiceId");

-- CreateIndex
CREATE INDEX "Transaction_paidById_idx" ON "Transaction"("paidById");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_installmentPlanId_installmentNumber_key" ON "Transaction"("installmentPlanId", "installmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_recurringRuleId_occurrenceDate_key" ON "Transaction"("recurringRuleId", "occurrenceDate");

-- CreateIndex
CREATE INDEX "TransactionSplit_memberId_idx" ON "TransactionSplit"("memberId");

-- CreateIndex
CREATE INDEX "InstallmentPlan_householdId_idx" ON "InstallmentPlan"("householdId");

-- CreateIndex
CREATE INDEX "RecurringRule_householdId_idx" ON "RecurringRule"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_householdId_name_key" ON "Tag"("householdId", "name");

-- CreateIndex
CREATE INDEX "Settlement_householdId_date_idx" ON "Settlement"("householdId", "date");

-- CreateIndex
CREATE INDEX "_TagToTransaction_B_index" ON "_TagToTransaction"("B");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeHouseholdId_fkey" FOREIGN KEY ("activeHouseholdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "HouseholdMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "HouseholdMember"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "HouseholdMember"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "HouseholdMember"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HouseholdMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_installmentPlanId_fkey" FOREIGN KEY ("installmentPlanId") REFERENCES "InstallmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recurringRuleId_fkey" FOREIGN KEY ("recurringRuleId") REFERENCES "RecurringRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionSplit" ADD CONSTRAINT "TransactionSplit_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionSplit" ADD CONSTRAINT "TransactionSplit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HouseholdMember"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "HouseholdMember"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRuleSplit" ADD CONSTRAINT "RecurringRuleSplit_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RecurringRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRuleSplit" ADD CONSTRAINT "RecurringRuleSplit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HouseholdMember"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES "HouseholdMember"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES "HouseholdMember"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTransaction" ADD CONSTRAINT "_TagToTransaction_A_fkey" FOREIGN KEY ("A") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TagToTransaction" ADD CONSTRAINT "_TagToTransaction_B_fkey" FOREIGN KEY ("B") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Domain invariants Prisma cannot express (hand-written; Prisma Migrate keeps them).
-- Keep in sync with CLAUDE.md → "Domain rules".
-- ─────────────────────────────────────────────────────────────────────────────

-- Money columns
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amount_positive" CHECK ("amountCents" > 0);
ALTER TABLE "TransactionSplit" ADD CONSTRAINT "TransactionSplit_amount_non_negative" CHECK ("amountCents" >= 0);
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_amount_positive" CHECK ("totalAmountCents" > 0);
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_amount_positive" CHECK ("amountCents" > 0);
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_amount_positive" CHECK ("amountCents" > 0);
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_limit_non_negative" CHECK ("limitCents" >= 0);
ALTER TABLE "Category" ADD CONSTRAINT "Category_budget_non_negative" CHECK ("monthlyBudgetCents" IS NULL OR "monthlyBudgetCents" >= 0);

-- Days of month are 1–31 and get clamped to the month length by the app
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_days_in_range" CHECK ("closingDay" BETWEEN 1 AND 31 AND "dueDay" BETWEEN 1 AND 31);

-- Percentages in basis points
ALTER TABLE "TransactionSplit" ADD CONSTRAINT "TransactionSplit_share_range" CHECK ("shareBps" BETWEEN 0 AND 10000);
ALTER TABLE "RecurringRuleSplit" ADD CONSTRAINT "RecurringRuleSplit_share_range" CHECK ("shareBps" BETWEEN 0 AND 10000);

-- Shape of a ledger row:
--  • EXPENSE / INCOME: never both an account and a card; a PAID row must have one of them
--    (a PENDING bill may not know its account yet). Never a destination account.
--  • TRANSFER: always has a source account and exactly one destination
--    (another account, or an invoice being paid).
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_target_shape" CHECK (
  (
    "type" IN ('EXPENSE', 'INCOME')
    AND "toAccountId" IS NULL
    AND NOT ("accountId" IS NOT NULL AND "creditCardId" IS NOT NULL)
    AND ("status" = 'PENDING' OR "accountId" IS NOT NULL OR "creditCardId" IS NOT NULL)
  )
  OR (
    "type" = 'TRANSFER'
    AND "accountId" IS NOT NULL
    AND (("toAccountId" IS NOT NULL) <> ("invoiceId" IS NOT NULL))
  )
);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_invoice_needs_card" CHECK ("invoiceId" IS NULL OR "creditCardId" IS NOT NULL);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_installment_shape" CHECK (("installmentPlanId" IS NULL) = ("installmentNumber" IS NULL));
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_installment_number_positive" CHECK ("installmentNumber" IS NULL OR "installmentNumber" >= 1);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recurrence_shape" CHECK ("recurringRuleId" IS NULL OR "occurrenceDate" IS NOT NULL);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_transfer_distinct_accounts" CHECK ("toAccountId" IS NULL OR "toAccountId" <> "accountId");

-- Other shapes
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_count_range" CHECK ("installmentCount" BETWEEN 2 AND 120);
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_interval_positive" CHECK ("interval" >= 1);
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_dates_ordered" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_distinct_members" CHECK ("fromMemberId" <> "toMemberId");
ALTER TABLE "Category" ADD CONSTRAINT "Category_not_own_parent" CHECK ("parentId" IS NULL OR "parentId" <> "id");
