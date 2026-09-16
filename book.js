/* Kestrel — booking flow (simulated checkout) */

const STEPS = ['Experience', 'Dates', 'Extras', 'Guest details', 'Payment'];

const state = {
  step: 0,
  expId: 'dockside',
  start: null, // Date
  end: null, // Date (nightly: checkout; session: same day; voyage: computed)
  guests: 4,
  addons: [],
  cal: startOfMonth(new Date()),
  details: { name: '', email: '', phone: '', occasion: '', notes: '' },
  pay: { card: '', exp: '', cvc: '', zip: '', name: '' },
  errors: {},
  processing: false,
  ref: null,
};

/* ---------- date helpers ---------- */

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a, b) { return a && b && a.toDateString() === b.toDateString(); }
function nights(a, b) { return Math.round((b - a) / 86400000); }
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
    lines.push({ label: a.name, sub: 'Added extra', amount: a.price });
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
          <span class="choice-price">${fmt(a.price)}<span>per ${a.per}</span></span>
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
        <input id="name" data-field="name" value="${d.name}" placeholder="Ryan Kelly" data-testid="input-name" />
        ${err.name ? `<span class="field-error">${err.name}</span>` : ''}
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" type="email" data-field="email" value="${d.email}" placeholder="you@example.com" data-testid="input-email" />
        ${err.email ? `<span class="field-error">${err.email}</span>` : ''}
      </div>
      <div class="field">
        <label for="phone">Mobile</label>
        <input id="phone" data-field="phone" value="${d.phone}" placeholder="(310) 555-0142" data-testid="input-phone" />
        ${err.phone ? `<span class="field-error">${err.phone}</span>` : ''}
      </div>
      <div class="field">
        <label for="occasion">Occasion (optional)</label>
        <select id="occasion" data-field="occasion" data-testid="select-occasion">
          ${['—', 'Anniversary', 'Birthday', 'Proposal', 'Family trip', 'Client / company', 'Photo or video shoot']
            .map((o) => `<option ${o === d.occasion ? 'selected' : ''}>${o}</option>`)
            .join('')}
        </select>
      </div>
      <div class="field field-full">
        <label for="notes">Anything the crew should know?</label>
        <textarea id="notes" rows="3" data-field="notes" placeholder="Dietary needs, kids aboard, someone who wants to learn to helm…" data-testid="input-notes">${d.notes}</textarea>
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
  const v = state.pay;
  const err = state.errors;
  return `
  <section class="panel">
    <p class="eyebrow">Step 5</p>
    <h2 style="margin-top: var(--space-2)">Hold your dates</h2>
    <p class="small muted" style="margin-top: var(--space-3)">
      ${fmt(p.deposit)} due now, ${fmt(p.total - p.deposit)} charged seven days before departure.
    </p>
    <div class="field-grid">
      <div class="field field-full">
        <label for="card">Card number</label>
        <input id="card" data-field="card" data-pay value="${v.card}" inputmode="numeric" placeholder="4242 4242 4242 4242" data-testid="input-card" />
        ${err.card ? `<span class="field-error">${err.card}</span>` : ''}
      </div>
      <div class="field">
        <label for="exp">Expiry</label>
        <input id="exp" data-field="exp" data-pay value="${v.exp}" placeholder="04 / 29" data-testid="input-exp" />
        ${err.exp ? `<span class="field-error">${err.exp}</span>` : ''}
      </div>
      <div class="field">
        <label for="cvc">CVC</label>
        <input id="cvc" data-field="cvc" data-pay value="${v.cvc}" inputmode="numeric" placeholder="123" data-testid="input-cvc" />
        ${err.cvc ? `<span class="field-error">${err.cvc}</span>` : ''}
      </div>
      <div class="field">
        <label for="zip">Billing ZIP</label>
        <input id="zip" data-field="zip" data-pay value="${v.zip}" inputmode="numeric" placeholder="90292" data-testid="input-zip" />
        ${err.zip ? `<span class="field-error">${err.zip}</span>` : ''}
      </div>
      <div class="field">
        <label for="cardname">Name on card</label>
        <input id="cardname" data-field="name" data-pay value="${v.name}" placeholder="${state.details.name || 'Ryan Kelly'}" data-testid="input-cardname" />
      </div>
    </div>
    <div class="notice">
      <span>🔒</span>
      <span>
        This is a demonstration checkout — no card is charged and no data leaves the page. Any 16-digit number works, or
        use 4242 4242 4242 4242.
      </span>
    </div>
    <div class="step-actions">
      <button class="btn btn-ghost" data-back ${state.processing ? 'disabled' : ''} data-testid="button-back-5">Back</button>
      <button class="btn btn-primary btn-lg" data-pay-submit ${state.processing ? 'disabled' : ''} data-testid="button-pay">
        ${state.processing ? '<span class="spinner"></span> Authorizing…' : `Pay ${fmt(p.deposit)} deposit`}
      </button>
    </div>
  </section>`;
}

