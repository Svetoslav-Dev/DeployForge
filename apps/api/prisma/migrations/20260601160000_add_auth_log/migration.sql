-- CreateEnum
CREATE TYPE "AuthEventType" AS ENUM ('login_success', 'login_failure');

-- CreateTable
CREATE TABLE "AuthLog" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "event" "AuthEventType" NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "os" TEXT,
    "browser" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthLog_timestamp_idx" ON "AuthLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuthLog_username_timestamp_idx" ON "AuthLog"("username", "timestamp");
