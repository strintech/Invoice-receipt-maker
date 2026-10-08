# Deployment notes

Planned setup: frontend on Cloudflare, backend and Postgres on a DigitalOcean Droplet.

## Environment variables

Set these in `.env` next to `docker-compose.yml` on the server:

| Variable | Value |
|----------|-------|
| `APP_URL` | Public frontend URL, e.g. `https://app.example.com`. Email confirmation links point here, so it must be the real public URL. |
| `SMTP_URL` | SMTP connection of your mail provider (see below). URL-encode special characters in the username/password. |
| `MAIL_FROM` | Sender, e.g. `Invoice Maker <no-reply@example.com>`. The domain must be verified with the mail provider. |
| `POSTGRES_PASSWORD` | Database password (defaults to `invoices`, so change it). |

Then remove the `mailpit` service from `docker-compose.yml` (it's only a test inbox) and run:

```bash
docker compose up -d --build
```

## Sending email from DigitalOcean

DigitalOcean blocks outbound SMTP ports **25, 465 and 587** on Droplets and generally won't unblock them for new accounts. The mail provider has to accept SMTP on another port (usually 2525) or be used through its HTTP API.

## Which mail provider

1. **Postmark (recommended).** Built for transactional mail like sign-in links and known for fast delivery. It accepts SMTP on port 2525, so it works from DigitalOcean with only a settings change:
   ```
   SMTP_URL=smtp://<server-api-token>:<server-api-token>@smtp.postmarkapp.com:2525
   ```
   (The Server API token is both the username and the password.) About $15/month for 10,000 emails, 100/month free for testing.
2. **Resend.** 3,000 emails/month free (max 100/day), then $20/month for 50,000. Not confirmed whether its SMTP accepts a port DigitalOcean doesn't block. If not, use its HTTP API, which needs a small change in `backend/services/mailer.js`.
3. **Amazon SES.** Cheapest at high volume ($0.10 per 1,000 emails), but more setup: you have to request to leave its sandbox mode before sending to real users.
4. **Cloudflare Email Service.** Not a fit yet. Still in beta, needs the Workers Paid plan, and sends from Cloudflare Workers, while the backend lives on DigitalOcean.

## DNS (Cloudflare)

Add the provider's **SPF**, **DKIM** and **DMARC** records for the sending domain, or sign-in emails will land in spam.

## Cloudflare in front of the backend

- **Serve `/api` from the same domain as the frontend** (Cloudflare proxies `/api/*` to the Droplet). The frontend calls relative `/api` URLs and the login cookie is `SameSite=Lax`, so this works without code changes. A separate API origin (e.g. `api.example.com`) would need CORS with credentials and `credentials: 'include'` on every fetch.
- **Enable `trust proxy`** in `backend/index.js` (`app.set('trust proxy', 1)`, one per proxy hop). Without it, `req.secure` is false, so the session cookie isn't marked HTTPS-only. And `req.ip` is Cloudflare's address, so one person's failed logins lock everyone out.
- **Firewall the Droplet to Cloudflare's IP ranges.** With `trust proxy` on, a request sent straight to the Droplet could fake its IP in `X-Forwarded-For` and dodge the login lockout.

## Known limitations

- **Unconfirmed accounts block their email address.** If someone registers with your email and never opens the confirmation link, the address shows as "already taken". Cleaning up unconfirmed accounts would fix this.
- **The failed-login lockout lives in memory.** It resets when the server restarts and isn't shared between instances. Move it to the database if the backend ever runs as more than one instance.
- **Data is shared between accounts.** Invoices, receipts, templates and clients aren't scoped per user or organization yet.

## Sources

- [DigitalOcean: Why is SMTP blocked?](https://docs.digitalocean.com/support/why-is-smtp-blocked/)
- [Resend vs Amazon SES vs Postmark (2026)](https://www.buildmvpfast.com/blog/resend-vs-ses-vs-postmark-transactional-email-deliverability-saas-2026)
- [Email service pricing at 1K, 10K, 100K](https://blog.vibecoder.me/email-service-pricing-resend-sendgrid-postmark)
- [Cloudflare Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/)
- [SMTP ports explained (2525)](https://www.captaindns.com/it/blog/smtp-ports-explained)
