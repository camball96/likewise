-- Text fingerprint of what the user is shopping for (the outfit name), so results work before any inspiration is added
ALTER TABLE "Outfit" ADD COLUMN "nameEmbedding" vector(768);
