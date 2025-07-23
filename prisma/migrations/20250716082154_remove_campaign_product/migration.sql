/*
  Warnings:

  - You are about to drop the `CampaignProduct` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `affiliateLink` to the `Campaign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `Campaign` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CampaignProduct" DROP CONSTRAINT "CampaignProduct_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "CampaignProduct" DROP CONSTRAINT "CampaignProduct_productId_fkey";

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "affiliateLink" TEXT NOT NULL,
ADD COLUMN     "clicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "productId" TEXT NOT NULL,
ADD COLUMN     "referrals" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "CampaignProduct";
