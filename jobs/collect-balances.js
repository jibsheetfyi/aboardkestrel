/*
 * Charges the outstanding 70% balance for charters departing within 7 days.
 *
 * Run daily as a Render cron job:  npm run collect-balances
 *
 * The card was saved at deposit time with setup_future_usage: 'off_session',
 * so this charge happens without the guest present. If the bank demands
 * authentication (authentication_required), we cannot complete it here — the
 * booking is flagged so a human can email the guest a payment link.
 */

const Stripe = require('stripe');
const db = require('../db');

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error('STRIPE_SECRET_KEY is not set. Nothing to do.');
  process.exit(1);
}
const stripe = new Stripe(stripeKey);

async function chargeBalance(booking) {
  const methods = await stripe.paymentMethods.list({
    customer: booking.customer_id,
    type: 'card',
    limit: 1,
  });
  const method = methods.data[0];
  if (!method) {
    console.error(`${booking.reference}: no saved card on file.`);
    db.markBalanceStatus(booking.reference, 'needs_action');
    return;
  }

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: booking.balance_cents,
        currency: 'usd',
        customer: booking.customer_id,
        payment_method: method.id,
        off_session: true,
        confirm: true,
        description: `Aboard Kestrel ${booking.reference} — balance`,
        metadata: { reference: booking.reference, kind: 'balance' },
      },
      // Guards against double-charging if this job runs twice in one day.
      { idempotencyKey: `balance-${booking.reference}` }
    );

    if (intent.status === 'succeeded') {
      db.markBalanceStatus(booking.reference, 'paid');
      console.log(`${booking.reference}: charged $${booking.balance_cents / 100}.`);
    } else {
      db.markBalanceStatus(booking.reference, 'needs_action');
      console.warn(`${booking.reference}: ended in status ${intent.status}.`);
    }
  } catch (err) {
    const code = err.code || (err.raw && err.raw.code);
    db.markBalanceStatus(booking.reference, 'needs_action');
    console.error(`${booking.reference}: ${code || err.message}`);
  }
}

async function main() {
  const due = db.bookingsWithBalanceDue();
  if (due.length === 0) {
    console.log('No balances due.');
    return;
  }
  console.log(`${due.length} balance(s) due.`);
  for (const booking of due) {
    await chargeBalance(booking);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
