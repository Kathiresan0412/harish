# Harbor Auto Spa

A mobile-first car wash booking app with a MongoDB-backed public catalog, owner credentials authentication, editable branding, customer booking, availability management, and owner booking operations.

## Local setup

1. Install Node.js 20.9 or newer and MongoDB Atlas access.
2. Copy `.env.example` to `.env.local` and fill in `MONGODB_URI`, `AUTH_SECRET`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD`.
3. Use a long random `AUTH_SECRET` (for example, generate one with `openssl rand -base64 32`). The seed password must be at least 12 characters.
4. Install dependencies with `npm install`.
5. Create the owner and initial settings with `npm run seed`.
6. Start the app with `npm run dev`, then visit `http://localhost:3000` and `/admin/login`.

To enable service photo uploads, create a public Vercel Blob store and set its read/write token as `BLOB_READ_WRITE_TOKEN`. The catalog accepts JPG, PNG, and WebP images up to 4 MB. Without the token, service image URLs can still be entered manually.

Run the slot calculation unit tests with `npm test`. Owner availability settings live at `/admin/availability`; the public `GET /api/availability?date=YYYY-MM-DD&duration=60` endpoint returns only available start/end times. Public bookings start at `/book`; customers can look up bookings and request a change at `/lookup`. Owners can review and manage bookings at `/admin/bookings`, add walk-in or phone bookings, record cash/bank/card payments, and open WhatsApp reply templates. The dashboard shows booking and payment summaries.

Owners can also record operating costs at `/admin/expenses`, review customer booking/payment histories and private notes at `/admin/customers`, and view cash-basis monthly income-minus-expense reports at `/admin/reports`. The report CSV export is owner-authenticated. Reports include recorded payments (not unpaid booking totals) and expenses entered in the selected date range; they do not calculate tax, refunds, or owner drawings.

The seed is idempotent: it creates the owner only if the email is not present, and creates default settings only when they are missing. To rotate an existing owner's password, update that account through a separate secure maintenance operation; rerunning the seed will not replace it.

## MongoDB Atlas

Create a database user and an M0 replica-set cluster in Atlas, then copy its application connection string into `MONGODB_URI`. Booking creation uses MongoDB transactions, so a replica set or sharded cluster is required (Atlas M0 provides a replica set). Replace the username, password, and database name in the URI. For Vercel, allow network access from your deployment (Atlas supports `0.0.0.0/0` when you need broad serverless connectivity); use a strong database password and least-privilege database user.

## Deploy to Vercel

Import the repository into Vercel and configure the environment variables from `.env.example` in the Production, Preview, and Development environments as appropriate. Set `NEXT_PUBLIC_APP_URL` to the deployed origin and use a unique `AUTH_SECRET` plus the same Atlas connection string in each environment. Deploy, then run the seed command once against the intended database from a trusted environment. Add a custom domain in Vercel's project settings and point its DNS records to the values Vercel provides.

`vercel.json` schedules `/api/cron/reminders` daily at 03:00 UTC (08:30 in Sri Lanka). Set a high-entropy `CRON_SECRET` in Vercel. The route only sends reminders for confirmed bookings on the next local calendar day. To enable sending, configure `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`, and `WHATSAPP_REMINDER_TEMPLATE`; the template must be approved in WhatsApp Manager and have four body text parameters in this order: customer name, booking date, start time, and booking reference. `WHATSAPP_REMINDER_LANGUAGE` defaults to `en`. Keep these values server-side and verify the approved template and cron schedule in a staging environment before enabling production reminders. If the WhatsApp variables are absent, the endpoint returns a configuration error and sends nothing.

The app exposes `/sitemap.xml`, `/robots.txt`, and LocalBusiness JSON-LD on the home page. Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS origin so sitemap, robots, and metadata use the deployed domain. Booking, lookup, admin, and API routes are excluded from indexing.

Service management is available at `/admin/services`; the public catalog appears at `/services`. Service photo uploads use Vercel Blob when configured. The browser tab icon is bundled as an SVG; owner-uploaded logo and favicon management and remaining business settings are still outstanding. Branding currently accepts a hosted logo URL and stores theme settings in MongoDB.
