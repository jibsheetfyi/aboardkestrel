/* Kestrel — booking flow (simulated checkout) */

const STEPS = ['Experience', 'Dates', 'Extras', 'Guest details', 'Payment'];

const state = {
  booking: null,
  step: 0,
  expId: 'dockside',
  start: null, // Date
  end: null, // Date (nightly: checkout; session: same day; voyage: computed)
  guests: 4,
  addons: [],
  cal: startOfMonth(new Date()),
  details: { name: '', email: '', phone: '', occasion: '', notes: '' },
  errors: {},
  processing: false,
  ref: null,
};

/* ---------- date helpers ---------- */

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a, b) { return a && b && a.toDateString() === b.toDateString(); }
function nights(a, b) { return Math.round((b - a) / 86400000); }
function parseIso(v) {
  const [y, m, d] = String(v).split('-').map(Number);
  return new Date(y, m - 1, d);
}
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(d, opts) {
  return d ? d.toLocaleDateString('en-US', opts || { weekday: 'short', month: 'short', day: 'numeric' }) : '—';
}

function exp() { return EXPERIENCES.find((e) => e.id === state.expId); }

function voyageDays() { return exp().kind === 'voyage' ? 3 : 1; }

/* Dates required for the current selection, given a start date. */
function spanFor(start) {
  const e = exp();
  if (e.kind === 'nightly') return null; // range picked by user
  return Array.from({ length: voyageDays() }, (_, i) => addDays(start, i));
}

function rangeDates(a, b) {
  const out = [];
  for (let d = new Date(a); d < b; d = addDays(d, 1)) out.push(new Date(d));
  return out;
}

function selectionValid() {
  const e = exp();
  if (!state.start) return false;
  if (e.kind === 'nightly') return state.end && nights(state.start, state.end) >= e.minUnits;
  return true;
}

/* ---------- pricing ---------- */

function priceLines() {
  const e = exp();
  const lines = [];
  let units = 1;
  let label = e.name;
  if (e.kind === 'nightly') {
    units = state.start && state.end ? nights(state.start, state.end) : e.minUnits;
    label = `${e.name} · ${units} night${units > 1 ? 's' : ''}`;
  } else if (e.kind === 'voyage') {
    label = `${e.name} · 3 days / 2 nights`;
  }
  const base = e.price * units;
  lines.push({ label, sub: `${fmt(e.price)} / ${e.unit}`, amount: base });

  state.addons.forEach((id) => {
    const a = ADDONS.find((x) => x.id === id);
    if (!a) return;
    // Per-guest add-ons (menus, wine) scale with the party; must match catalog.js.
    if (a.per === 'guest') {
      const n = state.guests || 1;
      lines.push({ label: a.name, sub: `${fmt(a.price)} \u00d7 ${n} guest${n > 1 ? 's' : ''}`, amount: a.price * n });
    } else {
      lines.push({ label: a.name, sub: 'Added extra', amount: a.price });
    }
  });

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const service = Math.round(subtotal * SERVICE_RATE);
  const tax = Math.round((subtotal + service) * TAX_RATE);
  const total = subtotal + service + tax;
  return { lines, subtotal, service, tax, total, deposit: Math.round(total * 0.3) };
}

/* ---------- rendering: steps ---------- */

function renderSteps() {
  document.getElementById('steps').innerHTML = STEPS.map((s, i) => {
    const cls = state.step === i ? 'is-active' : state.step > i ? 'is-done' : '';
    return `<span class="step-chip ${cls}"><i>${state.step > i ? '✓' : i + 1}</i>${s}</span>`;
  }).join('');
  if (state.step >= STEPS.length) document.getElementById('steps').innerHTML = '';
}

/* ---------- rendering: summary ---------- */

