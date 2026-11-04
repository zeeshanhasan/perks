/* Tofo Perks: Employee mode. Cosmetic only; checkout enforcement happens in Shopify Functions. */
(function () {
 function employeePrice(cents, pr) {
  if (pr.type === "fixed") {
   if (!pr.sameCurrency) return null; // fixed amounts are in the shop currency only
   return Math.max(0, cents - Math.round(pr.value * 100));
  }
  return Math.round((cents * (100 - pr.value)) / 100);
 }
 function formatMoney(cents, format) {
  var fmt = format || "{{amount}}";
  function num(n, decimals, thousands, dec) {
   var fixed = (n / 100).toFixed(decimals);
   var parts = fixed.split(".");
   parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
   return parts[1] ? parts[0] + dec + parts[1] : parts[0];
  }
  return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, function (_, k) {
   switch (k) {
    case "amount_no_decimals": return num(cents, 0, ",", ".");
    case "amount_with_comma_separator": return num(cents, 2, ".", ",");
    case "amount_no_decimals_with_comma_separator": return num(cents, 0, ".", ",");
    case "amount_with_apostrophe_separator": return num(cents, 2, "'", ".");
    case "amount_with_space_separator": return num(cents, 2, " ", ",");
    default: return num(cents, 2, ",", ".");
   }
  });
 }
 window.TofoPerksPrice = { employeePrice: employeePrice, formatMoney: formatMoney };
 var P = window.TofoPerks;
 if (!P) return;
 var DEBUG = /[?&]perks_debug=1/.test(location.search);
 function debug() { if (DEBUG) console.log.apply(console, ["[Employee Perks]"].concat([].slice.call(arguments))); }
 debug("state", { eligible: P.eligible, enabled: P.enabled, product: P.product, price: P.price });
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
  el.textContent = (P.text.badge || "Employee discount: {discount} applied at checkout").replace("{discount}", P.discountLabel).replace("{percent}%", P.discountLabel);
  form.parentNode.insertBefore(el, form);
 }
 var PRICE_SELS = ['[id^="price-template"] .price', ".product__info-container .price", ".product__info-wrapper .price", ".product-single__price", ".product__price", "[data-product-price]", "main .price"];
 function findProductPrice() {
  for (var i = 0; i < PRICE_SELS.length; i++) {
   var el = document.querySelector(PRICE_SELS[i]);
   if (el) return el;
  }
  return null;
 }
 function canShowPrice() {
  return P.eligible && P.enabled && P.price && P.price.show && !(P.price.type === "fixed" && !P.price.sameCurrency);
 }
 function label(cents) {
  var pr = P.price;
  var off = pr.type === "fixed" ? P.discountLabel : pr.value + "% off";
  return { price: formatMoney(employeePrice(cents, pr), pr.format), off: off };
 }
 function currentVariant() {
  var input = document.querySelector('form[action*="/cart/add"] [name="id"]');
  var id = input && input.value ? input.value : new URLSearchParams(location.search).get("variant");
  return id && P.product.prices[id] != null ? id : String(P.product.variant);
 }
 function renderProductPrice() {
  var cents = P.product.prices[currentVariant()];
  if (cents == null) return false;
  var priceEl = findProductPrice();
  var form = document.querySelector(BUY);
  if (!priceEl && !form) return false;
  var el = document.getElementById("tofo-perks-price");
  if (!el) {
   el = document.createElement("div");
   el.id = "tofo-perks-price";
   el.className = "tofo-perks-price";
  }
  var l = label(cents);
  el.textContent = "";
  el.appendChild(document.createTextNode(P.price.text + " "));
  var strong = document.createElement("strong");
  strong.textContent = l.price;
  var tag = document.createElement("span");
  tag.textContent = l.off;
  el.appendChild(strong);
  el.appendChild(tag);
  if (priceEl) {
   if (el.previousElementSibling !== priceEl) priceEl.insertAdjacentElement("afterend", el);
   if (P.price.strike) priceEl.classList.add("tofo-perks-strike");
  } else if (el.nextElementSibling !== form) {
   form.parentNode.insertBefore(el, form);
  }
  debug("employee price shown", { variant: currentVariant(), cents: cents, priceEl: Boolean(priceEl) });
  return true;
 }
 function watchProductPrice() {
  var pending = false;
  function again() {
   if (pending) return;
   pending = true;
   setTimeout(function () { pending = false; renderProductPrice(); }, 50);
  }
  document.addEventListener("change", again, true);
  new MutationObserver(function () {
   var priceEl = findProductPrice();
   if (!document.getElementById("tofo-perks-price") || (P.price.strike && priceEl && !priceEl.classList.contains("tofo-perks-strike"))) again();
  }).observe(document.body, { childList: true, subtree: true });
 }
 var productJson = {};
 function fetchProduct(handle) {
  if (!productJson[handle])
   productJson[handle] = fetch("/products/" + encodeURIComponent(handle) + ".js", { credentials: "same-origin" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; });
  return productJson[handle];
 }
 function cardEligible(handle) {
  var pr = P.price;
  return pr.all || pr.collection || pr.handles.indexOf(handle) !== -1 || pr.mine.indexOf(handle) !== -1;
 }
 function priceCards(root) {
  if (!canShowPrice()) return;
  (root || document).querySelectorAll('a[href*="/products/"]').forEach(function (a) {
   if (a.dataset.tofoPrice) return;
   a.dataset.tofoPrice = "1";
   var h = handleOf(a);
   if (!h || h === (P.product.handle || "").toLowerCase() && P.product.isProductPage && !a.closest(CARD)) return;
   if (!cardEligible(h)) return;
   var card = a.closest(CARD);
   if (!card || card.querySelector(".tofo-perks-card-price") || card.dataset.tofoPriced) return;
   card.dataset.tofoPriced = "1";
   fetchProduct(h).then(function (p) {
    if (!p || P.price.excluded.indexOf(String(p.id)) !== -1) return;
    var priceEl = card.querySelector(".price, [class*='price']");
    if (!priceEl) return;
    var l = label(p.price_min != null ? p.price_min : p.price);
    var el = document.createElement("span");
    el.className = "tofo-perks-card-price";
    el.textContent = (p.price_varies ? "From " : "") + P.price.text + " " + l.price;
    priceEl.insertAdjacentElement("afterend", el);
   });
  });
 }
 function productPage() {
  if (!P.product.isProductPage) return;
  var form = document.querySelector(BUY);
  if (!form) return;
  var blocked = P.product.handle && P.hiddenHashes.length && window.crypto && crypto.subtle
   ? sha256(P.product.handle.toLowerCase()).then(function (d) { return P.hiddenHashes.indexOf(d) !== -1; })
   : Promise.resolve(false);
  blocked.then(function (isBlocked) {
   debug("product page", { blocked: isBlocked, discounted: P.product.discounted, canShowPrice: canShowPrice() });
   if (isBlocked) notice(form);
   else if (P.eligible && P.enabled && P.product.discounted) {
    if (canShowPrice() && renderProductPrice()) watchProductPrice();
    else badge(form);
   }
  });
 }
 function run(root) { hideCards(root); hideCollectionLinks(root); priceCards(root); }
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
