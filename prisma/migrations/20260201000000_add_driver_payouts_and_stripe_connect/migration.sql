-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "drivers" ADD COLUMN "stripeConnectAccountId" TEXT;

-- CreateTable
CREATE TABLE "driver_payouts" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "stripeTransferId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drivers_stripeConnectAccountId_key" ON "drivers"("stripeConnectAccountId");

-- AddForeignKey
ALTER TABLE "driver_payouts" ADD CONSTRAINT "driver_payouts_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