function renderSummary() {
  const e = exp();
  const p = priceLines();
  const dateText =
    e.kind === 'nightly'
      ? state.start && state.end
        ? `${fmtDate(state.start)} → ${fmtDate(state.end)}`
        : 'Dates not selected'
      : state.start
        ? e.kind === 'voyage'
          ? `${fmtDate(state.start)} → ${fmtDate(addDays(state.start, 2))}`
          : fmtDate(state.start)
        : 'Date not selected';

  document.getElementById('summary').innerHTML = `
    <div class="summary">
      <div class="summary-media"><img src="${e.image}" alt="${e.name} aboard Kestrel" /></div>
      <div class="summary-body">
        <p class="eyebrow">Your charter</p>
        <h3 style="margin-top: var(--space-2)">${e.name}</h3>
        <p class="small muted" style="margin-top: var(--space-2)">${dateText} · ${state.guests} guest${state.guests > 1 ? 's' : ''}</p>
        <div class="summary-lines">
          ${p.lines.map((l) => `<div class="line"><span>${l.label}<br /><span class="tiny line-sub">${l.sub}</span></span><span>${fmt(l.amount)}</span></div>`).join('')}
        </div>
        <div class="summary-total">
          <div class="line line-sub"><span>Service &amp; crew fee</span><span>${fmt(p.service)}</span></div>
          <div class="line line-sub"><span>CA tax &amp; slip fees</span><span>${fmt(p.tax)}</span></div>
          <div class="line"><strong>Total</strong><strong>${fmt(p.total)}</strong></div>
          <div class="line line-sub"><span>Due today (30% deposit)</span><span>${fmt(p.deposit)}</span></div>
        </div>
        <div class="badge-row">
          <span class="badge">Free cancellation to 14 days</span>
          <span class="badge">Private — never shared</span>
          <span class="badge">Fully insured</span>
        </div>
      </div>
    </div>`;
}

/* ---------- rendering: calendar ---------- */

function renderCalendar() {
  const e = exp();
  const first = state.cal;
  const monthName = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const offset = first.getDay();
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const today = new Date();
  const atFirstMonth = first.getFullYear() === today.getFullYear() && first.getMonth() === today.getMonth();

  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<div class="cal-day is-empty"></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(first.getFullYear(), first.getMonth(), day);
    const disabled = isPast(d) || isBlocked(d);
    let cls = 'cal-day';
    if (sameDay(d, state.start) || sameDay(d, state.end)) cls += ' is-selected';
    else if (e.kind === 'nightly' && state.start && state.end && d > state.start && d < state.end) cls += ' is-inrange';
    else if (e.kind !== 'nightly' && state.start && d > state.start && d < addDays(state.start, voyageDays())) cls += ' is-inrange';
    cells += `<button class="${cls}" ${disabled ? 'disabled' : ''} data-day="${day}" data-testid="button-day-${first.getMonth() + 1}-${day}" aria-label="${fmtDate(d, { month: 'long', day: 'numeric' })}${disabled ? ', unavailable' : ''}">${day}</button>`;
  }

  const hint =
    e.kind === 'nightly'
      ? state.start && !state.end
        ? 'Now choose your check-out date — two-night minimum.'
        : 'Select a check-in date, then a check-out date.'
      : e.kind === 'voyage'
        ? 'Select your departure date. The passage runs three days and two nights.'
        : 'Select the day you would like to sail.';

  return `
    <div class="cal-head">
      <span class="cal-title">${monthName}</span>
      <div class="cal-nav">
        <button data-cal="-1" ${atFirstMonth ? 'disabled' : ''} aria-label="Previous month" data-testid="button-prev-month">‹</button>
        <button data-cal="1" aria-label="Next month" data-testid="button-next-month">›</button>
      </div>
    </div>
    <div class="cal-grid">
      ${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells}
    </div>
    <div class="cal-legend">
      <span><span class="legend-swatch" style="background: var(--color-primary)"></span>Selected</span>
      <span><span class="legend-swatch" style="background: var(--color-surface-2); border: 1px solid var(--color-border)"></span>Available</span>
      <span><span class="legend-swatch" style="background: transparent; border: 1px solid var(--color-border)"></span>Booked or past</span>
    </div>
    <p class="small muted" style="margin-top: var(--space-4)">${hint}</p>`;
}

/* ---------- rendering: panels ---------- */

function panelExperience() {
  return `
  <section class="panel">
    <p class="eyebrow">Step 1</p>
    <h2 style="margin-top: var(--space-2)">What kind of time on the water?</h2>
    <p class="small muted" style="margin-top: var(--space-3)">Every option is a private charter of the whole yacht.</p>
    <div class="choice-list">
      ${EXPERIENCES.map(
        (e) => `
        <button class="choice ${e.id === state.expId ? 'is-selected' : ''}" data-exp="${e.id}" data-testid="button-exp-${e.id}">
          <span class="choice-dot"></span>
          <span>
            <span class="choice-name">${e.name}</span>
            <span class="choice-desc">${e.blurb}</span>
            <span class="choice-desc" style="color: var(--color-text-faint)">${e.duration} · up to ${e.maxGuests} guests · ${e.includes[0]}</span>
          </span>
          <span class="choice-price">${fmt(e.price)}<span>per ${e.unit}</span></span>
        </button>`
      ).join('')}
    </div>
    <div class="step-actions" style="justify-content: flex-end">
      <button class="btn btn-primary btn-lg" data-next data-testid="button-next-1">Choose dates</button>
    </div>
  </section>`;
}

