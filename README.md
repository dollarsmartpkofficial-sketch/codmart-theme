# CODMart

A Shopify theme built for cash-on-delivery commerce — the way stores actually
sell in Pakistan, India, the Gulf and other COD-first markets.

Most Shopify themes assume a shopper with a credit card who is happy to fill in
a nine-field checkout. That is not how a COD store sells. CODMart is built the
other way round: a four-field quick order form, WhatsApp ordering, real
inventory urgency, and trust signals that matter when someone is paying a
courier at their door.

---

## What's inside

**Cash on delivery**
- Quick order form — name, phone, city, address, then straight to a pre-filled
  Shopify checkout. No app required.
- Quantity offers (buy 2, buy 3) with per-tier discounts.
- Three display modes: popup, inline, or sticky bar. Popup becomes a bottom
  sheet on mobile.
- Orders arrive in Shopify admin as ordinary orders, tagged with their source.

**WhatsApp**
- Order button on the product page, pre-filled with the product name and link.
- Floating button, header and footer links.

**Conversion**
- Low-stock urgency driven by real inventory, not a made-up number.
- Discount badges, savings amounts, COD tags on product cards.
- Sticky buy bar, trust badges, testimonials, a "how it works" section.

**Built-in reviews**
- Stored in Shopify metaobjects — no paid review app.
- Reads the standard `reviews.rating` metafields, so Judge.me, Loox and Okendo
  keep working for merchants who already use them.

---

## Setup

Open **Online Store → Customize → Theme settings** and work through
**🚀 Start here**. Seven steps, about five minutes:

1. Logo
2. Colors
3. Delivery charges and city list
4. Contact details
5. Your promises — returns, payment methods, announcement bar
6. How you sell — COD form, WhatsApp, urgency, reviews
7. Social media

Everything else has a working default. Nothing is hardcoded — colors, fonts,
copy, icons and section order are all editable from the theme editor.

---

## Performance

| | |
| --- | --- |
| CSS | one file, ~48 KB |
| JavaScript | three files, ~28 KB |
| Dependencies | none |

No framework, no jQuery, no icon font, no external font request. Icons are
inline SVG; fonts come from Shopify's CDN via `font_face`. Every image carries
explicit dimensions, the first row loads eagerly and the rest lazily, and
related products are fetched after the page has painted.

Collections paginate rather than scrolling forever — 24 products a page by
default, which the merchant can change.

---

## Accessibility

Skip link, visible focus states, labelled form controls, `aria-current` on the
active page, keyboard-navigable variant pickers, and `prefers-reduced-motion`
support. Layout uses logical properties throughout, so RTL locales mirror
without a second stylesheet.

---

## Structure

```
assets/      base.css, global.js, product.js, cod-form.js
config/      settings_schema.json, settings_data.json
layout/      theme.liquid, password.liquid
locales/     en.default.json, en.default.schema.json
sections/    header, footer, homepage sections, main-* templates
snippets/    product-card, cod-form, facets, price, rating, icon, …
templates/   all 14 required templates + customer account pages
```

---

## Development

```bash
shopify theme dev --store your-store.myshopify.com
```

Creates a hidden development theme. The live theme is untouched.

To publish a copy without making it live:

```bash
shopify theme push --unpublished --theme "CODMart"
```
