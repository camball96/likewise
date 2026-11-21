import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { sendEmail } from "./email";

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
    user: {
      create: {
        before: async (user) => ({ data: { ...user, termsAcceptedAt: new Date() } }),
        after: async (user) => void notifyNewUser(user), // not awaited: never slows or breaks a sign-up
      },
    },
  },
});

// Emails us (CONTACT_EMAIL, via Resend) when someone signs up. The subject always starts with
// "New sign-up" so a mail filter can label it and keep it out of the inbox.
async function notifyNewUser(user: { name: string; email: string; createdAt: Date }) {
  const total = await db.user.count().catch(() => null);
  const when = new Date(user.createdAt).toLocaleString("en-AU", { timeZone: "Australia/Brisbane", dateStyle: "medium", timeStyle: "short" });
  await sendEmail({
    subject: `New sign-up: ${user.name || user.email}`,
    text: `${user.name || "(no name)"}\n${user.email}\nSigned up ${when}${total ? `\n\nThat's ${total} ${total === 1 ? "person" : "people"} on likewise.` : ""}`,
  });
}
