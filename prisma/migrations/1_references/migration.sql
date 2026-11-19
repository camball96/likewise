-- CreateEnum
CREATE TYPE "ReferenceStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL,
    "outfitId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "status" "ReferenceStatus" NOT NULL DEFAULT 'PENDING',
    "embedding" vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reference_outfitId_idx" ON "Reference"("outfitId");

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

