-- Flags uploads that are likely personal photos (taken on the user's phone, or a selfie)
ALTER TABLE "Reference" ADD COLUMN "personal" BOOLEAN NOT NULL DEFAULT false;
