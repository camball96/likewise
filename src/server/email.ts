// Sends an email via Resend (resend.com): to us (CONTACT_EMAIL) unless `to` is given. Does nothing until
// RESEND_API_KEY is set, and never throws, so a failed email never fails the form or sign-up that sent it.
type Email = { subject: string; text: string; html?: string; to?: string; replyTo?: string };

export async function sendEmail({ subject, text, html, to, replyTo }: Email) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "likewise <hello@lkws.au>", // an address people can reply to: "no-reply" senders land in spam more
        to: to ?? process.env.CONTACT_EMAIL ?? "hello@lkws.au",
        subject,
        text,
        html,
        reply_to: replyTo,
      }),
    });
    if (!res.ok) console.error(`Resend: ${res.status} ${await res.text()}`);
  } catch (e) {
    console.error(e);
  }
}
