/*
 * Booking storage.
 *
 * SQLite on a Render persistent disk. This is prototype-grade storage: it is
 * fine for a single-boat operation, but it is not a managed database and has
 * no replication. Stripe remains the authoritative record of money.
 */

const path = require('path');
const Database = require('better-sqlite3');

const file = process.env.DATABASE_PATH || path.join(__dirname, 'data.db');
const db = new Database(file);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    reference        TEXT PRIMARY KEY,
    session_id       TEXT UNIQUE,
    customer_id      TEXT,
    payment_intent   TEXT,
    status           TEXT NOT NULL DEFAULT 'pending',
    experience       TEXT NOT NULL,
    start_date       TEXT NOT NULL,
    end_date         TEXT,
    guests           INTEGER NOT NULL,
    addons           TEXT,
    name             TEXT,
    email            TEXT,
    phone            TEXT,
    notes            TEXT,
    occasion         TEXT,
    total_cents      INTEGER NOT NULL,
    deposit_cents    INTEGER NOT NULL,
    balance_cents    INTEGER NOT NULL,
    balance_status   TEXT NOT NULL DEFAULT 'unpaid',
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at          TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_bookings_start ON bookings (start_date);
  CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
`);

const insert = db.prepare(`
  INSERT INTO bookings (
    reference, session_id, customer_id, experience, start_date, end_date, guests,
    addons, name, email, phone, notes, occasion, total_cents, deposit_cents, balance_cents
  ) VALUES (
    @reference, @sessionId, @customerId, @experience, @start, @end, @guests,
    @addons, @name, @email, @phone, @notes, @occasion, @totalCents, @depositCents, @balanceCents
  )
`);

function createBooking(row) {
  insert.run(row);
}

const paid = db.prepare(`
  UPDATE bookings
     SET status = 'confirmed',
         payment_intent = COALESCE(@paymentIntentId, payment_intent),
         customer_id = COALESCE(@customerId, customer_id),
         email = COALESCE(NULLIF(@email, ''), email),
         paid_at = datetime('now')
   WHERE session_id = @sessionId
`);

function markPaid(args) {
  paid.run({
    sessionId: args.sessionId,
    customerId: args.customerId || null,
    paymentIntentId: args.paymentIntentId || null,
    email: args.email || '',
  });
}

const abandoned = db.prepare(
  `UPDATE bookings SET status = 'abandoned' WHERE session_id = ? AND status = 'pending'`
);

function markAbandoned(sessionId) {
  abandoned.run(sessionId);
}

const byRef = db.prepare(`SELECT * FROM bookings WHERE reference = ?`);

function getByReference(ref) {
  return byRef.get(ref);
}

/* Dates already taken by a confirmed booking, for the availability calendar. */
const confirmedRanges = db.prepare(
  `SELECT start_date, end_date FROM bookings WHERE status = 'confirmed' AND start_date >= date('now')`
);

function bookedRanges() {
  return confirmedRanges.all();
}

/* Confirmed bookings whose balance is due and not yet collected. */
const balanceDue = db.prepare(`
  SELECT * FROM bookings
   WHERE status = 'confirmed'
     AND balance_status = 'unpaid'
     AND balance_cents > 0
     AND date(start_date) <= date('now', '+7 days')
`);

function bookingsWithBalanceDue() {
  return balanceDue.all();
}

const setBalanceStatus = db.prepare(`UPDATE bookings SET balance_status = ? WHERE reference = ?`);

function markBalanceStatus(ref, status) {
  setBalanceStatus.run(status, ref);
}

module.exports = {
  db,
  createBooking,
  markPaid,
  markAbandoned,
  getByReference,
  bookedRanges,
  bookingsWithBalanceDue,
  markBalanceStatus,
};
