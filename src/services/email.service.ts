import nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';

let transporter: Transporter | null = null;

function getResendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY?.trim() || process.env.SMTP_PASS?.trim();
}

function isResendApiConfigured(): boolean {
  return !!getResendApiKey();
}

function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST?.trim() && getResendApiKey());
}

export function getEmailTransport(): 'resend-api' | 'smtp' | 'none' {
  if (isResendApiConfigured()) return 'resend-api';
  if (isSmtpConfigured()) return 'smtp';
  return 'none';
}

function getDefaultFrom(): string {
  return (
    process.env.SMTP_FROM?.trim() ||
    'R&P Global Energies <noreply@randpglobalenergies.com>'
  );
}

async function sendViaResendApi(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error('Resend API key is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getDefaultFrom(),
      to: [options.to],
      subject: options.subject,
      text: options.text,
      html: options.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API ${response.status}: ${body}`);
  }
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
        pass: getResendApiKey(),
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transporter;
}

async function sendViaSmtp(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  await getTransporter().sendMail({
    from: getDefaultFrom(),
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html || undefined,
  });
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const { to, subject, text, html } = options;
  const transport = getEmailTransport();

  if (transport === 'none') {
    console.log('[R&P email] (not configured — console only)', { to, subject, body: text });
    return;
  }

  try {
    if (transport === 'resend-api') {
      await sendViaResendApi(options);
      console.log('[R&P email] sent via Resend API', { to, subject });
      return;
    }

    await sendViaSmtp(options);
    console.log('[R&P email] sent via SMTP', { to, subject });
  } catch (error) {
    console.error('[R&P email] failed', { to, subject, transport, error });
    throw error;
  }
}
