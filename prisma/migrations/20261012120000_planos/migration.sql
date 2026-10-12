-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PLUS', 'PRO');

-- AlterTable
ALTER TABLE "Producer" ADD COLUMN     "feeBps" INTEGER,
ADD COLUMN     "limitListNames" INTEGER,
ADD COLUMN     "limitPromoters" INTEGER,
ADD COLUMN     "limitStaff" INTEGER,
ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "proTrialUntil" TIMESTAMP(3);

