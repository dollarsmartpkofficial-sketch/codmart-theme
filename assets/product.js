/* ==========================================================================
   Product page — variant switching and the sticky buy bar.
   ========================================================================== */
(function () {
  'use strict';

  var info = document.querySelector('[data-product-info]');
  if (!info) return;

  /* Resolved per call, not once at load: section scripts and global.js are all
     deferred, so load order depends on where each <script> sits in the page. */
  function money(cents) {
    var fn = window.theme && window.theme.formatMoney;
    return fn ? fn(cents) : (cents / 100).toFixed(2);
  }

  function strings() {
    return (window.theme && window.theme.strings) || {};
  }

  var variants = [];
  try {
    variants = JSON.parse(document.querySelector('[data-product-json]').textContent);
  } catch (e) {
    return;
  }

  var picker = info.querySelector('[data-variant-picker]');
  var variantInput = info.querySelector('[data-variant-input]');
  var addButton = info.querySelector('[data-add-button]');
  var addLabel = info.querySelector('[data-add-label]');
  var priceWrap = info.querySelector('[data-price-wrap]');
  var stickyPrice = document.querySelector('[data-sticky-price]');

  /* ---------- variant selection ---------- */
  function selectedOptions() {
    return Array.prototype.slice
      .call(picker.querySelectorAll('.variant-input:checked'))
      .sort(function (a, b) { return a.dataset.position - b.dataset.position; })
      .map(function (input) { return input.value; });
  }

  function findVariant(options) {
    return variants.find(function (v) {
      return options.every(function (value, i) { return v.options[i] === value; });
    });
  }

  function renderPrice(variant) {
    if (!priceWrap) return;
    var html = '<span class="price">' + money(variant.price) + '</span>';
    if (variant.compare_at_price && variant.compare_at_price > variant.price) {
      html += '<s class="price--old">' + money(variant.compare_at_price) + '</s>';
      html += '<span class="price--save">' + money(variant.compare_at_price - variant.price) + '</span>';
    }
    priceWrap.innerHTML = html;
    if (stickyPrice) stickyPrice.textContent = money(variant.price);
  }

  function showMedia(variant) {
    if (!variant.featured_media) return;
    var thumb = document.querySelector('[data-media-id="' + variant.featured_media.id + '"]');
    if (thumb) thumb.click();
  }

  function markUnavailable(options) {
    /* Grey out option values that can't be combined with the current choice. */
    picker.querySelectorAll('.variant-input').forEach(function (input) {
      var pos = parseInt(input.dataset.position, 10) - 1;
      var test = options.slice();
      test[pos] = input.value;
      var match = variants.find(function (v) {
        return test.every(function (value, i) { return v.options[i] === value; });
      });
      var label = picker.querySelector('label[for="' + input.id + '"]');
      if (label) label.classList.toggle('variant-value--unavailable', !match || !match.available);
    });
  }

  function update() {
    var options = selectedOptions();
    var variant = findVariant(options);

    markUnavailable(options);

    picker.querySelectorAll('[data-option-value]').forEach(function (el, i) {
      if (options[i]) el.textContent = options[i];
    });

    if (!variant) {
      if (addButton) { addButton.disabled = true; }
      if (addLabel) addLabel.textContent = strings().unavailable || 'Unavailable';
      return;
    }

    if (variantInput) variantInput.value = variant.id;
    if (addButton) addButton.disabled = !variant.available;
    if (addLabel) addLabel.textContent = variant.available ? (strings().addToCart || 'Add to cart') : (strings().soldOut || 'Sold out');

    renderPrice(variant);
    showMedia(variant);

    var url = new URL(window.location);
    url.searchParams.set('variant', variant.id);
    window.history.replaceState({}, '', url);

    document.dispatchEvent(new CustomEvent('variant:changed', { detail: { variant: variant } }));
  }

  if (picker) {
    picker.addEventListener('change', function (e) {
      if (e.target.classList.contains('variant-input')) update();
    });
    markUnavailable(selectedOptions());
  }

  /* ---------- sticky buy bar ---------- */
  var sticky = document.querySelector('[data-sticky-atc]');
  var anchor = info.querySelector('.buys') || info.querySelector('[data-cod-slot]');

  if (sticky && anchor && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      function (entries) {
        sticky.hidden = entries[0].isIntersecting;
      },
      { rootMargin: '0px 0px -40px 0px' }
    ).observe(anchor);
  }
})();
