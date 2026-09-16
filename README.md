# Aboard Kestrel

Charter booking prototype for S/Y Kestrel — a 78-foot Nautor Swan based in Basin D, Marina del Rey.

## What this is

A static marketing and booking site with four charter products:

| Experience | Price | Notes |
|---|---|---|
| Night Aboard | $895 / night | Dockside stay, 2-night minimum, sleeps 8 |
| Half-Day Sail | $2,400 | 4 hours, captain + mate, up to 12 |
| Full-Day Sail | $3,800 | 8 hours, departs 9:00 AM |
| Catalina Passage | $7,500 | 3 days / 2 nights, crewed with chef |

Fees: 12% service + 9.25% CA tax. 30% deposit due at booking.

## Status

Checkout is **simulated** — no payment processor is wired in. Card details never leave the page and no network request is made. Stripe drops into the payment step in `book.js`.

Photography is AI-generated placeholder imagery and needs replacing with real shots of the boat.

## Stack

Static HTML, CSS, and vanilla JS. No build step, no dependencies, no backend.

- `index.html` — landing page
- `book.html` / `book.js` — five-step booking flow
- `styles.css` — design system and components
- `shared.js` — product data, pricing, shared chrome
- `assets/` — imagery

## Local development

```
python3 -m http.server 8099
```

Then open http://localhost:8099
