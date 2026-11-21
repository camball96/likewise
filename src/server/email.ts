// Emails us via Resend (resend.com). Does nothing until RESEND_API_KEY is set, and never throws:
// the message is already saved in the database, so a failed email shouldn't fail the form.
export async function sendEmail({ subject, text, replyTo }: { subject: string; text: string; replyTo?: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "likewise <noreply@lkws.au>",
        to: process.env.CONTACT_EMAIL ?? "hello@lkws.au",
        subject,
        text,
        reply_to: replyTo,
      }),
    });
    if (!res.ok) console.error(`Resend: ${res.status} ${await res.text()}`);
  } catch (e) {
    console.error(e);
  }
}
