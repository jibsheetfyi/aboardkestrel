/* Kestrel — shared chrome, data, and utilities */

const KESTREL = {
  name: 'Kestrel',
  tagline: 'Marina del Rey',
  phone: '(310) 555-0178',
  email: 'crew@kestrelcharters.com',
  slip: 'Basin D, Marina del Rey, California',
};

const LOGO_SVG = `
<svg class="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
  <circle cx="20" cy="20" r="18.5" stroke="currentColor" stroke-width="1.1" opacity="0.45"/>
  <path d="M20 6.5 20 27" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M19 9.5c5.4 3.6 7.8 9 7.6 15.2H19V9.5Z" fill="currentColor"/>
  <path d="M18.4 14.6c-3.6 2.8-5.4 6.4-5.6 10.1h5.6V14.6Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M8.5 29.2h23c-1.6 2.9-4.2 4.6-7.6 4.6H14.4c-2.6 0-4.6-1.5-5.9-4.6Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
</svg>`;

/* ---------- experiences ---------- */

const EXPERIENCES = [
  {
    id: 'dockside',
    kind: 'nightly',
    name: 'Night Aboard',
    short: 'Dockside stay',
    desc: 'Sleep aboard at our private slip. Full run of the yacht, no captain required — walk to Mother\u2019s Beach, the Waterside shops, and dinner on Washington Blvd.',
    blurb: 'The whole boat is yours: four cabins, a full galley, air conditioning, and a cockpit that makes an unreasonably good breakfast table.',
    price: 895,
    unit: 'night',
    minUnits: 2,
    maxGuests: 8,
    duration: '2-night minimum',
    includes: ['Entire yacht, 4 cabins', 'Linens, towels, coffee service', 'Shore power, A/C, hot water', 'Marina gate access + parking'],
    image: 'assets/kestrel-cockpit.jpg',
  },
  {
    id: 'halfday',
    kind: 'session',
    name: 'Half-Day Sail',
    short: 'Four hours, skippered',
    desc: 'Four hours with a USCG-licensed captain and mate. Out the main channel, along the Santa Monica Bay coast, and back in time for dinner ashore.',
    blurb: 'Steer if you want to, or don\u2019t. Most guests end up on the helm somewhere off Playa del Rey.',
    price: 2400,
    unit: 'charter',
    minUnits: 1,
    maxGuests: 12,
    duration: '4 hours \u00b7 morning or sunset',
    includes: ['Captain and first mate', 'Santa Monica Bay coastal route', 'Chilled water, sodas, snacks', 'Up to 12 guests underway'],
    image: 'assets/kestrel-sailing.jpg',
  },
  {
    id: 'fullday',
    kind: 'session',
    name: 'Full-Day Sail',
    short: 'Eight hours to the bay and back',
    desc: 'A proper day on the water — eight hours, lunch aboard, and a swim stop off Paradise Cove or Malibu when conditions cooperate.',
    blurb: 'Enough time to actually get the sails trimmed, get somewhere, and stop for a swim.',
    price: 3800,
    unit: 'charter',
    minUnits: 1,
    maxGuests: 12,
    duration: '8 hours \u00b7 departs 9:00 AM',
    includes: ['Captain, mate, and deckhand', 'Lunch service aboard', 'Swim stop and paddleboards', 'Up to 12 guests underway'],
    image: 'assets/kestrel-hero.jpg',
  },
  {
    id: 'catalina',
    kind: 'voyage',
    name: 'Catalina Passage',
    short: 'Two nights, fully crewed',
    desc: 'Cross the channel to Catalina, pick up a mooring at Two Harbors or Emerald Bay, and stay two nights aboard with full crew and chef.',
    blurb: 'Roughly 32 nautical miles each way. Dolphins are not guaranteed, but they show up more often than not.',
    price: 7500,
    unit: 'voyage',
    minUnits: 1,
    maxGuests: 8,
    duration: '3 days / 2 nights',
    includes: ['Captain, mate, and chef', 'All meals and mooring fees', 'Tender, snorkel gear, paddleboards', 'Sleeps 8 in 4 cabins'],
    image: 'assets/kestrel-anchorage.jpg',
  },
];

