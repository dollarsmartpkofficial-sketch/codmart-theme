/* ==========================================================================
   CODMart — global.js
   No dependencies, no framework. Everything is delegated from `document`
   so markup rendered later (cart drawer, quick add) works without rebinding.
   ========================================================================== */
(function () {
  'use strict';

  var DATA = {};
  try {
    DATA = JSON.parse(document.getElementById('ThemeData').textContent);
  } catch (e) {
    DATA = { routes: {}, strings: {} };
  }
  window.theme = DATA;

  /* ---------- money ---------- */
  /* Something on this store rewrites the AJAX cart response: price comes back
     as the string "2400.00" instead of 240000, and image is dropped entirely.
     Normalise rather than assume — a theme cannot control which apps a
     merchant installs. */
  function toCents(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      var n = parseFloat(value.replace(/[^\d.-]/g, ''));
      return isNaN(n) ? 0 : Math.round(n * 100);
    }
    return 0;
  }
  window.theme.toCents = toCents;

  function formatMoney(cents) {
    var format = DATA.moneyFormat || '{{amount}}';
    var value = (cents / 100).toFixed(
      /no_decimals/.test(format) ? 0 : 2
    );
    // thousands separators
    var parts = value.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    value = parts.join('.');
    return format.replace(/\{\{\s*\w+\s*\}\}/, value);
  }
  window.theme.formatMoney = formatMoney;

  /* ---------- tiny helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function trapFocus(container) {
    var focusable = $$('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])', container);
    if (!focusable.length) return function () {};
    var first = focusable[0], last = focusable[focusable.length - 1];
    function onKey(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    container.addEventListener('keydown', onKey);
    first.focus();
    return function () { container.removeEventListener('keydown', onKey); };
  }

  /* ==========================================================================
     Modals & drawers  —  [data-modal-open="id"] / [data-modal-close]
     ========================================================================== */
  var releaseFocus = null;
  var lastTrigger = null;

  /* The entry transition slides the mobile sheet up from a full card-height
     below the fold. Transitions only advance while the page paints, so a tab
     that stops compositing — a backgrounded browser, a throttled in-app
     webview — holds that opening frame forever, leaving the sheet off screen
     with its Checkout button unreachable and nothing on screen to explain why.

     Timers keep running when frames do not, so once the entry is due the
     resting position is asserted outright. If the transition did play, this
     changes nothing; if it never started, the dialog snaps where it belongs. */
  var settleTimer = null;

  function settleDialog(modal) {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () {
      if (!modal.classList.contains('is-open')) return;
      var card = modal.querySelector('.modal__card');
      if (card) card.classList.add('is-settled');
    }, 300);
  }

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('is-open');
    /* The markup ships inert so a closed dialog full of links is not in the
       tab order. Opening has to lift it, or nothing inside can be clicked. */
    modal.removeAttribute('inert');
    document.body.style.overflow = 'hidden';
    releaseFocus = trapFocus(modal);
    settleDialog(modal);
  }

  function closeModal(modal) {
    modal = modal || $('.modal.is-open');
    if (!modal) return;
    clearTimeout(settleTimer);
    modal.classList.remove('is-open');
    modal.setAttribute('inert', '');
    var card = modal.querySelector('.modal__card');
    if (card) card.classList.remove('is-settled');
    document.body.style.overflow = '';
    if (releaseFocus) { releaseFocus(); releaseFocus = null; }
    if (lastTrigger) { lastTrigger.focus(); lastTrigger = null; }
  }
  window.theme.openModal = openModal;
  window.theme.closeModal = closeModal;

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-modal-open]');
    if (opener) {
      e.preventDefault();
      lastTrigger = opener;
      openModal(opener.getAttribute('data-modal-open'));
      return;
    }
    if (e.target.closest('[data-modal-close]') || e.target.classList.contains('modal__overlay')) {
      closeModal(e.target.closest('.modal'));
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  /* ==========================================================================
     Quantity steppers  —  [data-qty] wrapper with [data-qty-minus/plus]
     ========================================================================== */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-qty-minus],[data-qty-plus]');
    if (!btn) return;
    var input = $('input', btn.closest('[data-qty]'));
    if (!input) return;
    var min = parseInt(input.min || '1', 10);
    var max = input.max ? parseInt(input.max, 10) : Infinity;
    var next = (parseInt(input.value, 10) || min) + (btn.hasAttribute('data-qty-plus') ? 1 : -1);
    input.value = Math.min(max, Math.max(min, next));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  /* ==========================================================================
     Facets (mobile filter drawer)
     ========================================================================== */
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-facets-open]')) {
      var f = $('.facets');
      if (f) { f.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
    }
    if (e.target.closest('[data-facets-close]')) {
      var g = $('.facets');
      if (g) { g.classList.remove('is-open'); document.body.style.overflow = ''; }
    }
  });

  /* Sort dropdown submits its form without a separate button. */
  document.addEventListener('change', function (e) {
    if (e.target.matches('[data-auto-submit]')) e.target.form.submit();
  });

  /* ==========================================================================
     Add to cart (AJAX)
     ========================================================================== */
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[action*="/cart/add"]');
    if (!form) return;
    e.preventDefault();

    var btn = $('[type="submit"]', form);
    var original = btn ? btn.innerHTML : '';
    if (btn) { btn.setAttribute('aria-disabled', 'true'); btn.innerHTML = '…'; }

    fetch(DATA.routes.cart_add, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: new FormData(form)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.status) throw new Error(res.description || res.message);
        /* The image on the page is more reliable than the one in the response,
           which some apps strip. `featured_image` arrives as an object, not a
           string, so pull the url out rather than stringifying it into
           "[object Object]". */
        function urlOf(v) {
          if (typeof v === 'string') return v;
          if (v && typeof v.url === 'string') return v.url;
          if (v && typeof v.src === 'string') return v.src;
          return '';
        }
        /* On a product page the gallery is a sibling of the form's container,
           not inside it, so fall back to the page before giving up. */
        var card = form.closest('.card');
        var shot = (card && card.querySelector('.card__media img')) ||
                   document.querySelector('[data-gallery-main] img');
        res.__image = urlOf(res.image) || urlOf(res.featured_image) ||
                      (shot ? shot.currentSrc || shot.src : '');
        document.dispatchEvent(new CustomEvent('cart:added', { detail: res }));
        refreshCartCount();
        if (btn) btn.innerHTML = DATA.strings.addedToCart || 'Added';
        setTimeout(function () {
          if (btn) { btn.innerHTML = original; btn.removeAttribute('aria-disabled'); }
        }, 1600);
      })
      .catch(function (err) {
        if (btn) { btn.innerHTML = original; btn.removeAttribute('aria-disabled'); }
        console.error('[cart]', err);
      });
  });

  /* ==========================================================================
     Added-to-cart confirmation. Keeps the shopper on the page they were
     browsing — being bounced to /cart after every add is how a five-item
     basket turns into a one-item one.
     ========================================================================== */
  document.addEventListener('cart:added', function (e) {
    var note = document.getElementById('CartNotification');
    var item = e.detail;
    if (!note || !item) return;

    var img = $('[data-note-image]', note);
    var src = item.__image || (typeof item.image === 'string' ? item.image : '');
    if (img && src) {
      /* The card's src already carries a width for its own size; strip it so
         the thumbnail asks for 128 rather than downloading the 500 twice. */
      var clean = src.replace(/([?&])width=\d+&?/g, '$1').replace(/[?&]$/, '');
      img.src = clean.indexOf('?') > -1 ? clean + '&width=160' : clean + '?width=160';
      img.alt = item.product_title || '';
      img.hidden = false;
    } else if (img) {
      img.hidden = true;
    }

    var title = $('[data-note-title]', note);
    if (title) title.textContent = item.product_title || item.title || '';

    var variant = $('[data-note-variant]', note);
    if (variant) {
      var bits = [];
      if (item.variant_title && item.variant_title !== 'Default Title') bits.push(item.variant_title);
      /* The price below is the whole line, so say how many it covers. */
      if (item.quantity > 1) bits.push('Qty ' + item.quantity);
      variant.textContent = bits.join(' · ');
      variant.hidden = bits.length === 0;
    }

    var price = $('[data-note-price]', note);
    if (price) {
      var line = item.final_line_price != null ? item.final_line_price
               : item.line_price != null ? item.line_price
               : item.original_line_price != null ? item.original_line_price
               : item.price;
      price.textContent = formatMoney(toCents(line));
    }

    /* Totals come from the cart, not the line just added. */
    fetch(DATA.routes.cart + '.js', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var count = $('[data-note-count]', note);
        var sub = $('[data-note-subtotal]', note);
        if (count) {
          var word = cart.item_count === 1 ? 'item' : 'items';
          count.textContent = cart.item_count + ' ' + word + ' in cart';
        }
        if (sub) sub.textContent = formatMoney(toCents(cart.total_price));
      })
      .catch(function () {});

    openModal('CartNotification');
  });

  function refreshCartCount() {
    fetch(DATA.routes.cart + '.js', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        $$('[data-cart-count]').forEach(function (el) {
          el.textContent = cart.item_count;
          el.hidden = cart.item_count === 0;
        });
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
      });
  }

  /* ==========================================================================
     Product gallery — thumbnail switching without a carousel library
     ========================================================================== */
  document.addEventListener('click', function (e) {
    var thumb = e.target.closest('[data-gallery-thumb]');
    if (!thumb) return;
    var gallery = thumb.closest('[data-gallery]');
    var main = $('[data-gallery-main] img', gallery);
    var img = $('img', thumb);
    if (!main || !img) return;
    main.src = img.getAttribute('data-full') || img.src;
    main.srcset = '';
    main.alt = img.alt;
    $$('[data-gallery-thumb]', gallery).forEach(function (t) { t.setAttribute('aria-current', 'false'); });
    thumb.setAttribute('aria-current', 'true');
  });

  /* ==========================================================================
     Collection banner — unclamp the SEO description on demand.
     ========================================================================== */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-desc-toggle]');
    if (!btn) return;
    var desc = $('[data-collection-desc]');
    if (!desc) return;
    desc.classList.toggle('collection-banner__desc--full');
    btn.hidden = desc.classList.contains('collection-banner__desc--full');
  });

  /* ==========================================================================
     Hero — take turns between the emoji in the ring.
     ========================================================================== */
  (function () {
    var blob = $('[data-hero-emoji]');
    if (!blob) return;

    var faces = $$('.hero__emoji', blob);
    if (faces.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!document.body.classList.contains('animations-on')) return;

    var wait = (parseInt(blob.dataset.interval, 10) || 3) * 1000;
    var i = 0;
    var timer;

    function step() {
      faces[i].classList.remove('is-active');
      i = (i + 1) % faces.length;
      faces[i].classList.add('is-active');
    }

    function start() { timer = setInterval(step, wait); }
    function stop() { clearInterval(timer); }

    start();
    /* Nothing to animate while the tab is in the background. */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });
  })();

  /* ==========================================================================
     Order tracking — pack what the shopper typed into a WhatsApp message.
     ========================================================================== */
  (function () {
    var box = $('[data-order-tracking]');
    if (!box) return;

    var btn = $('[data-tracking-submit]', box);
    var error = $('[data-tracking-error]', box);
    if (!btn) return;

    btn.addEventListener('click', function () {
      var order = ($('[name="order"]', box) || {}).value || '';
      var phone = ($('[name="phone"]', box) || {}).value || '';
      order = order.trim();
      phone = phone.trim();

      /* One of the two is enough — plenty of shoppers only remember one. */
      if (!order && !phone) {
        if (error) error.hidden = false;
        var first = $('input', box);
        if (first) first.focus();
        return;
      }
      if (error) error.hidden = true;

      var message = (box.dataset.template || '')
        .replace('[order]', order)
        .replace('[phone]', phone)
        /* Drop the label of whichever field was left empty. */
        .split('\n')
        .filter(function (line) { return !/^[^:]{1,20}:\s*$/.test(line.trim()); })
        .join('\n');

      window.open(
        'https://wa.me/' + box.dataset.number + '?text=' + encodeURIComponent(message),
        '_blank',
        'noopener'
      );
    });

    box.addEventListener('input', function () {
      if (error) error.hidden = true;
    });
  })();

  /* ==========================================================================
     Reviews — reveal the rest of the list on demand. They are all in the DOM
     already (good for SEO), just hidden, so this is a class toggle rather
     than a fetch.
     ========================================================================== */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-reviews-more]');
    if (!btn) return;
    $$('[data-review-hidden]').forEach(function (el) {
      el.hidden = false;
      el.removeAttribute('data-review-hidden');
    });
    btn.remove();
  });

  /* ==========================================================================
     Product recommendations — fetched after load so they never block the
     product page itself.
     ========================================================================== */
  (function () {
    var holder = $('[data-recommendations]');
    if (!holder) return;
    fetch(holder.dataset.url)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var fresh = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-recommendations]');
        if (fresh) holder.innerHTML = fresh.innerHTML;
      })
      .catch(function () {});
  })();

  /* ==========================================================================
     Announcement bar — messages sit side by side on desktop and take turns
     on narrow screens, where there is no room for all of them.
     ========================================================================== */
  (function () {
    var track = $('[data-announcement-track]');
    if (!track) return;
    var items = $$('.announcement__item', track);
    if (items.length < 2) return;

    var speed = (parseInt(track.getAttribute('data-rotate'), 10) || 4) * 1000;
    var mq = window.matchMedia('(max-width: 767px)');
    var timer = null;
    var index = 0;

    function show(i) {
      items.forEach(function (el, n) { el.classList.toggle('is-active', n === i); });
    }

    function start() {
      show(0);
      index = 0;
      timer = setInterval(function () {
        index = (index + 1) % items.length;
        show(index);
      }, speed);
    }

    function stop() {
      clearInterval(timer);
      timer = null;
      items.forEach(function (el) { el.classList.remove('is-active'); });
    }

    function sync() {
      stop();
      if (mq.matches) start();
    }

    sync();
    mq.addEventListener('change', sync);
  })();

  /* ==========================================================================
     Header — shadow once the page has scrolled
     ========================================================================== */
  var lastY = 0;
  var header = $('.header');
  if (header && document.body.classList.contains('sticky-header')) {
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 40);
      lastY = y;
    }, { passive: true });
  }
})();
