-- CreateEnum
CREATE TYPE "DoorPaymentMethod" AS ENUM ('CASH', 'PIX', 'CARD', 'FREE');

-- AlterTable
ALTER TABLE "Advertiser" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "listCommissionType" "DiscountType",
ADD COLUMN     "listCommissionValue" INTEGER,
ADD COLUMN     "publicCode" TEXT;

-- Anunciantes que já existiam ganham link secreto e código público
UPDATE "Advertiser" SET
  "accessToken" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  "publicCode"  = substr(md5(random()::text || "id"), 1, 8);
ALTER TABLE "Advertiser" ALTER COLUMN "accessToken" SET NOT NULL, ALTER COLUMN "publicCode" SET NOT NULL;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "doorPriceCents" INTEGER,
ADD COLUMN     "listClosesAt" TIMESTAMP(3),
ADD COLUMN     "listEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "listMaxPerPromoter" INTEGER,
ADD COLUMN     "listPriceCents" INTEGER,
ADD COLUMN     "listPublicSignup" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "listValidUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GuestListEntry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "advertiserId" TEXT,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "phone" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoorSale" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestListEntryId" TEXT,
    "advertiserId" TEXT,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" "DoorPaymentMethod" NOT NULL,
    "commissionCents" INTEGER NOT NULL DEFAULT 0,
    "staffName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoorSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestListEntry_eventId_nameKey_idx" ON "GuestListEntry"("eventId", "nameKey");

-- CreateIndex
CREATE INDEX "GuestListEntry_advertiserId_idx" ON "GuestListEntry"("advertiserId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestListEntry_eventId_advertiserId_nameKey_key" ON "GuestListEntry"("eventId", "advertiserId", "nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "DoorSale_guestListEntryId_key" ON "DoorSale"("guestListEntryId");

-- CreateIndex
CREATE INDEX "DoorSale_eventId_createdAt_idx" ON "DoorSale"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "DoorSale_advertiserId_idx" ON "DoorSale"("advertiserId");

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_accessToken_key" ON "Advertiser"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_publicCode_key" ON "Advertiser"("publicCode");

-- AddForeignKey
ALTER TABLE "GuestListEntry" ADD CONSTRAINT "GuestListEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestListEntry" ADD CONSTRAINT "GuestListEntry_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoorSale" ADD CONSTRAINT "DoorSale_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoorSale" ADD CONSTRAINT "DoorSale_guestListEntryId_fkey" FOREIGN KEY ("guestListEntryId") REFERENCES "GuestListEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoorSale" ADD CONSTRAINT "DoorSale_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