function panelDates() {
  const e = exp();
  return `
  <section class="panel">
    <p class="eyebrow">Step 2</p>
    <h2 style="margin-top: var(--space-2)">When would you like to come aboard?</h2>
    <p class="small muted" style="margin-top: var(--space-3)">Live availability for ${e.name}. Crossed-out days are already booked.</p>
    <div style="margin-top: var(--space-6)">${renderCalendar()}</div>
    ${state.errors.dates ? `<p class="field-error" style="margin-top: var(--space-4)">${state.errors.dates}</p>` : ''}
    <div class="field-grid">
      <div class="field">
        <label for="guests">Guests</label>
        <select id="guests" data-field="guests" data-testid="select-guests">
          ${Array.from({ length: e.maxGuests }, (_, i) => i + 1)
            .map((n) => `<option value="${n}" ${n === state.guests ? 'selected' : ''}>${n} guest${n > 1 ? 's' : ''}</option>`)
            .join('')}
        </select>
      </div>
      ${
        e.kind === 'session'
          ? `<div class="field">
              <label for="slot">Departure</label>
              <select id="slot" data-testid="select-slot">
                <option>Morning · 9:00 AM</option>
                <option>Afternoon · 1:00 PM</option>
                ${e.id === 'halfday' ? '<option>Sunset · 4:30 PM</option>' : ''}
              </select>
            </div>`
          : ''
      }
    </div>
    <div class="notice">
      <span>⚓</span>
      <span>${e.includes.join(' · ')}</span>
    </div>
    <div class="step-actions">
      <button class="btn btn-ghost" data-back data-testid="button-back-2">Back</button>
      <button class="btn btn-primary btn-lg" data-next data-testid="button-next-2">Add extras</button>
    </div>
  </section>`;
}

function panelAddons() {
  return `
  <section class="panel">
    <p class="eyebrow">Step 3</p>
    <h2 style="margin-top: var(--space-2)">Anything to make it easier?</h2>
    <p class="small muted" style="margin-top: var(--space-3)">All optional, all arranged by the crew before you arrive.</p>
    <div class="choice-list">
      ${ADDONS.map(
        (a) => `
        <button class="choice addon ${state.addons.includes(a.id) ? 'is-selected' : ''}" data-addon="${a.id}" data-testid="button-addon-${a.id}">
          <span class="choice-dot"></span>
          <span>
            <span class="choice-name">${a.name}</span>
            <span class="choice-desc">${a.desc}</span>
          </span>
          <span class="choice-price">${fmt(a.price)}<span>per ${a.per === 'guest' ? 'guest' : 'charter'}</span></span>
        </button>`
      ).join('')}
    </div>
    <div class="step-actions">
      <button class="btn btn-ghost" data-back data-testid="button-back-3">Back</button>
      <button class="btn btn-primary btn-lg" data-next data-testid="button-next-3">Guest details</button>
    </div>
  </section>`;
}

