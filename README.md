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
- Spreadsheet importer for bulk loading existing reviews.

---

## Reviews

Reviews are `product_review` metaobjects, linked to a product through a
`custom.reviews` list metafield. Reading them off the product — rather than
scanning every metaobject in the shop — keeps the product page fast however
many reviews the store accumulates.

The star summary on cards and in the header comes from `reviews.rating` and
`reviews.rating_count`, the metafields Shopify defines as standard. Judge.me,
Loox and Okendo write to the same place, so a merchant already using one of
those keeps their stars with no migration.

### Importing from a spreadsheet

Export your reviews to CSV (in Excel: **Save as → CSV UTF-8**) with these
columns — `product_handle`, `rating`, `author` and `body` are required, the
rest optional:

| product_handle | rating | author | city | title | body | review_date | verified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| hot-air-brush | 5 | Ahmed Raza | Karachi | Great quality | Delivery took four days… | 2026-07-14 | yes |

Then create an Admin API token — Shopify admin → **Settings → Apps and sales
channels → Develop apps → Create an app**, with the scopes `read_products`,
`write_products`, `read_metaobjects`, `write_metaobjects` — and run:

```bash
export SHOPIFY_STORE=your-store.myshopify.com
export SHOPIFY_ADMIN_TOKEN=shpat_xxx

node scripts/import-reviews.mjs reviews.csv --dry-run   # check the parse
node scripts/import-reviews.mjs reviews.csv             # write it
```

The script creates the metaobject definition on first run, imports each row,
links the reviews to their products, and recalculates the average and count.
`scripts/reviews-sample.csv` shows the expected shape.

Re-running adds rather than replaces, so import each spreadsheet once.

### Collecting new reviews

The "write a review" form posts through Shopify's contact form and emails the
merchant, who approves it and adds the entry in admin. A theme has no write
access to the store, so fully automatic publishing needs an app — the form is
the honest version of what a theme can do on its own.

---

## Languages

`en.default.json` and `ur.json` ship with the theme, and the layout picks
`dir="rtl"` automatically for Arabic, Hebrew, Persian, Urdu, Pashto, Sindhi and
Yiddish. Layout is written with logical properties throughout, so RTL mirrors
without a second stylesheet.

To add a language, copy `locales/en.default.json` to `locales/<code>.json` and
translate the values. Schema labels live separately in
`en.default.schema.json`.

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
locales/     en.default.json, ur.json, en.default.schema.json
scripts/     import-reviews.mjs, reviews-sample.csv
sections/    header, footer, homepage sections, main-* templates
snippets/    product-card, cod-form, facets, price, rating, review-card, …
templates/   all 14 required templates + customer account pages
```

Run `shopify theme check` before pushing; `.theme-check.yml` holds the config.

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
