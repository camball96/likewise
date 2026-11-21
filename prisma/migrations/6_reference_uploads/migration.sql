-- Uploaded photos have no source link
ALTER TABLE "Reference" ALTER COLUMN "sourceUrl" DROP NOT NULL;