function panelDetails() {
  const d = state.details;
  const err = state.errors;
  return `
  <section class="panel">
    <p class="eyebrow">Step 4</p>
    <h2 style="margin-top: var(--space-2)">Who is coming aboard?</h2>
    <p class="small muted" style="margin-top: var(--space-3)">The captain will text you the gate code and slip number the morning of.</p>
    <div class="field-grid">
      <div class="field">
        <label for="name">Full name</label>
        <input id="name" data-field="name" value="${esc(d.name)}" placeholder="Ryan Kelly" data-testid="input-name" />
        ${err.name ? `<span class="field-error">${err.name}</span>` : ''}
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" type="email" data-field="email" value="${esc(d.email)}" placeholder="you@example.com" data-testid="input-email" />
        ${err.email ? `<span class="field-error">${err.email}</span>` : ''}
      </div>
      <div class="field">
        <label for="phone">Mobile</label>
        <input id="phone" data-field="phone" value="${esc(d.phone)}" placeholder="(310) 555-0142" data-testid="input-phone" />
        ${err.phone ? `<span class="field-error">${err.phone}</span>` : ''}
      </div>
      <div class="field">
        <label for="occasion">Occasion (optional)</label>
        <select id="occasion" data-field="occasion" data-testid="select-occasion">
          ${['—', 'Lunch or meeting', 'Client hosting', 'Holiday party', 'Game day', 'Birthday or milestone', 'Anniversary', 'Team building', 'Sunset with friends', 'Family trip', 'Photo or video shoot', 'Something else']
            .map((o) => `<option ${o === d.occasion ? 'selected' : ''}>${o}</option>`)
            .join('')}
        </select>
      </div>
      <div class="field field-full">
        <label for="notes">Anything the crew should know?</label>
        <textarea id="notes" rows="3" data-field="notes" placeholder="Dietary needs, kids aboard, someone who wants to learn to helm…" data-testid="input-notes">${esc(d.notes)}</textarea>
      </div>
    </div>
    <div class="step-actions">
      <button class="btn btn-ghost" data-back data-testid="button-back-4">Back</button>
      <button class="btn btn-primary btn-lg" data-next data-testid="button-next-4">Continue to payment</button>
    </div>
  </section>`;
}

function panelPayment() {
  const p = priceLines();
  const err = state.errors;
  return `
  <section class="panel">
    <p class="eyebrow">Step 5</p>
    <h2 style="margin-top: var(--space-2)">Hold your dates</h2>
    <p class="small muted" style="margin-top: var(--space-3)">
      ${fmt(p.deposit)} due now, ${fmt(p.total - p.deposit)} charged seven days before departure.
    </p>

    <div class="pay-review">
      <div class="line"><span>${esc(exp().name)}</span><span>${fmt(p.total)}</span></div>
      <div class="line line-sub"><span>Deposit due now (30%)</span><span>${fmt(p.deposit)}</span></div>
      <div class="line line-sub"><span>Balance, 7 days before departure</span><span>${fmt(p.total - p.deposit)}</span></div>
    </div>

    <div class="notice">
      <span>&#128274;</span>
      <span>
        Card details are entered on Stripe&rsquo;s secure checkout page &mdash; they never touch this site. Your card is
        saved so the balance can be charged automatically before you sail.
      </span>
    </div>

    ${err.checkout ? `<p class="field-error" style="margin-top: var(--space-4)" data-testid="error-checkout">${esc(err.checkout)}</p>` : ''}

    <div class="step-actions">
      <button class="btn btn-ghost" data-back ${state.processing ? 'disabled' : ''} data-testid="button-back-5">Back</button>
      <button class="btn btn-primary btn-lg" data-pay-submit ${state.processing ? 'disabled' : ''} data-testid="button-pay">
        ${state.processing ? '<span class="spinner"></span> Opening secure checkout&hellip;' : `Pay ${fmt(p.deposit)} deposit`}
      </button>
    </div>
  </section>`;
}

