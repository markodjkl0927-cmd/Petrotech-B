import nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';

let transporter: Transporter | null = null;

function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST?.trim() && process.env.SMTP_PASS?.trim());
}

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER || 'resend',
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transporter;
}

function getDefaultFrom(): string {
  return (
    process.env.SMTP_FROM?.trim() ||
    'R&P Global Energies <noreply@randpglobalenergies.com>'
  );
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const { to, subject, text, html } = options;

  if (!isSmtpConfigured()) {
    console.log('[R&P email] (SMTP not configured — console only)', { to, subject, body: text });
    return;
  }

  try {
    await getTransporter().sendMail({
      from: getDefaultFrom(),
      to,
      subject,
      text,
      html: html || undefined,
    });
    console.log('[R&P email] sent', { to, subject });
  } catch (error) {
    console.error('[R&P email] failed', { to, subject, error });
    throw error;
  }
}
