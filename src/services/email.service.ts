/**
 * Email helper. Logs to console until SMTP is configured.
 * Set RP_SMTP_* or SMTP_* env vars when ready for production mail.
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const { to, subject, text } = options;
  console.log('[R&P email]', { to, subject, body: text });
}
