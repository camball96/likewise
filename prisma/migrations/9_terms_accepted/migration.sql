-- When each user agreed to the Terms of Use and Privacy Policy
ALTER TABLE "user" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
