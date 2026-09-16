/*
 * Booking storage — Postgres.
 *
 * Render web services have ephemeral filesystems and cron jobs run in separate
 * containers, so a local SQLite file would both vanish on deploy and be
 * invisible to the balance-collection job. Postgres is shared and durable.
 *
 * Stripe remains the authoritative record of money; this table is our record
 * of what was booked.
 */

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set.');
}

const pool = new Pool({
  connectionString,
  // Render-managed Postgres presents a certificate the default trust store
  // does not recognize; the connection is still TLS-encrypted.
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 5,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      reference        TEXT PRIMARY KEY,
      session_id       TEXT UNIQUE,
      customer_id      TEXT,
      payment_intent   TEXT,
      status           TEXT NOT NULL DEFAULT 'pending',
      experience       TEXT NOT NULL,
      start_date       DATE NOT NULL,
      end_date         DATE,
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
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      paid_at          TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_bookings_start ON bookings (start_date);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);

    CREATE TABLE IF NOT EXISTS inquiries (
      id          BIGSERIAL PRIMARY KEY,
      subject     TEXT NOT NULL,
      occasion    TEXT,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL,
      phone       TEXT,
      preferred   DATE,
      guests      INTEGER,
      message     TEXT,
      production  TEXT,
      status      TEXT NOT NULL DEFAULT 'new',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries (status, created_at DESC);
  `);
}

async function createInquiry(q) {
  const { rows } = await pool.query(
    `INSERT INTO inquiries (subject, occasion, name, email, phone, preferred, guests, message, production)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [q.subject, q.occasion, q.name, q.email, q.phone, q.preferred, q.guests, q.message, q.production]
  );
  return rows[0].id;
}

async function listInquiries(limit = 100) {
  const { rows } = await pool.query(
    `SELECT * FROM inquiries ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

async function setInquiryStatus(id, status) {
  await pool.query(`UPDATE inquiries SET status = $2 WHERE id = $1`, [id, status]);
}

/* Owner dashboard: every booking, newest first. */
async function listBookings(limit = 200) {
  const { rows } = await pool.query(
    `SELECT * FROM bookings ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

/*
 * Headline numbers. Only confirmed bookings count as revenue — a pending row
 * is a checkout someone opened and may never finish, and counting those would
 * overstate the season.
 */
async function summary() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'confirmed')                                    AS confirmed,
      COUNT(*) FILTER (WHERE status = 'pending')                                      AS pending,
      COUNT(*) FILTER (WHERE status = 'confirmed' AND start_date >= CURRENT_DATE)     AS upcoming,
      COALESCE(SUM(total_cents)   FILTER (WHERE status = 'confirmed'), 0)             AS booked_cents,
      COALESCE(SUM(deposit_cents) FILTER (WHERE status = 'confirmed'), 0)             AS collected_cents,
      COALESCE(SUM(balance_cents) FILTER (WHERE status = 'confirmed'
                                            AND balance_status = 'unpaid'), 0)        AS outstanding_cents
    FROM bookings
  `);
  const { rows: inq } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status = 'new') AS new_inquiries FROM inquiries`
  );
  return { ...rows[0], ...inq[0] };
}

async function createBooking(b) {
  await pool.query(
    `INSERT INTO bookings (
       reference, session_id, customer_id, experience, start_date, end_date, guests,
       addons, name, email, phone, notes, occasion, total_cents, deposit_cents, balance_cents
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      b.reference, b.sessionId, b.customerId, b.experience, b.start, b.end, b.guests,
      b.addons, b.name, b.email, b.phone, b.notes, b.occasion,
      b.totalCents, b.depositCents, b.balanceCents,
    ]
  );
}

async function markPaid(a) {
  await pool.query(
    `UPDATE bookings
        SET status = 'confirmed',
            payment_intent = COALESCE($2, payment_intent),
            customer_id = COALESCE($3, customer_id),
            email = COALESCE(NULLIF($4, ''), email),
            paid_at = now()
      WHERE session_id = $1`,
    [a.sessionId, a.paymentIntentId || null, a.customerId || null, a.email || '']
  );
}

async function markAbandoned(sessionId) {
  await pool.query(
    `UPDATE bookings SET status = 'abandoned' WHERE session_id = $1 AND status = 'pending'`,
    [sessionId]
  );
}

async function getByReference(ref) {
  const { rows } = await pool.query(`SELECT * FROM bookings WHERE reference = $1`, [ref]);
  return rows[0] || null;
}

/* Confirmed bookings whose balance is due and not yet collected. */
async function bookingsWithBalanceDue() {
  const { rows } = await pool.query(
    `SELECT * FROM bookings
      WHERE status = 'confirmed'
        AND balance_status = 'unpaid'
        AND balance_cents > 0
        AND start_date <= (CURRENT_DATE + INTERVAL '7 days')`
  );
  return rows;
}

async function markBalanceStatus(ref, status) {
  await pool.query(`UPDATE bookings SET balance_status = $2 WHERE reference = $1`, [ref, status]);
}

/* Dates already held by a confirmed booking, for the availability calendar. */
async function bookedRanges() {
  const { rows } = await pool.query(
    `SELECT start_date, end_date FROM bookings
      WHERE status = 'confirmed' AND start_date >= CURRENT_DATE`
  );
  return rows;
}

module.exports = {
  pool,
  init,
  createBooking,
  markPaid,
  markAbandoned,
  getByReference,
  bookingsWithBalanceDue,
  markBalanceStatus,
  bookedRanges,
  createInquiry,
  listInquiries,
  setInquiryStatus,
  listBookings,
  summary,
};
