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

const { priceBooking, PROPOSALS } = require('./catalog');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 10000;

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const adminToken = process.env.ADMIN_TOKEN;

/*
 * Live vs test is derived from the key itself rather than a separate flag, so
 * the two can never disagree. The site shows a test-mode notice whenever this
 * is false, which is what keeps a real guest from paying into a sandbox.
 */
const liveMode = Boolean(stripeKey && stripeKey.startsWith('sk_live_'));

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

/* ---------- public config ---------- */

app.get('/api/config', (req, res) => {
  res.json({ liveMode, payments: Boolean(stripe) });
});

/* ---------- inquiry (proposal-only experiences) ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/inquiry', async (req, res) => {
  const b = req.body || {};
  const subject = String(b.subject || '').trim();
  if (!PROPOSALS[subject] && subject !== 'general') {
    return res.status(400).json({ error: 'Unknown inquiry subject.' });
  }

  const name = String(b.name || '').trim().slice(0, 120);
  const email = String(b.email || '').trim().slice(0, 200);
  if (!name) return res.status(400).json({ error: 'Please tell us your name.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email address is required.' });

  const guests = Number(b.guests);
  const preferred = /^\d{4}-\d{2}-\d{2}$/.test(String(b.preferred || '')) ? b.preferred : null;

  try {
    const id = await db.createInquiry({
      subject,
      occasion: String(b.occasion || '').slice(0, 80) || null,
      name,
      email,
      phone: String(b.phone || '').trim().slice(0, 40) || null,
      preferred,
      guests: Number.isInteger(guests) && guests > 0 && guests < 200 ? guests : null,
      message: String(b.message || '').slice(0, 4000) || null,
      production: String(b.production || '').slice(0, 2000) || null,
    });
    res.json({ ok: true, id });
  } catch (err) {
    console.error('Inquiry insert failed:', err);
    res.status(500).json({ error: 'We could not save your request. Please email the crew directly.' });
  }
});

/* ---------- owner tools ---------- */

/*
 * Timing-safe compare so the token cannot be recovered a character at a time
 * by measuring how long a wrong guess takes to reject.
 */
function tokenOk(supplied) {
  if (!adminToken || !supplied) return false;
  const a = Buffer.from(String(supplied));
  const b = Buffer.from(adminToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireOwner(req, res, next) {
  if (!adminToken) return res.status(503).json({ error: 'Owner tools are not configured.' });
  const header = req.get('authorization') || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : req.get('x-admin-token');
  if (!tokenOk(supplied)) return res.status(401).json({ error: 'Not authorized.' });
  next();
}

const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v || null);

app.get('/api/admin/overview', requireOwner, async (req, res) => {
  try {
    const [totals, bookings, inquiries, due] = await Promise.all([
      db.summary(),
      db.listBookings(200),
      db.listInquiries(100),
      db.bookingsWithBalanceDue(),
    ]);

    res.json({
      liveMode,
      totals: {
        confirmed: Number(totals.confirmed),
        pending: Number(totals.pending),
        upcoming: Number(totals.upcoming),
        newInquiries: Number(totals.new_inquiries),
        booked: Number(totals.booked_cents) / 100,
        collected: Number(totals.collected_cents) / 100,
        outstanding: Number(totals.outstanding_cents) / 100,
      },
      balancesDue: due.map((b) => ({
        reference: b.reference,
        start: day(b.start_date),
        amount: b.balance_cents / 100,
        name: b.name,
      })),
      bookings: bookings.map((b) => ({
        reference: b.reference,
        status: b.status,
        experience: b.experience,
        start: day(b.start_date),
        end: day(b.end_date),
        guests: b.guests,
        addons: b.addons ? b.addons.split(',').filter(Boolean) : [],
        name: b.name,
        email: b.email,
        phone: b.phone,
        occasion: b.occasion,
        notes: b.notes,
        total: b.total_cents / 100,
        deposit: b.deposit_cents / 100,
        balance: b.balance_cents / 100,
        balanceStatus: b.balance_status,
        createdAt: b.created_at,
        paidAt: b.paid_at,
      })),
      inquiries: inquiries.map((q) => ({
        id: Number(q.id),
        subject: q.subject,
        occasion: q.occasion,
        status: q.status,
        name: q.name,
        email: q.email,
        phone: q.phone,
        preferred: day(q.preferred),
        guests: q.guests,
        message: q.message,
        production: q.production,
        createdAt: q.created_at,
      })),
    });
  } catch (err) {
    console.error('Admin overview failed:', err);
    res.status(500).json({ error: 'Could not load the dashboard.' });
  }
});

app.post('/api/admin/inquiry/:id/status', requireOwner, async (req, res) => {
  const status = String((req.body || {}).status || '');
  if (!['new', 'quoted', 'won', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Unknown status.' });
  }
  try {
    await db.setInquiryStatus(Number(req.params.id), status);
    res.json({ ok: true });
  } catch (err) {
    console.error('Inquiry status update failed:', err);
    res.status(500).json({ error: 'Update failed.' });
  }
});

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
      // Managed Payments is on by default for this account, but it takes over
      // payment configuration and is incompatible with custom_text and with
      // saving a card for a later off-session charge — both of which the
      // deposit/balance model depends on.
      managed_payments: { enabled: false },
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
  const checks = { stripe: false, webhook: Boolean(webhookSecret), database: false };
  const problems = [];

  try {
    await db.pool.query('SELECT 1');
    checks.database = true;
  } catch (err) {
    problems.push(`database: ${err.message}`);
  }

  // Presence of a key proves nothing — a key ID or a stale key looks identical
  // until Stripe rejects it. Make a real (free, read-only) call instead.
  if (!stripe) {
    problems.push('stripe: STRIPE_SECRET_KEY is not set');
  } else {
    try {
      await stripe.balance.retrieve();
      checks.stripe = true;
    } catch (err) {
      problems.push(`stripe: ${err.message}`);
    }
  }

  if (!checks.webhook) problems.push('webhook: STRIPE_WEBHOOK_SECRET is not set');

  const ok = checks.stripe && checks.database && checks.webhook;
  res.status(ok ? 200 : 503).json({ ok, mode: liveMode ? 'live' : 'test', ownerTools: Boolean(adminToken), ...checks, problems });
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
