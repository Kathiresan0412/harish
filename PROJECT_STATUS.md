# Car Wash Booking — Project Status

This file tracks the requested scope against the code currently in this repository. Update the checkboxes as work is completed.

**Current stage:** Phase 6 implemented; lint, TypeScript check, production build, and slot tests pass. Staging checks with live MongoDB and WhatsApp credentials remain deployment tasks.

## Requested delivery plan

### Phase 1 — Setup, data models, owner access, branding

- [x] Next.js App Router, TypeScript, project configuration, and environment template
- [x] MongoDB connection cached for reuse in serverless environments
- [x] Mongoose schemas for users, services, categories, vehicle types, add-ons, bookings, customers, availability, blocked slots, payments, expenses, themes, business settings, and audit logs
- [x] Owner-only credentials sign-in with bcrypt password verification and Auth.js session protection
- [x] Idempotent seed for owner, initial theme and business settings, vehicle types, five sample services, and weekly hours
- [x] Theme defaults, CSS variables, color contrast helper, theme presets, and branding editor with live preview
- [x] Basic owner navigation: Dashboard, Bookings, Services, Availability, and Settings
- [ ] Hosted logo and favicon uploads (the editor currently accepts a hosted logo URL only; service photo upload is available)
- [x] Basic owner editor for phone and WhatsApp contact details
- [ ] Remaining business settings editor for address, currency, timezone, social links, and policies
- [x] Lint, TypeScript check, production build, and slot tests

### Phase 2 — Services and catalog

- [x] Owner UI and server mutations for services, vehicle types, and add-ons
- [x] Pricing and duration management by vehicle type
- [x] Public services page backed by saved catalog data
- [x] Mobile layouts for catalog management, service cards, and add-on prices
- [x] Service photo uploads via Vercel Blob (JPG, PNG, WebP; 4 MB max); hosted URLs are also accepted

### Phase 3 — Availability

- [x] Working-hours editor, slot interval, buffer, capacity, notice, advance-booking, pending hold, and timezone settings
- [x] Blocked dates and time ranges
- [x] Reusable slot generation and availability preview
- [x] Slot logic tests
- [x] Mobile layouts for hours, scheduling rules, blocked times, and preview

### Phase 4 — Public booking

- [x] Mobile booking flow: vehicle, services/add-ons, date/time, customer details, review
- [x] Server validation, IP rate limits, honeypot, and atomic availability check
- [x] Pending booking persistence with item snapshots, WhatsApp handoff, confirmation page, and calendar download
- [x] Booking lookup by reference and phone; cancellation/reschedule requests awaiting owner review
- [x] Responsive calendar disables closed and fully booked dates and displays only available times

### Phase 5 — Owner booking operations

- [x] Booking list and week calendar, filters, search, status changes, and manual bookings
- [x] WhatsApp reply templates for booking updates
- [x] Dashboard metrics for bookings, income, and popular services with monthly income and status charts
- [x] Review customer cancellation and reschedule requests from booking management
- [x] Record cash, bank, and card payments against bookings
- [x] Responsive layouts for booking operations, manual booking, calendar, and dashboard

### Phase 6 — Business operations and launch polish

- [x] Booking payments, operating expenses, customer records, cash-basis profit reports, and owner-authenticated CSV export
- [x] Dynamic business metadata, sitemap, robots policy, LocalBusiness structured data, keyboard focus/skip links, and responsive operations screens
- [x] Protected daily reminder endpoint with WhatsApp Cloud API approved-template integration structure
- [x] Deployment guide updates and local build/type/lint/slot-test checks
- [ ] HTTP smoke tests and end-to-end owner/customer flows in a running local or staging environment
- [ ] Staging checks using the deployment MongoDB replica set and configured WhatsApp test number/template

## Implemented in the current repository

- Public landing page with business identity, theme colors, mobile layout, and catalog services/add-ons pulled from MongoDB.
- Public catalog page at `/services` with service duration, photo URL or illustration, per-vehicle pricing, and optional add-on pricing.
- Owner login at `/admin/login` and protected dashboard at `/admin`.
- Branding editor at `/admin/settings/branding`; saves theme settings to MongoDB after owner authorization.
- Owner catalog manager at `/admin/services`; services and add-ons can be created, edited, re-ordered, deactivated, and archived. Vehicle types can be created, renamed, re-ordered, activated, and deactivated.
- Authenticated image upload route at `/api/uploads`; requires `BLOB_READ_WRITE_TOKEN` and validates file type and size.
- Availability settings at `/admin/availability`, plus public `GET /api/availability` returning only free slots.
- `lib/slots.ts` computes openings,duration fit, buffers, capacity, booking conflicts, pending expiry, blocked time ranges, notice, advance window, and business timezone.
- Booking flow at `/book` verifies prices and availability server-side, stores pending bookings with immutable item/price snapshots, and generates `CW-####` references.
- Owner WhatsApp contact is configured at `/admin/settings/business`; confirmation opens a prefilled `wa.me` message and the success page offers an `.ics` calendar file.
- Lookup and customer change requests are at `/lookup`; booking details require matching both reference and phone.
- Booking creation and blocked-time changes use MongoDB transactions and a shared availability write lock.
- Owner booking management is at `/admin/bookings`: list/week views, date/status/service/vehicle filters, customer/reference search, customer request review, status actions, rescheduling, payment recording, notes, and WhatsApp message templates.
- Walk-in and phone bookings can be added at `/admin/bookings/new`; service and price snapshots are saved after the selected slot is checked in the same availability transaction.
- The owner dashboard shows today's and upcoming bookings, pending requests, collected income, popular service, monthly income chart, booking status chart, and the next appointments.
- Customer records are created or refreshed when online and manual bookings are saved; `/admin/customers` shows booking/payment history, recorded vehicles, search, and private notes.
- Operating expenses can be added and deleted at `/admin/expenses`; `/admin/reports` summarizes payments received less recorded expenses by month and provides an authenticated CSV export at `/api/admin/reports/export`.
- Public metadata uses the saved business identity, `/sitemap.xml` lists public landing/catalog pages, `/robots.txt` excludes owner/API/lookup pages, and the homepage includes LocalBusiness structured data and a skip link.
- `/api/cron/reminders` is protected by `CRON_SECRET`, claims confirmed next-day bookings to avoid overlapping sends, and uses the configured WhatsApp Cloud API approved message template. Vercel runs it daily at 03:00 UTC when deployed.
- MongoDB models and seed data listed above, plus booking counters and TTL-based public rate-limit records.
- `.env.example` and setup/deployment notes in `README.md`.

## Not implemented yet

Live HTTP and staging verification remain outstanding; the local sandbox denied binding the app server port, and WhatsApp delivery also requires deployment credentials and an approved message template. Public opening hours are still static; owner-uploaded logo management and the remaining business settings are not implemented.

## Local setup reminder

Copy `.env.example` to `.env.local`, configure MongoDB and Auth.js values, install packages, run `npm run seed`, then run `npm run dev`. Do not commit environment files or real credentials.
