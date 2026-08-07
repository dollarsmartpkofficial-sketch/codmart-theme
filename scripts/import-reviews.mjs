#!/usr/bin/env node
/**
 * Import product reviews from a spreadsheet into Shopify metaobjects.
 *
 *   node scripts/import-reviews.mjs reviews.csv
 *
 * Reads a CSV (export from Excel with "Save as → CSV UTF-8"), creates one
 * `product_review` metaobject per row, links them to the product through a
 * `custom.reviews` list metafield, and writes the average and count into the
 * standard `reviews.rating` / `reviews.rating_count` metafields that the theme
 * — and Judge.me, Loox and Okendo — read for star ratings.
 *
 * Required columns:  product_handle, rating, author, body
 * Optional columns:  title, city, review_date, verified, image_url
 *
 * Credentials come from the environment:
 *   SHOPIFY_STORE          gvk0g9-dj.myshopify.com
 *   SHOPIFY_ADMIN_TOKEN    shpat_…
 *
 * Create the token in Shopify admin → Settings → Apps and sales channels →
 * Develop apps → Create an app → Admin API scopes:
 *   read_products, write_products, read_metaobjects, write_metaobjects
 *
 * Nothing is deleted. Re-running adds reviews rather than replacing them, so
 * import each spreadsheet once.
 */

import { readFileSync } from 'node:fs';

const API_VERSION = '2025-01';
const STORE = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run');

if (!STORE || !TOKEN) {
  console.error('Set SHOPIFY_STORE and SHOPIFY_ADMIN_TOKEN first. See the header of this file.');
  process.exit(1);
}

const file = process.argv.find((a) => a.endsWith('.csv'));
if (!file) {
  console.error('Usage: node scripts/import-reviews.mjs reviews.csv [--dry-run]');
  process.exit(1);
}

/* ---------------------------------------------------------------- GraphQL */

