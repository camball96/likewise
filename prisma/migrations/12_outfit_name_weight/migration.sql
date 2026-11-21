-- How much the outfit name counts in the feed (0 to 1): by how well it matches products in the chosen categories
ALTER TABLE "Outfit" ADD COLUMN "nameWeight" REAL;
