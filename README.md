# Aboard Kestrel

Charter booking site for S/Y Kestrel, a 78-foot Swan berthed in Basin D, Marina del Rey.

## What's here

```
server.js                  Express app — serves the site and the booking API
catalog.js                 Experiences, add-ons, and all pricing math (server-side)
db.js                      Postgres schema and queries
jobs/collect-balances.js   Daily job that charges the remaining balance
aboardkestrel/             The static front end (HTML, CSS, JS, images)
```

## How payment works

Guests pay a **30% deposit** at booking and the **70% balance** is charged
automatically **7 days before departure**.

1. The browser posts the selection to `POST /api/checkout`. It sends only ids
   and dates — never amounts. `catalog.js` recomputes every figure server-side,
   so a tampered client cannot change what a guest is charged.
2. The server creates a Stripe Customer and a Stripe-hosted Checkout Session for
   the deposit, with `setup_future_usage: 'off_session'` so the card is saved.
   Card details are entered on Stripe's page and never touch this server.
3. A pending booking row is written. If that write fails, the Checkout Session
   is expired immediately — a guest must never be able to pay for a booking we
   have no record of.
4. `POST /api/stripe/webhook` verifies the Stripe signature and flips the
   booking to `confirmed` on `checkout.session.completed`.
5. The guest lands back on `book.html?status=confirmed&ref=...`, which polls
   `GET /api/booking/:reference` until the webhook has landed.
6. `jobs/collect-balances.js` runs daily, finds confirmed bookings departing
   within 7 days, and charges the saved card off-session. It uses an
   idempotency key per booking, so running it twice cannot double-charge. If a
   bank demands authentication, the booking is marked `needs_action` for a
   human to follow up.

Amounts are stored in **cents** as integers. Never store money as a float.

## Environment variables

Required on **both** `aboardkestrel-app` and `aboardkestrel-balances`:

| Variable                | Notes                                                        |
| ----------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`          | Internal connection string for `aboardkestrel-db`            |
| `STRIPE_SECRET_KEY`     | `sk_test_...` while in sandbox                               |

Required on the web service only:

| Variable                | Notes                                                        |
| ----------------------- | ------------------------------------------------------------ |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from the webhook endpoint                        |
| `PUBLIC_URL`            | Canonical site URL, used to build Stripe return links        |

Set these in the Render dashboard. Never commit them, and never paste a secret
key into a chat window — if one is exposed, roll it in Stripe immediately.

## Render services

| Service                  | Type       | ID                          |
| ------------------------ | ---------- | --------------------------- |
| `aboardkestrel-app`      | Web        | `srv-dalfaquk1f9s73825n00`  |
| `aboardkestrel-balances` | Cron, 5pm UTC daily | `crn-dalfbm3m8hqs739d0p3g` |
| `aboardkestrel-db`       | Postgres 17 | `dpg-dalfaunf3r2c7392ndt0-a` |

The older static site (`srv-dalevee5vjqs73f5j2c0`) is superseded by the web
service and can be deleted once the domain is moved.

## Local development

```bash
npm install
export DATABASE_URL=postgres://localhost/kestrel
export STRIPE_SECRET_KEY=sk_test_...
npm start
```

Then forward webhooks with the Stripe CLI:

```bash
stripe listen --forward-to localhost:10000/api/stripe/webhook
```

`GET /api/health` reports whether Stripe, the webhook secret, and the database
are all wired up.

## Test cards

Sandbox only. `4242 4242 4242 4242` succeeds; `4000 0025 0000 3155` forces a
3DS challenge; `4000 0000 0000 9995` declines for insufficient funds. Any
future expiry and any CVC.