async function gql(query, variables = {}) {
  const res = await fetch(`https://${STORE}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN
    },
    body: JSON.stringify({ query, variables })
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));

  // Surface userErrors from whichever mutation ran.
  for (const value of Object.values(json.data ?? {})) {
    if (value && Array.isArray(value.userErrors) && value.userErrors.length) {
      throw new Error(value.userErrors.map((e) => `${e.field}: ${e.message}`).join('\n'));
    }
  }
  return json.data;
}

/* --------------------------------------------------------------- CSV parse */

/** Minimal RFC 4180 parser — handles quoted fields, embedded commas and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }

  const header = rows.shift().map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

/* ------------------------------------------------------- definition set-up */

const DEFINITION = {
  type: 'product_review',
  name: 'Product review',
  fieldDefinitions: [
    { key: 'rating', name: 'Rating', type: 'number_integer' },
    { key: 'author', name: 'Author', type: 'single_line_text_field' },
    { key: 'title', name: 'Title', type: 'single_line_text_field' },
    { key: 'body', name: 'Body', type: 'multi_line_text_field' },
    { key: 'city', name: 'City', type: 'single_line_text_field' },
    { key: 'verified', name: 'Verified purchase', type: 'boolean' },
    { key: 'review_date', name: 'Date', type: 'date' },
    { key: 'images', name: 'Photos', type: 'list.file_reference' }
  ]
};

async function ensureDefinition() {
  const data = await gql(
    `query($type: String!) { metaobjectDefinitionByType(type: $type) { id } }`,
    { type: DEFINITION.type }
  );
  if (data.metaobjectDefinitionByType) {
    console.log('· metaobject definition already exists');
    return;
  }

  console.log('· creating the product_review metaobject definition');
  await gql(
    `mutation($definition: MetaobjectDefinitionCreateInput!) {
       metaobjectDefinitionCreate(definition: $definition) {
         metaobjectDefinition { id }
         userErrors { field message }
       }
     }`,
    {
      definition: {
        type: DEFINITION.type,
        name: DEFINITION.name,
        access: { storefront: 'PUBLIC_READ' },
        fieldDefinitions: DEFINITION.fieldDefinitions.map((f) => ({
          key: f.key,
          name: f.name,
          type: f.type
        }))
      }
    }
  );
}

/* ------------------------------------------------------------------ lookup */

async function productByHandle(handle) {
  const data = await gql(
    `query($handle: String!) {
       productByHandle(handle: $handle) {
         id
         title
         metafield(namespace: "custom", key: "reviews") { value }
       }
     }`,
    { handle }
  );
  return data.productByHandle;
}

/* ------------------------------------------------------------------ import */

const rows = parseCsv(readFileSync(file, 'utf8'));
console.log(`Read ${rows.length} rows from ${file}`);

const required = ['product_handle', 'rating', 'author', 'body'];
const missingCols = required.filter((c) => !(c in (rows[0] ?? {})));
if (missingCols.length) {
  console.error(`Missing required column(s): ${missingCols.join(', ')}`);
  process.exit(1);
}

const byProduct = new Map();
for (const row of rows) {
  const handle = row.product_handle;
  if (!handle) continue;
  if (!byProduct.has(handle)) byProduct.set(handle, []);
  byProduct.get(handle).push(row);
}

console.log(`${byProduct.size} product(s) to update\n`);

if (DRY_RUN) {
  for (const [handle, list] of byProduct) {
    const avg = list.reduce((n, r) => n + Number(r.rating || 0), 0) / list.length;
    console.log(`  ${handle.padEnd(45)} ${String(list.length).padStart(3)} reviews  avg ${avg.toFixed(2)}`);
  }
  console.log('\nDry run — nothing was written.');
  process.exit(0);
}

await ensureDefinition();

let created = 0;
let skipped = 0;

for (const [handle, list] of byProduct) {
  const product = await productByHandle(handle);
  if (!product) {
    console.warn(`  ✗ no product with handle "${handle}" — skipping ${list.length} review(s)`);
    skipped += list.length;
    continue;
  }

  const ids = [];
  for (const row of list) {
    const rating = Math.min(5, Math.max(1, parseInt(row.rating, 10) || 5));
    const fields = [
      { key: 'rating', value: String(rating) },
      { key: 'author', value: row.author || 'Customer' },
      { key: 'body', value: row.body || '' }
    ];
    if (row.title) fields.push({ key: 'title', value: row.title });
    if (row.city) fields.push({ key: 'city', value: row.city });
    if (row.review_date) fields.push({ key: 'review_date', value: row.review_date });
    if (row.verified) {
      fields.push({ key: 'verified', value: /^(y|yes|true|1)$/i.test(row.verified) ? 'true' : 'false' });
    }

    const data = await gql(
      `mutation($metaobject: MetaobjectCreateInput!) {
         metaobjectCreate(metaobject: $metaobject) {
           metaobject { id }
           userErrors { field message }
         }
       }`,
      { metaobject: { type: DEFINITION.type, fields } }
    );
    ids.push(data.metaobjectCreate.metaobject.id);
    created++;
  }

  // Keep any reviews already linked to this product.
  let existing = [];
  try {
    existing = JSON.parse(product.metafield?.value ?? '[]');
  } catch {
    existing = [];
  }
  const all = [...new Set([...existing, ...ids])];

  const ratings = list.map((r) => Math.min(5, Math.max(1, parseInt(r.rating, 10) || 5)));
  const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;

  await gql(
    `mutation($metafields: [MetafieldsSetInput!]!) {
       metafieldsSet(metafields: $metafields) {
         metafields { key }
         userErrors { field message }
       }
     }`,
    {
      metafields: [
        {
          ownerId: product.id,
          namespace: 'custom',
          key: 'reviews',
          type: 'list.metaobject_reference',
          value: JSON.stringify(all)
        },
        {
          ownerId: product.id,
          namespace: 'reviews',
          key: 'rating',
          type: 'rating',
          value: JSON.stringify({ scale_min: '1.0', scale_max: '5.0', value: average.toFixed(1) })
        },
        {
          ownerId: product.id,
          namespace: 'reviews',
          key: 'rating_count',
          type: 'number_integer',
          value: String(all.length)
        }
      ]
    }
  );

  console.log(`  ✓ ${product.title} — ${list.length} review(s), average ${average.toFixed(1)}`);
}

console.log(`\nDone. ${created} review(s) imported${skipped ? `, ${skipped} skipped` : ''}.`);
console.log('Storefront caches for a few minutes — give it a moment before checking the product page.');