const ADDONS = [
  { id: 'provision', name: 'Provisioning package', desc: 'Stocked galley: breakfast, snacks, wine, and local coffee.', price: 285, per: 'booking' },
  { id: 'chef', name: 'Chef dinner aboard', desc: 'Three courses in the cockpit, served at the slip or at anchor.', price: 650, per: 'booking' },
  { id: 'photo', name: 'Photographer on board', desc: 'Two hours of chase-boat and on-deck coverage, edited gallery.', price: 750, per: 'booking' },
  { id: 'sunset', name: 'Sunset extension', desc: 'Add two hours and stay out past golden hour.', price: 480, per: 'booking' },
];

const SERVICE_RATE = 0.12;
const TAX_RATE = 0.0925;

const fmt = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

/* ---------- deterministic pseudo-availability ---------- */

function isBlocked(date) {
  const key = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  let h = key % 97;
  h = (h * 31 + date.getDay() * 7) % 100;
  return h < 22;
}

function isPast(date) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return date < t;
}

/* ---------- chrome ---------- */

function renderHeader(onDark) {
  return `
<header class="site-header${onDark ? ' on-dark' : ''}">
  <div class="wrap header-inner">
    <a class="brand" href="index.html" aria-label="${KESTREL.name} home">
      ${LOGO_SVG}
      <span class="brand-text">
        <span class="brand-name">${KESTREL.name}</span>
        <span class="brand-sub">${KESTREL.tagline}</span>
      </span>
    </a>
    <nav class="nav" aria-label="Main">
      <a href="index.html#experiences">Experiences</a>
      <a href="index.html#yacht">The Yacht</a>
      <a href="index.html#gallery">Gallery</a>
      <a href="index.html#faq">Good to Know</a>
    </nav>
    <div class="header-actions">
      <button class="icon-btn" data-theme-toggle aria-label="Switch to dark mode"></button>
      <a class="btn ${onDark ? 'btn-light' : 'btn-primary'}" href="book.html">Check dates</a>
    </div>
  </div>
</header>`;
}

function renderFooter() {
  return `
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="index.html" style="color:#ece7da">
          ${LOGO_SVG}
          <span class="brand-text">
            <span class="brand-name">${KESTREL.name}</span>
            <span class="brand-sub">${KESTREL.tagline}</span>
          </span>
        </a>
        <p class="small" style="margin-top:var(--space-5);max-width:34ch;opacity:.8">
          A 78-foot Nautor Swan, privately owned and professionally kept, chartered a few dozen times a year from her home slip in Marina del Rey.
        </p>
      </div>
      <div>
        <h5>Charter</h5>
        <div class="footer-list">
          ${EXPERIENCES.map((e) => `<a href="book.html#${e.id}">${e.name}</a>`).join('')}
          <a href="index.html#faq">Good to know</a>
        </div>
      </div>
      <div>
        <h5>Contact</h5>
        <div class="footer-list">
          <a href="tel:+13105550178">${KESTREL.phone}</a>
          <a href="mailto:${KESTREL.email}">${KESTREL.email}</a>
          <span class="small" style="opacity:.8">${KESTREL.slip}</span>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; ${new Date().getFullYear()} ${KESTREL.name} Charters. USCG-licensed captains. Fully insured.</span>
      <span>Demonstration site &mdash; bookings and payments are simulated.</span>
    </div>
  </div>
</footer>`;
}

/* ---------- theme + reveal ---------- */

const SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.8v2.2M12 20v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M1.8 12h2.2M20 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" stroke-linecap="round"/></svg>';
const MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" stroke-linejoin="round"/></svg>';

function initChrome() {
  const root = document.documentElement;
  let mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const paint = () => {
    root.setAttribute('data-theme', mode);
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
      b.innerHTML = mode === 'dark' ? SUN : MOON;
      b.setAttribute('aria-label', 'Switch to ' + (mode === 'dark' ? 'light' : 'dark') + ' mode');
    });
  };
  paint();
  document.querySelectorAll('[data-theme-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
      mode = mode === 'dark' ? 'light' : 'dark';
      paint();
    })
  );

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
