/*
 * Aboard Kestrel — booking server.
 *
 * Serves the static site and handles Stripe Checkout for charter deposits.
 *
 * Money model: the guest pays a 30% deposit at booking. The card is saved
 * (setup_future_usage: 'off_session') so the 70% balance can be charged
 * automatically seven days before departure, without the guest present.
 */

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const Stripe = require('stripe');

const { priceBooking } = require('./catalog');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 10000;

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripe) {
  console.warn('STRIPE_SECRET_KEY is not set — checkout routes will return 503.');
}

function siteUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function reference() {
  const block = crypto.randomBytes(2).toString('hex').toUpperCase();
  const num = String(crypto.randomInt(1000, 10000));
  return `KES-${block}-${num}`;
}

/* ---------- webhook (must read the raw body, so it precedes express.json) ---------- */

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !webhookSecret) return res.status(503).send('Webhooks not configured.');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await db.markPaid({
        sessionId: session.id,
        customerId: typeof session.customer === 'string' ? session.customer : null,
        paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        email: session.customer_details && session.customer_details.email,
      });
      console.log(`Deposit paid for ${session.metadata && session.metadata.reference}`);
    }

    if (event.type === 'checkout.session.expired') {
      await db.markAbandoned(event.data.object.id);
    }
  } catch (err) {
    console.error('Webhook handling failed:', err);
    return res.status(500).send('Handler error');
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '32kb' }));

/* ---------- quote ---------- */

app.post('/api/quote', (req, res) => {
  try {
    const booking = priceBooking(req.body);
    res.json({ pricing: booking.pricing });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ---------- checkout ---------- */

app.post('/api/checkout', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Payments are not configured yet.' });

  let booking;
  try {
    booking = priceBooking(req.body);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const details = req.body.details || {};
  const email = String(details.email || '').trim();
  const name = String(details.name || '').trim().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const ref = reference();
  const { pricing, experience } = booking;
  const dateLabel = booking.end ? `${booking.start} → ${booking.end}` : booking.start;

  try {
    const customer = await stripe.customers.create({
      email,
      name: name || undefined,
      phone: String(details.phone || '').trim().slice(0, 40) || undefined,
      metadata: { reference: ref },
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customer.id,
      client_reference_id: ref,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: pricing.deposit * 100,
            product_data: {
              name: `${experience.name} — 30% deposit`,
              description: `${dateLabel} · ${booking.guests} guest${booking.guests > 1 ? 's' : ''} · charter total $${pricing.total.toLocaleString()}`,
            },
          },
        },
      ],
      payment_intent_data: {
        // Save the card so the balance can be charged later without the guest.
        setup_future_usage: 'off_session',
        description: `Aboard Kestrel ${ref} — ${experience.name} deposit`,
        metadata: { reference: ref, kind: 'deposit' },
      },
      // Guests should not be able to pay a deposit and then vanish; we need a
      // reachable address and a billing address for tax and chargeback defense.
      billing_address_collection: 'required',
      phone_number_collection: { enabled: true },
      custom_text: {
        submit: {
          message: `You are paying a 30% deposit of $${pricing.deposit.toLocaleString()}. The remaining $${pricing.balance.toLocaleString()} is charged to this card seven days before departure.`,
        },
      },
      metadata: {
        reference: ref,
        experience: experience.id,
        start: booking.start,
        end: booking.end || '',
        guests: String(booking.guests),
        addons: booking.addons.map((a) => a.id).join(',') || 'none',
        total_cents: String(pricing.total * 100),
        deposit_cents: String(pricing.deposit * 100),
        balance_cents: String(pricing.balance * 100),
      },
      success_url: `${siteUrl(req)}/book.html?status=confirmed&ref=${ref}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl(req)}/book.html?status=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    });

    try {
      await db.createBooking({
        reference: ref,
        sessionId: session.id,
        customerId: customer.id,
        experience: experience.id,
        start: booking.start,
        end: booking.end,
        guests: booking.guests,
        addons: booking.addons.map((a) => a.id).join(','),
        name,
        email,
        phone: String(details.phone || '').trim(),
        notes: String(details.notes || '').slice(0, 2000),
        occasion: String(details.occasion || '').slice(0, 80),
        totalCents: pricing.total * 100,
        depositCents: pricing.deposit * 100,
        balanceCents: pricing.balance * 100,
      });
    } catch (dbErr) {
      // A guest must never be able to pay for a booking we have no record of.
      console.error('Booking insert failed; expiring checkout session:', dbErr);
      await stripe.checkout.sessions.expire(session.id).catch(() => {});
      return res.status(500).json({ error: 'We could not save your booking. Nothing was charged — please try again.' });
    }

    res.json({ url: session.url, reference: ref });
  } catch (err) {
    console.error('Checkout creation failed:', err);
    res.status(502).json({ error: 'We could not reach the payment processor. Please try again.' });
  }
});

/* ---------- confirmation lookup ---------- */

app.get('/api/booking/:reference', async (req, res) => {
  let booking;
  try {
    booking = await db.getByReference(req.params.reference);
  } catch (err) {
    console.error('Booking lookup failed:', err);
    return res.status(500).json({ error: 'Lookup failed.' });
  }
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });

  const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v || null);

  res.json({
    reference: booking.reference,
    status: booking.status,
    experience: booking.experience,
    start: day(booking.start_date),
    end: day(booking.end_date),
    guests: booking.guests,
    addons: booking.addons ? booking.addons.split(',').filter(Boolean) : [],
    email: booking.email,
    total: booking.total_cents / 100,
    deposit: booking.deposit_cents / 100,
    balance: booking.balance_cents / 100,
  });
});

app.get('/api/health', async (req, res) => {
  let database = false;
  try {
    await db.pool.query('SELECT 1');
    database = true;
  } catch (err) {
    console.error('Health check: database unreachable:', err.message);
  }
  res.status(database ? 200 : 503).json({
    ok: database,
    stripe: Boolean(stripe),
    webhook: Boolean(webhookSecret),
    database,
  });
});

app.use(express.static(path.join(__dirname, 'aboardkestrel'), { extensions: ['html'] }));

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Aboard Kestrel listening on ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Could not prepare the database:', err);
    process.exit(1);
  });
