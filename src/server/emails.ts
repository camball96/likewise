// The emails likewise sends to users (sent from src/server/auth.ts): welcome, confirm email, reset password.
// Plain HTML with inline styles, since email apps ignore stylesheets and web fonts; Georgia stands in for the site's serif.
// Replies go to CONTACT_EMAIL, so "just reply" reaches us.

const SITE = process.env.BETTER_AUTH_URL ?? "https://lkws.au";
const serif = "Georgia, 'Times New Roman', serif";
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

const p = (html: string, size = 15) => `<p style="margin:0 0 16px;font:${size}px/1.6 ${sans};color:#5a4a3f">${html}</p>`;
const button = (label: string, url: string) => `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:999px;background:#2c211b">
        <a href="${url}" style="display:inline-block;padding:13px 26px;font:600 15px ${sans};color:#f5efe6;text-decoration:none">${esc(label)}</a>
      </td></tr></table>`;

// The cream card with the wordmark above and a one-line footer below
function layout({ heading, body, footer }: { heading: string; body: string; footer: string }) {
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#f5efe6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5efe6"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
    <tr><td style="padding:0 4px 20px;font:600 30px ${serif};color:#2c211b">like<em style="color:#6e4a35">wise</em></td></tr>
    <tr><td style="background:#fffaf3;border:1px solid #e4d8c8;border-radius:20px;padding:32px 28px">
      <h1 style="margin:0 0 12px;font:600 30px/1.15 ${serif};color:#2c211b">${esc(heading)}</h1>
      ${body}
    </td></tr>
    <tr><td style="padding:18px 4px 0;font:12px/1.5 ${sans};color:#8a7867">${footer} <a href="${SITE}" style="color:#6e4a35">lkws.au</a></td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

const STEPS = [
  ["Say what you’re shopping for", "Like “Wedding guest dresses” or “Linen pants”, and pick a category."],
  ["Add a few pieces you love", "Paste a link from any store, Pinterest or Instagram, or upload a photo."],
  ["Heart what catches your eye", "Every heart sharpens your picks. Bookmark favourites into collections to share with friends."],
];

// Sent on sign-up. With verifyUrl (password sign-ups) the main button confirms their email address.
export function welcomeEmail(name: string, verifyUrl?: string) {
  const first = firstName(name);
  const text = [
    `Hi ${first},`,
    "",
    "Thanks for joining likewise. You're one of the first people trying it, so thank you.",
    "",
    "Here's how to get the most out of it:",
    ...STEPS.map(([title, body], i) => `${i + 1}. ${title}: ${body}`),
    "",
    ...(verifyUrl
      ? ["Please confirm your email address (it also lets you sign in with Google later):", verifyUrl]
      : [`Open likewise: ${SITE}/welcome`]),
    "",
    "Tip: on your phone, add likewise to your home screen so your picks are one tap away.",
    "",
    "It's still early, so if something looks off or there's a feature you'd love, just reply to this email.",
    "",
    "Cam",
    "likewise · lkws.au",
  ].join("\n");

  const steps = STEPS.map(
    ([title, body], i) => `
      <tr>
        <td valign="top" style="padding:0 14px 18px 0;width:28px">
          <div style="width:28px;height:28px;border-radius:14px;background:#ead9c6;color:#6e4a35;font:600 14px/28px ${sans};text-align:center">${i + 1}</div>
        </td>
        <td valign="top" style="padding:0 0 18px;font:15px/1.5 ${sans};color:#5a4a3f">
          <div style="font-weight:600;color:#2c211b">${esc(title)}</div>${esc(body)}
        </td>
      </tr>`,
  ).join("");

  const html = layout({
    heading: `Welcome, ${first}`,
    body: `${p("Thanks for joining likewise. You&rsquo;re one of the first people trying it, so thank you. Here&rsquo;s how to get the most out of it:")}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px">${steps}</table>
      ${button(verifyUrl ? "Confirm your email" : "Open likewise", verifyUrl ?? `${SITE}/welcome`)}${
        verifyUrl
          ? `<p style="margin:-12px 0 24px;font:13px/1.6 ${sans};color:#8a7867">Confirming lets you sign in with Google later too. You can keep using likewise in the meantime.</p>`
          : ""
      }
      ${p(`<strong style="color:#2c211b">Tip:</strong> on your phone, add likewise to your home screen so your picks are one tap away.`, 14)}
      ${p("It&rsquo;s still early, so if something looks off or there&rsquo;s a feature you&rsquo;d love, just reply to this email.", 14)}
      <p style="margin:20px 0 0;font:italic 600 18px ${serif};color:#6e4a35">Cam</p>`,
    footer: "You&rsquo;re getting this because you created a likewise account.",
  });

  return { subject: "Welcome to likewise", text, html };
}

// A short email with one button: confirming a (new) email address, or resetting a password
function actionEmail({ subject, name, lines, label, url, ignore }: { subject: string; name: string; lines: string[]; label: string; url: string; ignore: string }) {
  const first = firstName(name);
  const text = [`Hi ${first},`, "", ...lines, "", `${label}: ${url}`, "", ignore, "", "likewise · lkws.au"].join("\n");
  const html = layout({
    heading: subject,
    body: `${p(`Hi ${esc(first)},`)}${lines.map((l) => p(esc(l))).join("")}${button(label, url)}
      <p style="margin:0;font:13px/1.6 ${sans};color:#8a7867">${esc(ignore)}</p>`,
    footer: "You&rsquo;re getting this because of a request on your likewise account.",
  });
  return { subject, text, html };
}

export const confirmEmail = (name: string, url: string) =>
  actionEmail({
    subject: "Confirm your email",
    name,
    lines: ["Tap the button below to confirm this is your email address for likewise."],
    label: "Confirm your email",
    url,
    ignore: "If you didn't ask for this, you can ignore this email and nothing will change.",
  });

export const resetPasswordEmail = (name: string, url: string) =>
  actionEmail({
    subject: "Reset your password",
    name,
    lines: ["Someone (hopefully you) asked to reset the password for your likewise account. The link works for the next hour."],
    label: "Choose a new password",
    url,
    ignore: "If you didn't ask for this, you can ignore this email and your password stays the same.",
  });
