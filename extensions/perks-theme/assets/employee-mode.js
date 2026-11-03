/* Tofo Perks: Employee mode. Cosmetic only; checkout enforcement happens in Shopify Functions. */
(function () {
  var P = window.TofoPerks;
  if (!P) return;

  var CARD = "li, .grid__item, .card-wrapper, .product-card, .product-item, .predictive-search__list-item";
  var BUY = 'form[action*="/cart/add"], product-form, .product-form, .shopify-payment-button, .product-form__buttons';

  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  var cache = {};
  function sha256(s) {
    if (!cache[s]) cache[s] = crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(hex);
    return cache[s];
  }
  function handleOf(a) {
    try {
      var m = new URL(a.href, location.origin).pathname.match(/\/products\/([^/?#]+)/);
      return m ? decodeURIComponent(m[1]).toLowerCase() : null;
    } catch (e) { return null; }
  }

  function hideCards(root) {
    if (!P.hideProducts || !P.hiddenHashes.length || !window.crypto || !crypto.subtle) return;
    var links = (root || document).querySelectorAll('a[href*="/products/"]');
    links.forEach(function (a) {
      if (a.dataset.tofoChecked) return;
      a.dataset.tofoChecked = "1";
      var h = handleOf(a);
      if (!h) return;
      sha256(h).then(function (d) {
        if (P.hiddenHashes.indexOf(d) === -1) return;
        var card = a.closest(CARD) || a;
        card.classList.add("tofo-perks-hidden");
      });
    });
  }

  function hideCollectionLinks(root) {
    if (P.eligible || !P.hideCollection) return;
    var sel = 'a[href$="/collections/' + P.hideCollection + '"], a[href*="/collections/' + P.hideCollection + '?"]';
    (root || document).querySelectorAll(sel).forEach(function (a) {
      (a.closest("li") || a).classList.add("tofo-perks-hidden");
    });
  }

  function notice(form) {
    document.querySelectorAll(BUY).forEach(function (el) { el.classList.add("tofo-perks-hidden"); });
    var note = document.createElement("div");
    note.className = "tofo-perks-note";
    var t = document.createElement("strong");
    t.textContent = P.text.title;
    var b = document.createElement("p");
    b.textContent = P.text.body;
    var a = document.createElement("a");
    a.className = "button button--primary";
    a.href = P.verifyUrl;
    a.textContent = P.text.cta;
    note.appendChild(t); note.appendChild(b); note.appendChild(a);
    form.parentNode.insertBefore(note, form);
  }

  function badge(form) {
    var el = document.createElement("div");
    el.className = "tofo-perks-badge";
    el.textContent = P.text.badge.replace("{discount}", P.discountLabel).replace("{percent}%", P.discountLabel);
    form.parentNode.insertBefore(el, form);
  }

  function productPage() {
    if (!P.product.isProductPage) return;
    var form = document.querySelector(BUY);
    if (!form) return;
    var blocked = P.product.handle && P.hiddenHashes.length && window.crypto && crypto.subtle
      ? sha256(P.product.handle.toLowerCase()).then(function (d) { return P.hiddenHashes.indexOf(d) !== -1; })
      : Promise.resolve(false);
    blocked.then(function (isBlocked) {
      if (isBlocked) notice(form);
      else if (P.eligible && P.enabled && P.product.discounted && P.text.badge) badge(form);
    });
  }

  function run(root) { hideCards(root); hideCollectionLinks(root); }

  function start() {
    run(document);
    productPage();
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) { if (n.nodeType === 1) run(n); });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
