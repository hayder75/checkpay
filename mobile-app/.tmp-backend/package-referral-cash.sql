DO $$
BEGIN
  CREATE TYPE "CashPaymentSide" AS ENUM ('EMPLOYER', 'EMPLOYEE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredById" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX IF NOT EXISTS "User_referredById_idx" ON "User"("referredById");

DO $$
BEGIN
  ALTER TABLE "User"
    ADD CONSTRAINT "User_referredById_fkey"
    FOREIGN KEY ("referredById") REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CashPayment" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "employeeId" TEXT,
  "recordedById" TEXT NOT NULL,
  "side" "CashPaymentSide" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT DEFAULT 'ETB',
  "note" TEXT,
  "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CashPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CashPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CashPayment_businessId_idx" ON "CashPayment"("businessId");
CREATE INDEX IF NOT EXISTS "CashPayment_employeeId_idx" ON "CashPayment"("employeeId");
CREATE INDEX IF NOT EXISTS "CashPayment_recordedById_idx" ON "CashPayment"("recordedById");
CREATE INDEX IF NOT EXISTS "CashPayment_side_idx" ON "CashPayment"("side");
CREATE INDEX IF NOT EXISTS "CashPayment_paymentDate_idx" ON "CashPayment"("paymentDate");