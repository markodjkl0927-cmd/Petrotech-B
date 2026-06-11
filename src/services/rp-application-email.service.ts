import { sendEmail } from './email.service';

type ApplicationType = 'career' | 'dealership';

function getPortalUrl(): string {
  return (process.env.RP_PORTAL_URL || process.env.FRONTEND_URL || 'https://randpglobalenergies.com').replace(
    /\/$/,
    ''
  );
}

const CAREER_STATUS_SUBJECTS: Record<string, string> = {
  UNDER_REVIEW: 'Your R&P career application is under review',
  INTERVIEW: 'You have been shortlisted for an interview',
  HIRED: 'Congratulations — you were selected for the role',
  REJECTED: 'Update on your R&P career application',
};

const DEALERSHIP_STATUS_SUBJECTS: Record<string, string> = {
  UNDER_REVIEW: 'Your R&P dealership application is under review',
  APPROVED: 'Your R&P dealership application was approved',
  REJECTED: 'Update on your R&P dealership application',
};

function statusMessage(type: ApplicationType, status: string, title: string): string[] {
  const normalized = status.toUpperCase();

  if (type === 'career') {
    if (normalized === 'UNDER_REVIEW') {
      return [
        `Our hiring team is now reviewing your application for ${title}.`,
        'We will email you again when there is a meaningful update.',
      ];
    }
    if (normalized === 'INTERVIEW') {
      return [
        `You have been shortlisted for ${title}.`,
        'Please watch your inbox for interview scheduling details from our team.',
      ];
    }
    if (normalized === 'HIRED') {
      return [
        `Congratulations — you were selected for ${title}.`,
        'A member of our team will contact you with next steps.',
      ];
    }
    if (normalized === 'REJECTED') {
      return [
        `Thank you for applying for ${title}.`,
        'After careful review, we will not be moving forward with your application at this time.',
      ];
    }
  }

  if (normalized === 'UNDER_REVIEW') {
    return [
      `Our partnerships team is now reviewing your dealership application for ${title}.`,
      'We will email you again when there is a meaningful update.',
    ];
  }
  if (normalized === 'APPROVED') {
    return [
      `Congratulations — your dealership application for ${title} was approved.`,
      'A member of our partnerships team will contact you with onboarding details.',
    ];
  }
  if (normalized === 'REJECTED') {
    return [
      `Thank you for your interest in partnering with R&P Global Energies for ${title}.`,
      'After careful review, we will not be moving forward with this application at this time.',
    ];
  }

  return ['Your application status has been updated.'];
}

async function sendMemberEmail(to: string, firstName: string, subject: string, lines: string[]) {
  const portalUrl = getPortalUrl();
  await sendEmail({
    to,
    subject,
    text: [
      `Hello ${firstName},`,
      '',
      ...lines,
      '',
      `Track all of your applications anytime: ${portalUrl}/applications`,
      '',
      'Thank you,',
      'R&P Global Energies',
      'noreply@randpglobalenergies.com',
    ].join('\n'),
  });
}

export async function sendMemberApplicationSubmittedEmail(params: {
  to: string;
  firstName: string;
  type: ApplicationType;
  title: string;
}) {
  const { to, firstName, type, title } = params;
  const label = type === 'career' ? 'career application' : 'dealership application';

  await sendMemberEmail(to, firstName, `Your R&P ${label} was received`, [
    `We received your ${label} for ${title}.`,
    'Our team will review it and email you when the status changes.',
    'You can also check progress anytime in the member portal.',
  ]);
}

export async function sendMemberApplicationStatusEmail(params: {
  to: string;
  firstName: string;
  type: ApplicationType;
  title: string;
  status: string;
  previousStatus: string;
}) {
  const { to, firstName, type, title, status, previousStatus } = params;
  const normalized = status.toUpperCase();
  const previous = previousStatus.toUpperCase();

  if (normalized === previous || normalized === 'NEW') {
    return;
  }

  const subjects = type === 'career' ? CAREER_STATUS_SUBJECTS : DEALERSHIP_STATUS_SUBJECTS;
  const subject = subjects[normalized];
  if (!subject) return;

  await sendMemberEmail(to, firstName, subject, statusMessage(type, normalized, title));
}
