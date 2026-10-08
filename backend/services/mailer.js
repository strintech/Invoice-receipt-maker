const nodemailer = require('nodemailer');

// Defaults to Mailpit (docker compose service) for local development
const transport = nodemailer.createTransport(process.env.SMTP_URL || 'smtp://localhost:1025');
const FROM = process.env.MAIL_FROM || 'Invoice Maker <no-reply@invoice-maker.local>';

const copy = {
  subject: 'Confirm your email',
  heading: 'Confirm your email',
  body: 'Thanks for signing up. Confirm this is your email address to finish creating your account.',
  button: 'Confirm email',
  ignore: "If you didn't create an account, you can safely ignore this email."
};

const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const magicLinkEmail = ({ username, link, ttlMinutes }) => {
  const expiry = `This link expires in ${ttlMinutes} minutes and can only be used once.`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${copy.subject}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${copy.body}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:12px;overflow:hidden;font-family:${font};color:#111827;">
      <tr><td style="background:#1F2937;padding:20px 32px;font-size:18px;font-weight:700;color:#F97316;">Invoice Maker</td></tr>
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111827;">${copy.heading}</h1>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#374151;">Hi ${username},</p>
        <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#374151;">${copy.body}</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="border-radius:8px;background:#F97316;">
            <a href="${link}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">${copy.button}</a>
          </td>
        </tr></table>
        <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#6B7280;">${expiry}</p>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #E5E7EB;font-size:12px;line-height:1.6;color:#9CA3AF;">${copy.ignore}</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = `${copy.heading}\n\nHi ${username},\n\n${copy.body}\n\n${copy.button}: ${link}\n\n${expiry}\n\n${copy.ignore}\n`;

  return { subject: copy.subject, html, text };
};

const sendMagicLink = (to, details) => transport.sendMail({ from: FROM, to, ...magicLinkEmail(details) });

module.exports = { sendMagicLink, magicLinkEmail };
