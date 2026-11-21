import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { sendEmail } from "./email";
import { confirmEmail, resetPasswordEmail, welcomeEmail } from "./emails";

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
    : undefined;

const replyTo = process.env.CONTACT_EMAIL ?? "hello@lkws.au";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // "Forgot password?" (sign-in page) and "Set a password" (account page, for Google sign-ups)
    sendResetPassword: async ({ user, url }) => {
      void sendEmail({ ...resetPasswordEmail(user.name, url), to: user.email, replyTo });
    },
    revokeSessionsOnPasswordReset: true, // signs out every device, including anyone who knew the old password
    // using the emailed link proves they own the address, so it counts as confirmed
    onPasswordReset: async ({ user }) => {
      if (!user.emailVerified) await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    },
  },
  // Password sign-ups get a "Confirm your email" button in their welcome email. They can use likewise before
  // confirming; once confirmed, signing in with Google on the same email joins the same account
  // (Better Auth only links accounts whose email is confirmed, so nobody can claim someone else's address).
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    // a brand new account gets the welcome email (with the confirm button); a changed email or a resend gets a short one
    sendVerificationEmail: async ({ user, url }) => {
      const isNew = Date.now() - new Date(user.createdAt).getTime() < 10 * 60_000;
      void sendEmail({ ...(isNew ? welcomeEmail(user.name, url) : confirmEmail(user.name, url)), to: user.email, replyTo });
    },
  },
  socialProviders: google ? { google } : {},
  user: {
    // account page: an unconfirmed email changes straight away; a confirmed one changes once the new address is confirmed
    changeEmail: { enabled: true, updateEmailWithoutVerification: true },
    // when someone agreed to the Terms of Use and Privacy Policy: set by the server as the account is created
    // (sign-up requires ticking the box; Google sign-in shows the same agreement)
    additionalFields: { termsAcceptedAt: { type: "date", required: false, input: false, returned: false } },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({ data: { ...user, termsAcceptedAt: new Date() } }),
        // not awaited: emails never slow or break a sign-up
        after: async (user) => {
          void notifyNewUser(user);
          // Google sign-ups are already confirmed; password sign-ups get theirs from sendVerificationEmail above
          if (user.emailVerified) void sendEmail({ ...welcomeEmail(user.name), to: user.email, replyTo });
        },
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
