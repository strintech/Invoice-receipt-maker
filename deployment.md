# Deployment notes

Live setup, all on free tiers with no billing account:

| Part | Where | URL |
|------|-------|-----|
| Frontend (static) | Firebase Hosting, project `invoice-maker-ccc8f` (Spark plan) | https://invoice-maker-ccc8f.web.app |
| Backend (Docker) | Render free web service, auto-deploys `main` | https://invoice-receipt-maker.onrender.com |
| Postgres 18 | Neon free, project `weathered-salad-93944147` (aws-us-east-2) | — |

Firebase's free plan can't run server code (Cloud Run, Functions and App Hosting all need Blaze), so the API lives on Render and the frontend calls it cross-origin. That is why sign-in uses a bearer token (`frontend/src/api.js`) instead of a cookie: Safari blocks cross-site cookies.

## Deploying

- **Backend:** push to `main`; Render rebuilds the `Dockerfile`.
- **Frontend:** `firebase deploy --only hosting` (runs `npm run build` first). The API URL is baked in at build time from `frontend/.env.production` (`VITE_API_URL`).

## Render environment variables

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon connection string: `npx neonctl connection-string --project-id weathered-salad-93944147` |
| `APP_URL` | `https://invoice-maker-ccc8f.web.app` (emailed links point here) |
| `SKIP_EMAIL_VERIFICATION` | `true` for now: accounts are confirmed at sign-up and no email is sent. |

## Turning email verification back on

Render's free tier blocks outbound SMTP on ports 25, 465 and 587 (since Sept 2025), so Gmail SMTP won't work from there. Use a provider that accepts SMTP on another port, then set `SMTP_URL`, `MAIL_FROM` and remove `SKIP_EMAIL_VERIFICATION`:

- **Postmark:** `smtp://<server-token>:<server-token>@smtp.postmarkapp.com:2525`. 100 emails/month free.
- **Resend:** SMTP on port 2587 (STARTTLS) or 2465 (TLS). 3,000/month free, 100/day.
- Or send through a provider's HTTP API, which needs a small change in `backend/services/mailer.js`.

Add the provider's SPF, DKIM and DMARC records for the sending domain, or emails land in spam.

## Free tier limits

- **Render free:** 0.1 CPU and 512 MB. A PDF takes about 10s. The service sleeps after 15 minutes idle, and the first request after that takes about a minute. The disk is wiped on every restart, so uploaded images are stored in the database as data URLs.
- **Neon free:** 0.5 GB storage. The compute pauses when idle; the first query after that is a little slower.

## Known limitations

- **Data is shared between accounts.** Invoices, receipts, templates and clients aren't scoped per user or organization yet.
- **No failed-login lockout.** It was removed on request. Password guessing is only slowed by scrypt hashing.
- **Unconfirmed accounts block their email address** (only once email verification is back on). If someone registers with your email and never opens the link, the address shows as "already taken".
- **Uploaded images live in the template row.** Fine for logos, stamps and signatures. Move them to object storage if images get large or numerous.

## Sources

- [Render: free web services block outbound SMTP](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports)
- [Render free tier docs](https://render.com/docs/free)
