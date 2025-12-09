// src/lib/email.ts
import type { Env } from '../env'

interface SendEmailOptions {
  to: string
  subject: string
  text: string
  html: string
}

async function sendEmail(env: Env, options: SendEmailOptions): Promise<void> {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: options.to }] }],
      from: { email: env.SENDGRID_FROM_EMAIL },
      subject: options.subject,
      content: [
        { type: 'text/plain', value: options.text },
        { type: 'text/html', value: options.html },
      ],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to send email: ${error}`)
  }
}

export async function sendInvitationEmail(
  env: Env,
  to: string,
  inviterName: string,
  accountName: string,
  inviteUrl: string
): Promise<void> {
  const subject = `${inviterName} invited you to join "${accountName}"`

  const text = `
Hi,

${inviterName} has invited you to join "${accountName}".

Click the link below to accept the invitation:
${inviteUrl}

This invitation expires in 7 days.

If you didn't expect this invitation, you can ignore this email.
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { margin-top: 30px; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <p>Hi,</p>
    <p><strong>${inviterName}</strong> has invited you to join <strong>"${accountName}"</strong>.</p>
    <a href="${inviteUrl}" class="button">Accept Invitation</a>
    <p>Or copy this link: ${inviteUrl}</p>
    <p class="footer">This invitation expires in 7 days.<br>If you didn't expect this invitation, you can ignore this email.</p>
  </div>
</body>
</html>
`.trim()

  await sendEmail(env, { to, subject, text, html })
}
