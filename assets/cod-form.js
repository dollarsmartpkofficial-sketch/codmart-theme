/* ==========================================================================
   COD quick order form

   Collects the shopper's details, then hands them to Shopify's checkout via
   a cart permalink with the address pre-filled. The order is created by
   Shopify itself — this file never touches an API or stores anything.
   ========================================================================== */
(function () {
  'use strict';

  var form = document.querySelector('[data-cod-form]');
  if (!form) return;

  var money = (window.theme && window.theme.formatMoney) || function (c) { return (c / 100).toFixed(2); };

  var unitPrice = parseInt(form.dataset.variantPrice, 10) || 0;
  var variantId = form.dataset.variantId;
  var freeThreshold = parseInt(form.dataset.freeThreshold, 10) || 0;
  var shipRate = parseInt(form.dataset.shipRate, 10) || 0;

  var state = { qty: 1, discount: 0 };

  /* ---------- offers ---------- */
  var offers = Array.prototype.slice.call(form.querySelectorAll('[data-cod-offer]'));

  offers.forEach(function (btn) {
    if (btn.getAttribute('aria-checked') === 'true') {
      state.qty = parseInt(btn.dataset.qty, 10) || 1;
      state.discount = parseInt(btn.dataset.discount, 10) || 0;
    }
    btn.addEventListener('click', function () {
      offers.forEach(function (b) { b.setAttribute('aria-checked', 'false'); });
      btn.setAttribute('aria-checked', 'true');
      state.qty = parseInt(btn.dataset.qty, 10) || 1;
      state.discount = parseInt(btn.dataset.discount, 10) || 0;
      renderSummary();
    });
  });

  /* ---------- summary ---------- */
  var el = {
    line: form.querySelector('[data-summary-line]'),
    price: form.querySelector('[data-summary-price]'),
    discountRow: form.querySelector('[data-summary-discount]'),
    discountValue: form.querySelector('[data-summary-discount-value]'),
    shippingRow: form.querySelector('[data-summary-shipping]'),
    shippingValue: form.querySelector('[data-summary-shipping-value]'),
    total: form.querySelector('[data-summary-total]')
  };

  function totals() {
    var full = unitPrice * state.qty;
    var discount = Math.round((full * state.discount) / 100);
    var subtotal = full - discount;
    var shipping = freeThreshold > 0 && subtotal >= freeThreshold ? 0 : shipRate;
    return { full: full, discount: discount, subtotal: subtotal, shipping: shipping, total: subtotal + shipping };
  }

  function renderSummary() {
    var t = totals();

    if (el.line) el.line.textContent = el.line.textContent.replace(/^\d+\s*×/, state.qty + ' ×');
    if (el.price) el.price.textContent = money(t.full);

    if (el.discountRow) {
      el.discountRow.hidden = t.discount === 0;
      if (el.discountValue) el.discountValue.textContent = '− ' + money(t.discount);
    }

    if (el.shippingRow) {
      el.shippingRow.classList.toggle('order-summary__row--free', t.shipping === 0);
      if (el.shippingValue) {
        el.shippingValue.textContent = t.shipping === 0
          ? (window.theme.strings.shippingFree || 'FREE')
          : money(t.shipping);
      }
    }

    if (el.total) el.total.textContent = money(t.total);
  }

  /* ---------- validation ---------- */
  function fieldOf(input) { return input.closest('.field'); }

  function setError(input, on) {
    var wrap = fieldOf(input);
    if (!wrap) return;
    wrap.classList.toggle('has-error', on);
    var msg = wrap.querySelector('.error');
    if (msg) msg.hidden = !on;
    input.setAttribute('aria-invalid', on ? 'true' : 'false');
  }

  function validate() {
    var ok = true;
    var firstBad = null;

    form.querySelectorAll('input[required], select[required], textarea[required]').forEach(function (input) {
      var value = input.value.trim();
      var bad = value === '';

      if (!bad && input.name === 'phone') {
        // Accept local (03001234567) and international (+92 300 1234567) forms.
        bad = value.replace(/[^\d]/g, '').length < 10;
      }

      setError(input, bad);
      if (bad) { ok = false; firstBad = firstBad || input; }
    });

    var email = form.querySelector('input[name="email"]');
    if (email && email.value.trim() !== '') {
      var badEmail = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());
      setError(email, badEmail);
      if (badEmail) { ok = false; firstBad = firstBad || email; }
    }

    if (firstBad) firstBad.focus();
    return ok;
  }

  /* Clear the error as soon as the shopper starts fixing it. */
  form.addEventListener('input', function (e) {
    if (e.target.matches('input, select, textarea')) {
      var wrap = fieldOf(e.target);
      if (wrap && wrap.classList.contains('has-error')) setError(e.target, false);
    }
  });

  /* ---------- checkout ---------- */
  function value(name) {
    var input = form.querySelector('[name="' + name + '"]');
    return input ? input.value.trim() : '';
  }

  function buildCheckoutUrl() {
    var name = value('name');
    var parts = name.split(/\s+/);
    var first = parts.shift() || '';
    var last = parts.join(' ') || first;

    var params = [];
    function add(key, val) {
      if (val) params.push(encodeURIComponent(key) + '=' + encodeURIComponent(val));
    }

    add('checkout[shipping_address][first_name]', first);
    add('checkout[shipping_address][last_name]', last);
    add('checkout[shipping_address][address1]', value('address'));
    add('checkout[shipping_address][city]', value('city'));
    add('checkout[shipping_address][phone]', value('phone'));
    add('checkout[email]', value('email'));

    // Tags the order so the merchant can see it came from this form.
    add('attributes[Order Source]', 'COD Quick Form');
    add('attributes[Phone]', value('phone'));
    add('attributes[City]', value('city'));
    if (value('notes')) add('note', value('notes'));

    return '/cart/' + variantId + ':' + state.qty + '?' + params.join('&');
  }

  var submit = form.querySelector('[data-cod-submit]');
  if (submit) {
    submit.addEventListener('click', function () {
      if (!validate()) return;
      submit.setAttribute('aria-disabled', 'true');
      window.location.href = buildCheckoutUrl();
    });
  }

  /* Keep the form in sync when the shopper switches variant. */
  document.addEventListener('variant:changed', function (e) {
    if (!e.detail || !e.detail.variant) return;
    variantId = e.detail.variant.id;
    unitPrice = e.detail.variant.price;
    form.dataset.variantId = variantId;
    renderSummary();
  });

  renderSummary();
})();