function panelConfirm() {
  const e = exp();
  const p = priceLines();
  const dates =
    e.kind === 'nightly'
      ? `${fmtDate(state.start, { weekday: 'long', month: 'long', day: 'numeric' })} → ${fmtDate(state.end, { weekday: 'long', month: 'long', day: 'numeric' })}`
      : e.kind === 'voyage'
        ? `${fmtDate(state.start, { weekday: 'long', month: 'long', day: 'numeric' })} → ${fmtDate(addDays(state.start, 2), { weekday: 'long', month: 'long', day: 'numeric' })}`
        : fmtDate(state.start, { weekday: 'long', month: 'long', day: 'numeric' });

  return `
  <section class="panel confirm" data-testid="status-confirmed">
    <div class="confirm-mark">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12.5l5 5L20 6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <p class="eyebrow">Deposit authorized</p>
    <h2 style="margin-top: var(--space-3)">You are on the calendar.</h2>
    <p class="confirm-ref">${state.ref}</p>
    <p class="small muted" style="margin: var(--space-5) auto 0; max-width: 46ch">
      A confirmation is on its way to ${state.details.email || 'your inbox'}. Captain Marc will call within a day to sort
      out timing, provisioning, and anything else. Kestrel lives in Basin D — parking passes come with your charter.
    </p>
    <div class="receipt">
      <div class="summary-lines">
        <div class="line"><span>Experience</span><span>${e.name}</span></div>
        <div class="line"><span>Dates</span><span>${dates}</span></div>
        <div class="line"><span>Guests</span><span>${state.guests}</span></div>
        ${state.addons.length ? `<div class="line"><span>Extras</span><span>${state.addons.map((id) => ADDONS.find((a) => a.id === id).name).join(', ')}</span></div>` : ''}
      </div>
      <div class="summary-total">
        <div class="line"><strong>Charter total</strong><strong>${fmt(p.total)}</strong></div>
        <div class="line line-sub"><span>Deposit paid today</span><span>${fmt(p.deposit)}</span></div>
        <div class="line line-sub"><span>Balance due 7 days out</span><span>${fmt(p.total - p.deposit)}</span></div>
      </div>
    </div>
    <div class="hero-cta" style="justify-content: center">
      <a class="btn btn-primary btn-lg" href="index.html">Back to the yacht</a>
      <button class="btn btn-ghost btn-lg" data-restart data-testid="button-restart">Book another charter</button>
    </div>
  </section>`;
}

/* ---------- validation ---------- */

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

function validatePay() {
  state.errors = {};
  const v = state.pay;
  if (v.card.replace(/\D/g, '').length < 15) state.errors.card = 'Enter a valid 16-digit card number.';
  if (!/^\d{2}\s*\/?\s*\d{2}$/.test(v.exp.trim())) state.errors.exp = 'Use MM / YY.';
  if (v.cvc.replace(/\D/g, '').length < 3) state.errors.cvc = '3 or 4 digits.';
  if (v.zip.replace(/\D/g, '').length < 5) state.errors.zip = '5-digit ZIP.';
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
      pay: { card: '', exp: '', cvc: '', zip: '', name: '' },
    });
    return render();
  }
  if (t.hasAttribute('data-pay-submit')) {
    if (!validatePay()) return render();
    state.processing = true;
    render();
    setTimeout(() => {
      state.processing = false;
      state.ref = 'KES-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + String(Date.now()).slice(-4);
      state.step = 5;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 1500);
  }
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

const hash = location.hash.replace('#', '');
if (EXPERIENCES.some((e) => e.id === hash)) {
  state.expId = hash;
  state.step = 1;
}

render();
initChrome();
