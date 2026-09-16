/* Kestrel — shared chrome, data, and utilities */

const KESTREL = {
  name: 'Kestrel',
  tagline: 'Marina del Rey',
  phone: '(310) 555-0178',
  email: 'crew@aboardkestrel.com',
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

/* ---------- the three pillars ---------- */

const PILLARS = [
  {
    id: 'gather',
    name: 'Gather',
    line: 'Lunches, client hosting, game day, holidays.',
    desc: 'The boat never leaves the marina, or barely does. A long table, a good menu, and eighty feet of teak that nobody has to share.',
    image: 'assets/kestrel-lunchtable.jpg',
  },
  {
    id: 'adventure',
    name: 'Adventure',
    line: 'Sailing, diving, swimming, the channel crossing.',
    desc: 'Santa Monica Bay on a building westerly, or thirty-two miles across to Catalina with the crew who know the way.',
    image: 'assets/kestrel-crewweekend.jpg',
  },
  {
    id: 'capture',
    name: 'Capture',
    line: 'Film production, branded shoots, portraits.',
    desc: 'Kestrel is run by a working production crew. The boat is a location, a camera platform, and a set \u2014 with people aboard who have shot from her before.',
    image: 'assets/kestrel-capture.jpg',
  },
];

/* ---------- occasion router ---------- */

const OCCASIONS = [
  { id: 'lunch', label: 'A lunch or a meeting', suggest: ['lunchtable', 'halfday'] },
  { id: 'client', label: 'Hosting clients', suggest: ['lunchtable', 'fullday'], proposals: ['corporate'] },
  { id: 'holiday', label: 'A holiday party', suggest: [], proposals: ['holiday'] },
  { id: 'gameday', label: 'Game day', suggest: ['gameday'] },
  { id: 'birthday', label: 'A birthday or a milestone', suggest: ['halfday', 'fullday'] },
  { id: 'team', label: 'Team building', suggest: ['halfday'], proposals: ['crewweekend', 'corporate'] },
  { id: 'sunset', label: 'Sunset with friends', suggest: ['halfday', 'dockside'] },
  { id: 'shoot', label: 'A shoot or a production', suggest: [], proposals: ['film'] },
  { id: 'water', label: 'Getting in the water', suggest: ['fullday'], proposals: ['dive'] },
  { id: 'other', label: 'Something else entirely', suggest: [], proposals: ['corporate'] },
];

/* ---------- bookable experiences ---------- */

const EXPERIENCES = [
  {
    id: 'lunchtable',
    pillar: 'gather',
    kind: 'session',
    name: 'The Kestrel Lunch Table',
    short: 'Three hours at the slip',
    desc: 'A seated lunch for up to twelve in the cockpit, at the slip or with a slow turn around the main channel. The most civilized meeting room in the marina.',
    blurb: 'Nobody checks a phone. That is most of the point.',
    price: 1650,
    unit: 'charter',
    minUnits: 1,
    maxGuests: 12,
    duration: '3 hours \u00b7 11 AM or 1 PM',
    includes: ['Captain and steward aboard', 'Cockpit table set for twelve', 'Still and sparkling, coffee service', 'Menus from The Kestrel Table'],
    image: 'assets/kestrel-lunchtable.jpg',
  },
  {
    id: 'gameday',
    pillar: 'gather',
    kind: 'session',
    name: 'Game Day Afloat',
    short: 'Sunday at the slip',
    desc: 'The screen goes up in the cockpit, the raw bar comes out, and the boat stays exactly where she is. Four hours, up to fourteen people, no seasickness.',
    blurb: 'Every revenue day the slip presents covers the overhead. This is the easiest one.',
    price: 2200,
    unit: 'charter',
    minUnits: 1,
    maxGuests: 14,
    duration: '4 hours \u00b7 kickoff to final whistle',
    includes: ['Cockpit screen and sound', 'Steward and bar service', 'Up to 14 guests dockside', 'Add the game day spread'],
    image: 'assets/kestrel-gameday.jpg',
  },
  {
    id: 'dockside',
    pillar: 'gather',
    kind: 'nightly',
    name: 'Night Aboard',
    short: 'Dockside stay',
    desc: 'Sleep aboard at our private slip. Full run of the yacht, no captain required \u2014 walk to Mother\u2019s Beach, the Waterside shops, and dinner on Washington Blvd.',
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
    pillar: 'adventure',
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
    pillar: 'adventure',
    kind: 'session',
    name: 'Full-Day Sail',
    short: 'Eight hours to the bay and back',
    desc: 'A proper day on the water \u2014 eight hours, lunch aboard, and a swim stop off Paradise Cove or Malibu when conditions cooperate.',
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
    pillar: 'adventure',
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

/* ---------- quoted, not bookable ---------- */

const PROPOSALS = [
  {
    id: 'holiday',
    pillar: 'gather',
    name: 'Holiday Harbor Party',
    short: 'December, dressed and lit',
    desc: 'Lights in the rigging, garland on the lifelines, and a passed-canape evening for up to forty dockside. Book early \u2014 December fills first.',
    from: 3200,
    note: 'Quoted by headcount, menu, and bar. Dockside or a slow turn through the marina lights.',
    image: 'assets/kestrel-holiday.jpg',
  },
  {
    id: 'corporate',
    pillar: 'gather',
    name: 'Corporate Hosting Day',
    short: 'Clients, offsites, board days',
    desc: 'A full day built around your agenda: morning session at the slip, lunch under sail, and the afternoon wherever the breeze puts you.',
    from: 4200,
    note: 'Invoiced to the company. W-9, COI, and vendor onboarding all handled.',
    image: 'assets/kestrel-cockpit.jpg',
  },
  {
    id: 'crewweekend',
    pillar: 'adventure',
    name: 'The Kestrel Crew Weekend',
    short: 'Two days on the wheel',
    desc: 'Learn the boat properly. Sail handling, navigation, anchoring, and a night at Catalina \u2014 you run watches, the captain coaches.',
    from: 9800,
    note: 'Six guests maximum so everyone gets real time on the helm.',
    image: 'assets/kestrel-crewweekend.jpg',
  },
  {
    id: 'dive',
    pillar: 'adventure',
    name: 'Sail + Dive Escape',
    short: 'Partner-led, certified divers',
    desc: 'Sail to the Catalina frontside, anchor in a kelp cove, and dive with a licensed local operator working from our swim platform.',
    from: 5400,
    note: 'Run with licensed partner dive operators. Certification cards required; we match the operator to your group.',
    image: 'assets/kestrel-dive.jpg',
  },
  {
    id: 'film',
    pillar: 'capture',
    name: 'Sail + Film Charter',
    short: 'The boat as a location',
    desc: 'Commercials, editorial, music video, brand content. Camera boat, drone-legal water, and a crew who have run production days aboard.',
    from: 4800,
    note: 'Insurance certificates, permits, and a chase boat arranged. Tell us the shot list and we will tell you the day.',
    image: 'assets/kestrel-capture.jpg',
  },
];

/* ---------- the kestrel table ---------- */

const MENUS = [
  {
    id: 'menu-seafood',
    name: 'The Seafood Table',
    price: 135,
    line: 'Per guest \u00b7 our signature',
    courses: [
      'Raw bar \u2014 Santa Barbara uni, Kumamoto oysters, spot prawns on ice',
      'Grilled local halibut, charred lemon, salsa verde',
      'Saffron rice, blistered shishitos, heirloom tomato and burrata',
      'Olive oil cake, stone fruit, creme fraiche',
    ],
  },
  {
    id: 'menu-garden',
    name: 'The Garden Table',
    price: 115,
    line: 'Per guest \u00b7 fully vegan on request',
    courses: [
      'Marinated white beans, preserved lemon, dill, good olive oil',
      'Charred broccolini, romesco, toasted almond',
      'Farro and roasted squash bowl, pomegranate, herbs',
      'Dark chocolate tart, sea salt, olive oil',
    ],
  },
  {
    id: 'menu-gameday',
    name: 'The Game Day Spread',
    price: 85,
    line: 'Per guest \u00b7 grazing, all afternoon',
    courses: [
      'Oysters and shrimp cocktail on ice',
      'Smash burgers and grilled chicken skewers off the stern grill',
      'Street corn, slaw, pickles, good chips',
      'Cold beer, a short cocktail list, and one very serious bloody mary',
    ],
  },
  {
    id: 'menu-dive',
    name: 'The Apres-Dive Lunch',
    price: 95,
    line: 'Per guest \u00b7 served at anchor',
    courses: [
      'Hot soup off the galley stove, because the water is 62 degrees',
      'Grilled fish tacos, cabbage, lime crema',
      'Rice, black beans, salsa roja',
      'Coffee, churros, and somewhere to sit in the sun',
    ],
  },
];

const WINES = [
  { region: 'Santa Barbara County', notes: 'Sanford Chardonnay, Tyler Pinot Noir, Stolpman Roussanne' },
  { region: 'Sonoma & Anderson Valley', notes: 'Littorai, Hirsch, Copain \u2014 coastal, high-acid, built for seafood' },
  { region: 'Champagne & sparkling', notes: 'Chartogne-Taillet, Ultramarine from the Sonoma coast' },
  { region: 'Zero-proof', notes: 'Seedlip and citrus, alcohol-free sparkling, house shrubs' },
];

const ADDONS = [
  { id: 'menu-seafood', name: 'The Seafood Table', desc: 'Raw bar, grilled local halibut, four courses in the cockpit.', price: 135, per: 'guest' },
  { id: 'menu-garden', name: 'The Garden Table', desc: 'Vegetable-forward and fully vegan on request.', price: 115, per: 'guest' },
  { id: 'menu-gameday', name: 'The Game Day Spread', desc: 'Raw bar, stern-grill smash burgers, grazing all afternoon.', price: 85, per: 'guest' },
  { id: 'menu-dive', name: 'The Apres-Dive Lunch', desc: 'Hot soup and fish tacos, served at anchor.', price: 95, per: 'guest' },
  { id: 'wine', name: 'Wine pairing', desc: 'Three pours chosen for the menu, California coast.', price: 75, per: 'guest' },
  { id: 'provision', name: 'Provisioning package', desc: 'Stocked galley: breakfast, snacks, wine, and local coffee.', price: 285, per: 'booking' },
  { id: 'chef', name: 'Chef dinner aboard', desc: 'Three courses in the cockpit, served at the slip or at anchor.', price: 650, per: 'booking' },
  { id: 'photo', name: 'Photographer on board', desc: 'Two hours of chase-boat and on-deck coverage, edited gallery.', price: 750, per: 'booking' },
  { id: 'film', name: 'Onboard film capture', desc: 'Two hours with our production crew, edited film and stills.', price: 1450, per: 'booking' },
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
      <a href="index.html#occasion">Occasions</a>
      <a href="index.html#experiences">Charters</a>
      <a href="index.html#table">The Table</a>
      <a href="index.html#yacht">The Yacht</a>
      <a href="index.html#gallery">Gallery</a>
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
        </div>
      </div>
      <div>
        <h5>By proposal</h5>
        <div class="footer-list">
          ${PROPOSALS.map((p) => `<a href="index.html#inquire" data-inquire="${p.id}">${p.name}</a>`).join('')}
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
      <span data-payment-mode>Secure payments by Stripe.</span>
    </div>
  </div>
</footer>`;
}

/* ---------- theme + reveal ---------- */

const SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.8v2.2M12 20v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M1.8 12h2.2M20 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" stroke-linecap="round"/></svg>';
const MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" stroke-linejoin="round"/></svg>';

/*
 * The footer line reflects what the server is actually keyed for. If the
 * backend is still on a test key, say so plainly rather than letting a guest
 * believe a sandbox charge was real.
 */
async function markPaymentMode() {
  const nodes = document.querySelectorAll('[data-payment-mode]');
  if (!nodes.length) return;
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return;
    const cfg = await res.json();
    nodes.forEach((n) => {
      n.textContent = cfg.liveMode
        ? 'Secure payments by Stripe.'
        : 'Test mode \u2014 no card is charged.';
    });
  } catch (err) {
    /* Offline or static preview: leave the default text alone. */
  }
}

function initChrome() {
  markPaymentMode();
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
