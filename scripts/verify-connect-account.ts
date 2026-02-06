/**
 * Verify that the Stripe Connect test account is accessible with STRIPE_SECRET_KEY.
 * Run from backend folder: npx tsx scripts/verify-connect-account.ts
 *
 * Usage: STRIPE_CONNECT_TEST_ACCOUNT_ID=acct_xxx npx tsx scripts/verify-connect-account.ts
 * Or ensure .env has STRIPE_SECRET_KEY and STRIPE_CONNECT_TEST_ACCOUNT_ID
 */
import 'dotenv/config';
import Stripe from 'stripe';

const accountId = process.env.STRIPE_CONNECT_TEST_ACCOUNT_ID?.trim();
const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.error('Missing STRIPE_SECRET_KEY in .env');
  process.exit(1);
}
if (!accountId || !accountId.startsWith('acct_')) {
  console.error('Missing or invalid STRIPE_CONNECT_TEST_ACCOUNT_ID in .env (must start with acct_)');
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: '2025-12-15.clover' });

async function main() {
  console.log('Checking connected account:', accountId);
  try {
    const account = await stripe.accounts.retrieve(accountId);
    if (account.deleted) {
      console.error('Account is deleted.');
      process.exit(1);
    }
    console.log('OK – Account is accessible.');
    console.log('  ID:', account.id);
    console.log('  Payouts enabled:', (account as any).payouts_enabled);
    console.log('  Details submitted:', (account as any).details_submitted);
  } catch (e: any) {
    console.error('FAIL – Account not accessible:', e?.message || e);
    process.exit(1);
  }
}

main();
