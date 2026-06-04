import { prisma } from './prisma';

/** Generate a unique 10-digit account number (no leading zero). */
export async function generateUniqueAccountNumber(): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const num = String(Math.floor(1_000_000_000 + Math.random() * 9_000_000_000));
    const existing = await prisma.rpMember.findUnique({
      where: { accountNumber: num },
      select: { id: true },
    });
    if (!existing) return num;
  }
  throw new Error('Unable to generate a unique account number. Please try again.');
}

export function formatAccountNumberDisplay(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, '');
  if (digits.length !== 10) return accountNumber;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}
