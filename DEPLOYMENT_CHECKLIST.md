# Quick Deployment Checklist for Render

## Pre-Deployment Checklist

- [ ] Code is pushed to Git repository (GitHub/GitLab/Bitbucket)
- [ ] All environment variables are documented
- [ ] Database migrations are ready
- [ ] Stripe account is set up
- [ ] Stripe webhook endpoint is configured

## Step-by-Step Deployment

### 1. Create PostgreSQL Database on Render
- [ ] Go to Render Dashboard → New + → PostgreSQL
- [ ] Name: `petrotech-db`
- [ ] Copy **Internal Database URL**

### 2. Create Web Service on Render
- [ ] Go to Render Dashboard → New + → Web Service
- [ ] Connect your Git repository
- [ ] Configure:
  - **Root Directory**: `backend`
  - **Build Command**: `npm install --include=dev && npm run build && npx prisma migrate deploy`
  - **Start Command**: `npm start`

### 3. Set Environment Variables
Add these in Render Dashboard → Environment tab:

- [ ] `DATABASE_URL` = (from PostgreSQL service)
- [ ] `JWT_SECRET` = (generate random 32+ character string)
- [ ] `JWT_EXPIRES_IN` = `7d`
- [ ] `NODE_ENV` = `production`
- [ ] `STRIPE_SECRET_KEY` = (from Stripe Dashboard)
- [ ] `STRIPE_WEBHOOK_SECRET` = (from Stripe Webhook setup)

### 4. Set Up Stripe Webhook
- [ ] Go to Stripe Dashboard → Webhooks
- [ ] Add endpoint: `https://your-service.onrender.com/api/payments/webhook`
- [ ] Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
- [ ] Copy signing secret to `STRIPE_WEBHOOK_SECRET`

### 5. Deploy
- [ ] Click "Save Changes" in Render
- [ ] Wait for deployment (2-5 minutes)
- [ ] Check logs for errors

### 6. Verify
- [ ] Test: `https://your-service.onrender.com/health`
- [ ] Test: `https://your-service.onrender.com/api`
- [ ] Check database migrations ran successfully

### 7. Update Frontend
- [ ] Set `NEXT_PUBLIC_API_URL` in frontend to your Render URL
- [ ] Update frontend environment variables
- [ ] Test frontend connection to backend

## Environment Variables Summary

```env
# Required
DATABASE_URL=postgresql://...
JWT_SECRET=your-random-secret-key
NODE_ENV=production
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional
JWT_EXPIRES_IN=7d
PORT=10000
GOOGLE_MAPS_API_KEY=... (if using Google Geocoding)
```

## Common Issues

- **Build fails**: Check logs, verify environment variables
- **Database connection error**: Verify DATABASE_URL format
- **Webhook not working**: Check webhook URL and secret
- **Service restarting**: Check logs for errors

## After Deployment

- [ ] Test user registration
- [ ] Test user login
- [ ] Test order creation
- [ ] Test payment flow
- [ ] Test webhook (create test payment in Stripe Dashboard)
- [ ] Monitor logs for errors
- [ ] Set up alerts in Render