function panelConfirm() {
  const b = state.booking;
  if (!b) {
    return `
  <section class="panel confirm" data-testid="status-loading">
    <p class="eyebrow">One moment</p>
    <h2 style="margin-top: var(--space-3)">Confirming your deposit&hellip;</h2>
    <p class="small muted" style="margin: var(--space-5) auto 0; max-width: 46ch">
      <span class="spinner"></span> Checking with the payment processor.
    </p>
  </section>`;
  }

  const paid = b.status === 'confirmed';
  const meta = EXPERIENCES.find((e) => e.id === b.experience);
  const name = meta ? meta.name : b.experience;
  const extras = b.addons
    .map((id) => (ADDONS.find((a) => a.id === id) || {}).name)
    .filter(Boolean)
    .join(', ');
  const dates = b.end
    ? `${fmtDate(parseIso(b.start), { weekday: 'long', month: 'long', day: 'numeric' })} \u2192 ${fmtDate(parseIso(b.end), { weekday: 'long', month: 'long', day: 'numeric' })}`
    : fmtDate(parseIso(b.start), { weekday: 'long', month: 'long', day: 'numeric' });

  return `
  <section class="panel confirm" data-testid="${paid ? 'status-confirmed' : 'status-pending'}">
    <div class="confirm-mark">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12.5l5 5L20 6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <p class="eyebrow">${paid ? 'Deposit received' : 'Deposit processing'}</p>
    <h2 style="margin-top: var(--space-3)">${paid ? 'You are on the calendar.' : 'Almost there.'}</h2>
    <p class="confirm-ref">${esc(b.reference)}</p>
    <p class="small muted" style="margin: var(--space-5) auto 0; max-width: 46ch">
      ${paid
        ? `A confirmation is on its way to ${esc(b.email || 'your inbox')}. Captain Marc will call within a day to sort out timing, provisioning, and anything else. Kestrel lives in Basin D &mdash; parking passes come with your charter.`
        : 'Your payment went through and we are waiting on final confirmation from the processor. This page updates on its own; nothing more is needed from you.'}
    </p>
    <div class="receipt">
      <div class="summary-lines">
        <div class="line"><span>Experience</span><span>${esc(name)}</span></div>
        <div class="line"><span>Dates</span><span>${dates}</span></div>
        <div class="line"><span>Guests</span><span>${b.guests}</span></div>
        ${extras ? `<div class="line"><span>Extras</span><span>${esc(extras)}</span></div>` : ''}
      </div>
      <div class="summary-total">
        <div class="line"><strong>Charter total</strong><strong>${fmt(b.total)}</strong></div>
        <div class="line line-sub"><span>Deposit paid</span><span>${fmt(b.deposit)}</span></div>
        <div class="line line-sub"><span>Balance, 7 days before departure</span><span>${fmt(b.balance)}</span></div>
      </div>
    </div>
    <div class="hero-cta" style="justify-content: center">
      <a class="btn btn-primary btn-lg" href="index.html">Back to the yacht</a>
      <a class="btn btn-ghost btn-lg" href="book.html" data-testid="button-restart">Book another charter</a>
    </div>
  </section>`;
}

function validateDates() {
  const e = exp();
  state.errors = {};
  if (!state.start) {
    state.errors.dates = e.kind === 'nightly' ? 'Choose a check-in date to continue.' : 'Choose a date to continue.';
    return false;
  }
  if (e.kind === 'nightly') {
    if (!state.end) {
      state.errors.dates = 'Choose a check-out date — two nights minimum.';
      return false;
    }
    if (nights(state.start, state.end) < e.minUnits) {
      state.errors.dates = `${e.name} has a ${e.minUnits}-night minimum.`;
      return false;
    }
  }
  return true;
}

function validateDetails() {
  state.errors = {};
  const d = state.details;
  if (d.name.trim().length < 2) state.errors.name = 'Please enter your name.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) state.errors.email = 'Enter a valid email address.';
  if (d.phone.replace(/\D/g, '').length < 10) state.errors.phone = 'Enter a 10-digit mobile number.';
  return Object.keys(state.errors).length === 0;
}


/* ---------- controller ---------- */

function render() {
  renderSteps();
  const panels = [panelExperience, panelDates, panelAddons, panelDetails, panelPayment, panelConfirm];
  document.getElementById('step-panel').innerHTML = panels[state.step]();
  const aside = document.getElementById('summary');
  const layout = document.querySelector('.book-layout');
  if (state.step >= 5) {
    aside.innerHTML = '';
    layout.classList.add('is-single');
  } else {
    layout.classList.remove('is-single');
    renderSummary();
  }
}

function goNext() {
  if (state.step === 1 && !validateDates()) return render();
  if (state.step === 3 && !validateDetails()) return render();
  state.errors = {};
  state.step = Math.min(state.step + 1, 5);
  render();
  window.scrollTo({ top: 120, behavior: 'smooth' });
}

function goBack() {
  state.errors = {};
  state.step = Math.max(state.step - 1, 0);
  render();
}

function pickDate(day) {
  const d = new Date(state.cal.getFullYear(), state.cal.getMonth(), day);
  const e = exp();
  state.errors = {};
  if (e.kind === 'nightly') {
    if (!state.start || state.end || d <= state.start) {
      state.start = d;
      state.end = null;
    } else {
      const blockedInRange = rangeDates(state.start, d).some((x) => isBlocked(x));
      if (blockedInRange) {
        state.errors.dates = 'Those nights include a date that is already booked. Pick a shorter stay.';
      } else if (nights(state.start, d) < e.minUnits) {
        state.errors.dates = `${e.name} has a ${e.minUnits}-night minimum.`;
        state.end = null;
      } else {
        state.end = d;
      }
    }
  } else {
    const span = spanFor(d);
    if (span.some((x) => isBlocked(x))) {
      state.errors.dates = 'The full passage window is not open from that date. Try another departure day.';
      state.start = null;
    } else {
      state.start = d;
      state.end = span[span.length - 1];
    }
  }
  render();
}

