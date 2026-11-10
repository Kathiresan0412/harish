# Harbor Auto Spa

A mobile-first booking site foundation for a small, owner-operated car wash. Phase 1 includes the public landing page, MongoDB models and connection caching, owner credentials authentication, and editable branding/theme settings.

## Local setup

1. Install Node.js 20.9 or newer and MongoDB Atlas access.
2. Copy `.env.example` to `.env.local` and fill in `MONGODB_URI`, `AUTH_SECRET`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD`.
3. Use a long random `AUTH_SECRET` (for example, generate one with `openssl rand -base64 32`). The seed password must be at least 12 characters.
4. Install dependencies with `npm install`.
5. Create the owner and initial settings with `npm run seed`.
6. Start the app with `npm run dev`, then visit `http://localhost:3000` and `/admin/login`.

The seed is idempotent: it creates the owner only if the email is not present, and creates default settings only when they are missing. To rotate an existing owner's password, update that account through a separate secure maintenance operation; rerunning the seed will not replace it.

## MongoDB Atlas

Create a database user and an M0 cluster in Atlas, then copy its application connection string into `MONGODB_URI`. Replace the username, password, and database name in the URI. For Vercel, allow network access from your deployment (Atlas supports `0.0.0.0/0` when you need broad serverless connectivity); use a strong database password and least-privilege database user.

## Deploy to Vercel

Import the repository into Vercel and configure the environment variables from `.env.example` in the Production, Preview, and Development environments as appropriate. Set `NEXT_PUBLIC_APP_URL` to the deployed origin and use a unique `AUTH_SECRET` plus the same Atlas connection string in each environment. Deploy, then run the seed command once against the intended database from a trusted environment. Add a custom domain in Vercel's project settings and point its DNS records to the values Vercel provides.

Logo and photo uploads, service management, availability, and booking flows are planned for later phases. Phase 1 accepts a hosted logo URL and stores theme settings in MongoDB.
