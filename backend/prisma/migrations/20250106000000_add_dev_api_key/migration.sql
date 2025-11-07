-- AlterTable
ALTER TABLE "User" ADD COLUMN "devApiKey" TEXT;

-- CreateTable
CREATE TABLE "UsageStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appRequestsToday" INTEGER NOT NULL DEFAULT 0,
    "appRequestsMonth" INTEGER NOT NULL DEFAULT 0,
    "devRequestsToday" INTEGER NOT NULL DEFAULT 0,
    "devRequestsMonth" INTEGER NOT NULL DEFAULT 0,
    "lastResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageStats_userId_key" ON "UsageStats"("userId");

-- CreateIndex
CREATE INDEX "UsageStats_userId_idx" ON "UsageStats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_devApiKey_key" ON "User"("devApiKey");

-- CreateIndex
CREATE INDEX "User_devApiKey_idx" ON "User"("devApiKey");

-- AddForeignKey
ALTER TABLE "UsageStats" ADD CONSTRAINT "UsageStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Generate devApiKey for existing users
UPDATE "User" SET "devApiKey" = 'ckp_' || substr(md5(random()::text || clock_timestamp()::text), 1, 32) WHERE "devApiKey" IS NULL;

-- Create UsageStats for existing users
INSERT INTO "UsageStats" ("id", "userId", "appRequestsToday", "appRequestsMonth", "devRequestsToday", "devRequestsMonth", "lastResetDate", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    u.id,
    0,
    0,
    0,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "UsageStats" WHERE "userId" = u.id);

