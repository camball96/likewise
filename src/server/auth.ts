import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
    : undefined;

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  socialProviders: google ? { google } : {},
  // when someone agreed to the Terms of Use and Privacy Policy: set by the server as the account is created
  // (sign-up requires ticking the box; Google sign-in shows the same agreement)
  user: { additionalFields: { termsAcceptedAt: { type: "date", required: false, input: false, returned: false } } },
  databaseHooks: {
    user: { create: { before: async (user) => ({ data: { ...user, termsAcceptedAt: new Date() } }) } },
  },
});
