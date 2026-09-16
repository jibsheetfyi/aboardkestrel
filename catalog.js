/*
 * Server-side source of truth for pricing.
 *
 * The browser sends only an experience id, dates, guest count, and add-on ids.
 * Every dollar amount is recomputed here so a tampered client cannot change
 * what a guest is charged. Keep this in sync with aboardkestrel/shared.js —
 * the client copy exists only to render the summary.
 */

const EXPERIENCES = {
  dockside: { id: 'dockside', kind: 'nightly', name: 'Night Aboard', price: 895, unit: 'night', minUnits: 2, maxGuests: 8 },
  halfday: { id: 'halfday', kind: 'session', name: 'Half-Day Sail', price: 2400, unit: 'charter', minUnits: 1, maxGuests: 12 },
  fullday: { id: 'fullday', kind: 'session', name: 'Full-Day Sail', price: 3800, unit: 'charter', minUnits: 1, maxGuests: 12 },
  catalina: { id: 'catalina', kind: 'voyage', name: 'Catalina Passage', price: 7500, unit: 'voyage', minUnits: 1, maxGuests: 8 },
};

const ADDONS = {
  provision: { id: 'provision', name: 'Provisioning package', price: 285 },
  chef: { id: 'chef', name: 'Chef dinner aboard', price: 650 },
  photo: { id: 'photo', name: 'Photographer on board', price: 750 },
  sunset: { id: 'sunset', name: 'Sunset extension', price: 480 },
};

const SERVICE_RATE = 0.12;
const TAX_RATE = 0.0925;
const DEPOSIT_RATE = 0.3;

const DAY_MS = 86400000;

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nights(start, end) {
  return Math.max(1, Math.round((end - start) / DAY_MS));
}

/**
 * Validates a booking request and returns normalized booking + pricing.
 * Throws an Error with a guest-readable message on bad input.
 */
function priceBooking(input) {
  const exp = EXPERIENCES[input && input.experience];
  if (!exp) throw new Error('Unknown experience.');

  const start = parseDate(input.start);
  if (!start) throw new Error('A valid start date is required.');

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (start < todayUtc) throw new Error('Start date cannot be in the past.');

  let end = null;
  let units = 1;
  if (exp.kind === 'nightly') {
    end = parseDate(input.end);
    if (!end) throw new Error('A valid check-out date is required.');
    if (end <= start) throw new Error('Check-out must be after check-in.');
    units = nights(start, end);
    if (units < exp.minUnits) throw new Error(`${exp.name} has a ${exp.minUnits}-night minimum.`);
    if (units > 30) throw new Error('Please contact the crew directly for stays over 30 nights.');
  }

  const guests = Number(input.guests);
  if (!Number.isInteger(guests) || guests < 1 || guests > exp.maxGuests) {
    throw new Error(`Guest count must be between 1 and ${exp.maxGuests} for ${exp.name}.`);
  }

  const requested = Array.isArray(input.addons) ? input.addons : [];
  const seen = new Set();
  const addons = [];
  for (const id of requested) {
    const addon = ADDONS[id];
    if (!addon) throw new Error('Unknown add-on.');
    if (seen.has(id)) continue;
    seen.add(id);
    addons.push(addon);
  }

  const lines = [
    {
      label: exp.kind === 'nightly' ? `${exp.name} · ${units} night${units > 1 ? 's' : ''}` : exp.name,
      amount: exp.price * units,
    },
    ...addons.map((a) => ({ label: a.name, amount: a.price })),
  ];

  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const service = Math.round(subtotal * SERVICE_RATE);
  const tax = Math.round((subtotal + service) * TAX_RATE);
  const total = subtotal + service + tax;
  const deposit = Math.round(total * DEPOSIT_RATE);

  return {
    experience: exp,
    units,
    guests,
    addons,
    start: input.start,
    end: end ? input.end : null,
    pricing: { lines, subtotal, service, tax, total, deposit, balance: total - deposit },
  };
}

module.exports = { EXPERIENCES, ADDONS, SERVICE_RATE, TAX_RATE, DEPOSIT_RATE, priceBooking };
