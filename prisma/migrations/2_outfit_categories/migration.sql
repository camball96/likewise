-- AlterTable
ALTER TABLE "Outfit" ADD COLUMN "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];
