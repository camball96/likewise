// The email a new user gets when they sign up (sent from src/server/auth.ts).
// Plain HTML with inline styles, since email apps ignore stylesheets and web fonts; Georgia stands in for the site's serif.
// Replies go to CONTACT_EMAIL, so "just reply" reaches us.

const SITE = process.env.BETTER_AUTH_URL ?? "https://lkws.au";

const STEPS = [
  ["Say what you\u2019re shopping for", "Like \u201cWedding guest dresses\u201d or \u201cLinen pants\u201d, and pick a category."],
  ["Add a few pieces you love", "Paste a link from any store, Pinterest or Instagram, or upload a photo."],
  ["Heart what catches your eye", "Every heart sharpens your picks. Bookmark favourites into collections to share with friends."],
];

export function welcomeEmail(name: string) {
  const first = name.trim().split(/\s+/)[0] || "there";
  const subject = "Welcome to likewise";
  const text = [
    `Hi ${first},`,
    "",
    "Thanks for joining likewise. You're one of the first people trying it, so thank you.",
    "",
    "Here's how to get the most out of it:",
    ...STEPS.map(([title, body], i) => `${i + 1}. ${title}: ${body}`),
    "",
    `Open likewise: ${SITE}/welcome`,
    "",
    "Tip: on your phone, add likewise to your home screen so your picks are one tap away.",
    "",
    "It's still early, so if something looks off or there's a feature you'd love, just reply to this email.",
    "",
    "Cam",
    "likewise · lkws.au",
  ].join("\n");

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const serif = "Georgia, 'Times New Roman', serif";
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
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

  const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#f5efe6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5efe6"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
    <tr><td style="padding:0 4px 20px;font:600 30px ${serif};color:#2c211b">like<em style="color:#6e4a35">wise</em></td></tr>
    <tr><td style="background:#fffaf3;border:1px solid #e4d8c8;border-radius:20px;padding:32px 28px">
      <h1 style="margin:0 0 12px;font:600 30px/1.15 ${serif};color:#2c211b">Welcome, ${esc(first)}</h1>
      <p style="margin:0 0 24px;font:15px/1.6 ${sans};color:#5a4a3f">Thanks for joining likewise. You&rsquo;re one of the first people trying it, so thank you. Here&rsquo;s how to get the most out of it:</p>
      <table role="presentation" cellpadding="0" cellspacing="0">${steps}</table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:999px;background:#2c211b">
        <a href="${SITE}/welcome" style="display:inline-block;padding:13px 26px;font:600 15px ${sans};color:#f5efe6;text-decoration:none">Open likewise</a>
      </td></tr></table>
      <p style="margin:0 0 16px;font:14px/1.6 ${sans};color:#5a4a3f"><strong style="color:#2c211b">Tip:</strong> on your phone, add likewise to your home screen so your picks are one tap away.</p>
      <p style="margin:0;font:14px/1.6 ${sans};color:#5a4a3f">It&rsquo;s still early, so if something looks off or there&rsquo;s a feature you&rsquo;d love, just reply to this email.</p>
      <p style="margin:20px 0 0;font:italic 600 18px ${serif};color:#6e4a35">Cam</p>
    </td></tr>
    <tr><td style="padding:18px 4px 0;font:12px/1.5 ${sans};color:#8a7867">
      You&rsquo;re getting this because you created a likewise account. <a href="${SITE}" style="color:#6e4a35">lkws.au</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  return { subject, text, html };
}
