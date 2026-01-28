# Render Deployment Guide for Petrotech Backend

This guide will help you deploy the Petrotech backend to Render.

## Prerequisites

1. A Render account (sign up at https://render.com)
2. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. A PostgreSQL database (Render PostgreSQL or external)
4. Stripe account (for payments)

## Step 1: Prepare Your Repository

Make sure your backend code is in a Git repository and pushed to GitHub/GitLab/Bitbucket.

## Step 2: Create a PostgreSQL Database on Render

1. Go to your Render Dashboard
2. Click **New +** → **PostgreSQL**
3. Configure:
   - **Name**: `petrotech-db` (or your preferred name)
   - **Database**: `petrotech` (or your preferred name)
   - **User**: Auto-generated
   - **Region**: Choose closest to your users
   - **PostgreSQL Version**: Latest stable
   - **Plan**: Free tier (for testing) or paid (for production)
4. Click **Create Database**
5. **Important**: Copy the **Internal Database URL** (you'll need this)

## Step 3: Create a Web Service on Render

1. Go to your Render Dashboard
2. Click **New +** → **Web Service**
3. Connect your repository:
   - Select your Git provider (GitHub/GitLab/Bitbucket)
   - Authorize Render to access your repositories
   - Select the repository containing your backend code
4. Configure the service:
   - **Name**: `petrotech-backend` (or your preferred name)
   - **Region**: Same as your database
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `backend` (since backend is in a subdirectory)
   - **Runtime**: `Node`
   - **Build Command**: `npm install --include=dev && npm run build && npx prisma migrate deploy`
   - **Start Command**: `npm start`
   - **Plan**: Free tier (for testing) or paid (for production)

## Step 4: Set Environment Variables

In your Render Web Service dashboard, go to **Environment** tab and add these variables:

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
# Use the Internal Database URL from your PostgreSQL service

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string
JWT_EXPIRES_IN=7d

# Node Environment
NODE_ENV=production
PORT=10000
# Render automatically sets PORT, but you can override if needed

# Stripe (Required for payments)
STRIPE_SECRET_KEY=sk_live_your_live_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Optional: Google Maps API (if you want to use Google Geocoding instead of OpenStreetMap)
# GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### How to Get Each Variable:

1. **DATABASE_URL**: 
   - From your PostgreSQL service dashboard → **Connections** tab
   - Use the **Internal Database URL** (for services in same region)
   - Or use **External Database URL** if needed

2. **JWT_SECRET**: 
   - Generate a random string (at least 32 characters)
   - You can use: `openssl rand -base64 32` or any random string generator

3. **STRIPE_SECRET_KEY**: 
   - From Stripe Dashboard → Developers → API keys
   - Use **Live** key for production (`sk_live_...`)
   - Use **Test** key for testing (`sk_test_...`)

4. **STRIPE_WEBHOOK_SECRET**: 
   - Set up webhook in Stripe Dashboard (see Step 5)
   - Copy the signing secret

## Step 5: Set Up Stripe Webhook for Production

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your Render webhook URL: `https://your-service-name.onrender.com/api/payments/webhook`
   - Replace `your-service-name` with your actual Render service name
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to your Render environment variables as `STRIPE_WEBHOOK_SECRET`

## Step 6: Run Database Migrations

After your first deployment, you need to run migrations:

### Option 1: Using Render Shell (Recommended)

1. Go to your Web Service dashboard
2. Click **Shell** tab
3. Run:
   ```bash
   npx prisma migrate deploy
   ```
4. This will apply all pending migrations

### Option 2: Add to Build Command

Your build command already includes `npx prisma migrate deploy`, so migrations should run automatically on each deployment.

## Step 7: Deploy

1. Click **Save Changes** in your Render service
2. Render will automatically:
   - Clone your repository
   - Install dependencies (`npm install`)
   - Build TypeScript (`npm run build`)
   - Generate Prisma Client (`npx prisma generate`)
   - Run migrations (`npx prisma migrate deploy`)
   - Start your server (`npm start`)

3. Wait for deployment to complete (usually 2-5 minutes)
4. Check the **Logs** tab for any errors

## Step 8: Verify Deployment

1. Check your service URL: `https://your-service-name.onrender.com`
2. Test the health endpoint: `https://your-service-name.onrender.com/health`
   - Should return: `{"status":"OK","message":"Petrotech API is running"}`
3. Test API endpoint: `https://your-service-name.onrender.com/api`
   - Should return API information

## Step 9: Update Frontend API URL

Update your frontend to use the Render backend URL:

1. In your frontend code, update the API base URL
2. Or set environment variable: `NEXT_PUBLIC_API_URL=https://your-service-name.onrender.com`

## Important Notes

### Database Migrations

- **First Deployment**: Run `npx prisma migrate deploy` manually via Shell
- **Subsequent Deployments**: Migrations run automatically via build command
- **Never use**: `prisma migrate dev` in production (use `migrate deploy`)

### Environment Variables

- **Never commit** `.env` files to Git
- All sensitive data should be in Render Environment Variables
- Use **Internal Database URL** for better performance (same region)

### Stripe Webhooks

- **Production URL**: `https://your-service-name.onrender.com/api/payments/webhook`
- **Test with Stripe CLI**: Use `stripe listen --forward-to https://your-service-name.onrender.com/api/payments/webhook`
- Make sure webhook secret matches in both Stripe Dashboard and Render

### Free Tier Limitations

- Services spin down after 15 minutes of inactivity
- First request after spin-down may take 30-60 seconds
- Consider upgrading to paid plan for production

### CORS Configuration

If your frontend is on a different domain, you may need to update CORS settings in `src/server.ts`:

```typescript
app.use(cors({
  origin: ['https://your-frontend-domain.com', 'http://localhost:3000'],
  credentials: true
}));
```

## Troubleshooting

### Build Fails

- Check **Logs** tab for error messages
- Verify all environment variables are set
- Ensure `DATABASE_URL` is correct
- Check that Prisma migrations are valid

### Database Connection Errors

- Verify `DATABASE_URL` uses correct format
- Check if database is in same region as web service
- Ensure database is not paused (free tier)

### Stripe Webhook Not Working

- Verify webhook URL is correct in Stripe Dashboard
- Check `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- View webhook logs in Stripe Dashboard
- Check Render logs for webhook errors

### Service Keeps Restarting

- Check **Logs** tab for error messages
- Verify all required environment variables are set
- Check database connection
- Ensure port is set correctly (Render uses PORT env var)

## Monitoring

- **Logs**: View real-time logs in Render Dashboard
- **Metrics**: Monitor CPU, Memory, and Request metrics
- **Alerts**: Set up email alerts for deployment failures

## Next Steps

1. Set up custom domain (optional)
2. Configure SSL (automatic with Render)
3. Set up monitoring and alerts
4. Configure auto-deploy from Git (enabled by default)
5. Set up staging environment (optional)

## Support

- Render Documentation: https://render.com/docs
- Render Support: https://render.com/support
- Check Render Status: https://status.render.com