/* ---------- Stripe checkout ---------- */

async function startCheckout() {
  state.errors = {};
  state.processing = true;
  render();

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experience: state.expId,
        start: isoDate(state.start),
        end: state.end ? isoDate(state.end) : null,
        guests: state.guests,
        addons: state.addons,
        details: state.details,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      throw new Error(data.error || 'We could not open checkout. Please try again.');
    }
    window.location.assign(data.url);
  } catch (err) {
    state.processing = false;
    state.errors.checkout = err.message;
    render();
  }
}

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-exp], [data-addon], [data-day], [data-cal], [data-next], [data-back], [data-pay-submit], [data-restart]');
  if (!t) return;

  if (t.dataset.exp) {
    state.expId = t.dataset.exp;
    state.start = null;
    state.end = null;
    state.addons = [];
    state.guests = Math.min(state.guests, exp().maxGuests);
    return render();
  }
  if (t.dataset.addon) {
    const id = t.dataset.addon;
    state.addons = state.addons.includes(id) ? state.addons.filter((x) => x !== id) : [...state.addons, id];
    return render();
  }
  if (t.dataset.cal) {
    state.cal = new Date(state.cal.getFullYear(), state.cal.getMonth() + Number(t.dataset.cal), 1);
    return render();
  }
  if (t.dataset.day) return pickDate(Number(t.dataset.day));
  if (t.hasAttribute('data-next')) return goNext();
  if (t.hasAttribute('data-back')) return goBack();
  if (t.hasAttribute('data-restart')) {
    Object.assign(state, {
      step: 0, start: null, end: null, addons: [], guests: 4, ref: null, processing: false, errors: {},
      details: { name: '', email: '', phone: '', occasion: '', notes: '' },
    });
    return render();
  }
  if (t.hasAttribute('data-pay-submit')) return startCheckout();
});

document.addEventListener('input', (ev) => {
  const f = ev.target.dataset.field;
  if (!f) return;
  if (ev.target.hasAttribute('data-pay')) state.pay[f] = ev.target.value;
  else if (f === 'guests') state.guests = Number(ev.target.value);
  else state.details[f] = ev.target.value;
  if (f === 'guests') renderSummary();
});

document.addEventListener('change', (ev) => {
  if (ev.target.dataset.field === 'occasion') state.details.occasion = ev.target.value;
});

/* boot */
document.getElementById('header').innerHTML = renderHeader(false);
document.getElementById('footer').innerHTML = renderFooter();

const params = new URLSearchParams(location.search);
const returnedRef = params.get('ref');
const returnStatus = params.get('status');

if (returnStatus === 'confirmed' && returnedRef) {
  state.step = 5;
  loadBooking(returnedRef);
} else {
  if (returnStatus === 'cancelled') state.errors.checkout = 'Checkout was cancelled \u2014 nothing was charged. Your selections are still here.';
  const hash = location.hash.replace('#', '');
  if (EXPERIENCES.some((e) => e.id === hash)) {
    state.expId = hash;
    state.step = 1;
  }
}

/*
 * The webhook that flips a booking to "confirmed" can land a moment after the
 * guest gets redirected back, so poll briefly rather than showing a stale state.
 */
async function loadBooking(ref, attempt = 0) {
  try {
    const res = await fetch(`/api/booking/${encodeURIComponent(ref)}`);
    if (res.ok) {
      state.booking = await res.json();
      render();
      if (state.booking.status !== 'confirmed' && attempt < 6) {
        return setTimeout(() => loadBooking(ref, attempt + 1), 2000);
      }
      return;
    }
  } catch (err) {
    /* fall through to retry */
  }
  if (attempt < 6) return setTimeout(() => loadBooking(ref, attempt + 1), 2000);
  state.booking = null;
  state.errors.checkout = `We could not load booking ${ref}. Email crew@aboardkestrel.com and we will confirm it by hand.`;
  state.step = 4;
  render();
}

render();
initChrome();
