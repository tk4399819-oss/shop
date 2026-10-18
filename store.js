(function () {
  const $ = s => document.querySelector(s);
  const app = $('#app');
  let S = DB.settings();
  let coupon = null; // applied discount
  const state = { q: '', sort: 'new' };

  /* ---------- helpers ---------- */
  const activeProducts = () => DB.products().filter(p => p.status === 'active');
  const getP = id => DB.products().find(p => p.id === id);
  const cartItems = () => DB.cart().map(c => ({ ...c, p: getP(c.id) })).filter(c => c.p && c.p.status === 'active');
  const calc = () => {
    const items = cartItems();
    const subtotal = items.reduce((a, c) => a + c.p.price * c.qty, 0);
    let discount = 0;
    if (coupon) discount = coupon.type === 'percent' ? Math.round(subtotal * coupon.value) / 100 : Math.min(coupon.value, subtotal);
    const after = subtotal - discount;
    const shipping = !items.length || after >= S.freeShipping ? 0 : S.shipping;
    return { items, subtotal, discount, shipping, total: after + shipping };
  };
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }
  function applyBrand() {
    S = DB.settings();
    document.documentElement.style.setProperty('--accent', S.accent);
    document.title = S.name;
    $('#logo').textContent = S.name; $('#fName').textContent = S.name; $('#fTag').textContent = S.tagline;
    $('#announce').textContent = S.announcement; $('#announce').style.display = S.announcement ? '' : 'none';
    $('#fMail').textContent = S.email; $('#fMail').href = 'mailto:' + S.email;
    $('#fPhone').textContent = S.phone; $('#fPhone').href = 'tel:' + S.phone.replace(/\s/g, '');
    $('#fCopy').textContent = '© ' + new Date().getFullYear() + ' ' + S.name;
  }

  /* ---------- cart ---------- */
  function addToCart(id, qty = 1, open = true) {
    const p = getP(id); if (!p || p.stock <= 0) return toast('Sorry, this item is sold out');
    const cart = DB.cart(); const ex = cart.find(c => c.id === id);
    const want = (ex ? ex.qty : 0) + qty;
    if (want > p.stock) { toast('Only ' + p.stock + ' left in stock'); return; }
    if (ex) ex.qty = want; else cart.push({ id, qty });
    DB.saveCart(cart); renderCart(); if (open) openCart(); else toast('Added to cart');
  }
  function setQty(id, qty) {
    let cart = DB.cart(); const p = getP(id);
    if (qty <= 0) cart = cart.filter(c => c.id !== id);
    else { if (p && qty > p.stock) { toast('Only ' + p.stock + ' left'); return; } cart.find(c => c.id === id).qty = qty; }
    DB.saveCart(cart); renderCart(); if (location.hash.startsWith('#/checkout')) route();
  }
  const openCart = () => { $('#drawer').classList.add('open'); $('#overlay').classList.add('open'); };
  const closeCart = () => { $('#drawer').classList.remove('open'); $('#overlay').classList.remove('open'); };
  function renderCart() {
    const c = calc();
    $('#cartCount').textContent = c.items.reduce((a, i) => a + i.qty, 0);
    $('#cartBody').innerHTML = c.items.length ? c.items.map(i => `
      <div class="line">
        <a class="thumb" href="#/product/${i.p.id}">${productImg(i.p)}</a>
        <div><b>${esc(i.p.title)}</b><span style="font-size:13px;color:var(--muted)">${money(i.p.price)}</span>
          <div style="margin-top:6px"><div class="qty"><button data-dec="${i.p.id}">−</button><span>${i.qty}</span><button data-inc="${i.p.id}">+</button></div></div></div>
        <div style="text-align:right"><b>${money(i.p.price * i.qty)}</b><br><button class="link" data-rm="${i.p.id}">Remove</button></div>
      </div>`).join('') : `<div class="empty"><div class="e">🛒</div><p>Your cart is empty</p><a class="btn" href="#/shop" data-close>Start shopping</a></div>`;
    const left = Math.max(0, S.freeShipping - (c.subtotal - c.discount));
    $('#cartFoot').style.display = c.items.length ? '' : 'none';
    $('#cartFoot').innerHTML = `
      ${left > 0 ? `<p style="font-size:13px;color:var(--muted);margin:0 0 8px">Add ${money(left)} more for free shipping</p>` : `<p style="font-size:13px;color:var(--accent);margin:0 0 8px">🎉 You've unlocked free shipping</p>`}
      <div class="sum t"><span>Subtotal</span><span>${money(c.subtotal)}</span></div>
      <a class="btn block" style="margin-top:12px" href="#/checkout" data-close>Checkout</a>`;
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-inc],[data-dec],[data-rm],[data-add],[data-close]'); if (!t) return;
    if (t.dataset.inc) { const i = DB.cart().find(c => c.id === t.dataset.inc); setQty(t.dataset.inc, i.qty + 1); }
    else if (t.dataset.dec) { const i = DB.cart().find(c => c.id === t.dataset.dec); setQty(t.dataset.dec, i.qty - 1); }
    else if (t.dataset.rm) setQty(t.dataset.rm, 0);
    else if (t.dataset.add) { e.preventDefault(); addToCart(t.dataset.add); }
    else if (t.hasAttribute('data-close')) closeCart();
  });
  $('#cartBtn').onclick = openCart; $('#closeCart').onclick = closeCart; $('#overlay').onclick = closeCart;

  /* ---------- components ---------- */
  function card(p) {
    const sale = p.compare && p.compare > p.price;
    return `<a class="card" href="#/product/${p.id}">
      <div class="media">${p.stock <= 0 ? '<span class="tag">Sold out</span>' : sale ? `<span class="tag sale">-${Math.round((1 - p.price / p.compare) * 100)}%</span>` : ''}
        ${productImg(p)}
        ${p.stock > 0 ? `<div class="quick"><button class="btn dark" data-add="${p.id}">Add to cart</button></div>` : ''}</div>
      <h3>${esc(p.title)}</h3><div class="price">${money(p.price)}${sale ? `<s>${money(p.compare)}</s>` : ''}</div></a>`;
  }
  const catEmoji = { Apparel: '👕', Accessories: '👜', Home: '🏡', Electronics: '🎧' };

  /* ---------- pages ---------- */
  function home() {
    const prods = activeProducts();
    const cats = [...new Set(prods.map(p => p.category).filter(Boolean))];
    const featured = [...prods].sort((a, b) => b.created - a.created).slice(0, 8);
    app.innerHTML = `
      <section class="hero"><div><h1>${esc(S.name)}</h1><p>${esc(S.tagline)}</p>
        <a class="btn" href="#/shop">Shop the collection</a> <a class="btn ghost" href="#/shop/${encodeURIComponent(cats[0] || '')}">Browse ${esc(cats[0] || 'new')}</a></div>
        <div class="art">${prods[0] ? esc(prods[0].emoji || '🛍️') : '🛍️'}</div></section>
      <section class="trust"><div><b>🚚 Fast delivery</b>Ships in 2–5 days</div><div><b>🔒 Secure checkout</b>UPI, cards &amp; COD</div><div><b>↩️ Easy returns</b>7-day return policy</div><div><b>💬 Real support</b>We reply within hours</div></section>
      ${cats.length ? `<h2 class="sec">Shop by category</h2><div class="cats">${cats.map(c => `<a class="cat" href="#/shop/${encodeURIComponent(c)}"><div class="e">${catEmoji[c] || '🛍️'}</div><b>${esc(c)}</b><small>${prods.filter(p => p.category === c).length} products</small></a>`).join('')}</div>` : ''}
      <h2 class="sec">New arrivals <a href="#/shop">View all →</a></h2><div class="grid">${featured.map(card).join('')}</div>
      <section class="banner"><div><h2>Get 10% off your first order</h2><p>Use code <b>WELCOME10</b> at checkout.</p></div><a class="btn" href="#/shop">Start shopping</a></section>`;
  }

  function shop(cat) {
    let list = activeProducts(); const cats = [...new Set(list.map(p => p.category).filter(Boolean))];
    if (cat) list = list.filter(p => p.category === cat);
    if (state.q) { const q = state.q.toLowerCase(); list = list.filter(p => (p.title + ' ' + p.desc + ' ' + p.category).toLowerCase().includes(q)); }
    const sorts = { new: (a, b) => b.created - a.created, low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, az: (a, b) => a.title.localeCompare(b.title) };
    list.sort(sorts[state.sort]);
    app.innerHTML = `<div class="crumbs"><a href="#/">Home</a> / Shop${cat ? ' / ' + esc(cat) : ''}</div>
      <h2 class="sec" style="margin-top:12px">${state.q ? `Results for “${esc(state.q)}”` : esc(cat || 'All products')}<span style="font-size:14px;color:var(--muted);font-weight:400">${list.length} items</span></h2>
      <div class="toolbar"><a class="pill ${!cat ? 'on' : ''}" href="#/shop">All</a>${cats.map(c => `<a class="pill ${c === cat ? 'on' : ''}" href="#/shop/${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}
        <span class="spacer" style="flex:1"></span>
        <select class="sel" id="sortSel"><option value="new">Newest</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="az">A–Z</option></select></div>
      ${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : `<div class="empty"><div class="e">🔎</div><p>No products found.</p></div>`}`;
    $('#sortSel').value = state.sort; $('#sortSel').onchange = e => { state.sort = e.target.value; shop(cat); };
  }

  function product(id) {
    const p = getP(id);
    if (!p || p.status !== 'active') { app.innerHTML = `<div class="empty"><div class="e">😕</div><p>Product not found.</p><a class="btn" href="#/shop">Back to shop</a></div>`; return; }
    const sale = p.compare && p.compare > p.price; let qty = 1;
    const stockCls = p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : 'ok';
    const stockTxt = p.stock <= 0 ? 'Sold out' : p.stock <= 5 ? `Only ${p.stock} left!` : 'In stock';
    const related = activeProducts().filter(x => x.category === p.category && x.id !== p.id).slice(0, 4);
    app.innerHTML = `<div class="crumbs"><a href="#/">Home</a> / <a href="#/shop/${encodeURIComponent(p.category)}">${esc(p.category)}</a> / ${esc(p.title)}</div>
      <div class="pdp"><div class="big">${productImg(p)}</div>
        <div><h1>${esc(p.title)}</h1><div class="price">${money(p.price)}${sale ? `<s>${money(p.compare)}</s> <span style="color:#d82c0d;font-size:14px;font-weight:600">Save ${Math.round((1 - p.price / p.compare) * 100)}%</span>` : ''}</div>
          <p style="color:var(--muted);white-space:pre-line">${esc(p.desc)}</p>
          <div class="stock ${stockCls}">● ${stockTxt}</div>
          <div class="row"><div class="qty"><button id="qm">−</button><span id="qv">1</span><button id="qp">+</button></div></div>
          <div class="row"><button class="btn" id="addBtn" style="flex:1" ${p.stock <= 0 ? 'disabled' : ''}>Add to cart</button><button class="btn dark" id="buyBtn" style="flex:1" ${p.stock <= 0 ? 'disabled' : ''}>Buy it now</button></div>
          <div class="perks"><span>🚚 Free shipping over ${money(S.freeShipping)}</span><span>↩️ 7-day easy returns</span><span>🔒 Secure payment</span></div></div></div>
      ${related.length ? `<h2 class="sec">You may also like</h2><div class="grid">${related.map(card).join('')}</div>` : ''}`;
    $('#qm').onclick = () => { qty = Math.max(1, qty - 1); $('#qv').textContent = qty; };
    $('#qp').onclick = () => { qty = Math.min(p.stock, qty + 1); $('#qv').textContent = qty; };
    $('#addBtn').onclick = () => addToCart(p.id, qty);
    $('#buyBtn').onclick = () => { addToCart(p.id, qty, false); closeCart(); location.hash = '#/checkout'; };
  }

  function checkout() {
    const c = calc();
    if (!c.items.length) { app.innerHTML = `<div class="empty"><div class="e">🛒</div><p>Your cart is empty.</p><a class="btn" href="#/shop">Continue shopping</a></div>`; return; }
    app.innerHTML = `<form class="checkout" id="coForm">
      <div><h2 style="margin-top:0">Contact</h2>
        <div class="field"><label>Email</label><input name="email" type="email" required placeholder="you@example.com"></div>
        <h2>Delivery</h2>
        <div class="two"><div class="field"><label>Full name</label><input name="name" required></div><div class="field"><label>Phone</label><input name="phone" required pattern="[0-9+ ]{8,15}" placeholder="10-digit mobile"></div></div>
        <div class="field"><label>Address</label><textarea name="address" rows="2" required></textarea></div>
        <div class="two"><div class="field"><label>City</label><input name="city" required></div><div class="field"><label>PIN code</label><input name="pin" required pattern="[0-9]{4,8}"></div></div>
        <h2>Payment</h2>
        <label class="radio"><input type="radio" name="pay" value="COD" checked> Cash on delivery</label>
        <label class="radio"><input type="radio" name="pay" value="UPI"> UPI / Cards (demo — connect a gateway to go live)</label>
        <button class="btn block" style="margin-top:18px;padding:15px" type="submit">Place order · ${money(c.total)}</button>
      </div>
      <aside class="box"><h3 style="margin-top:0">Order summary</h3>
        ${c.items.map(i => `<div class="line" style="grid-template-columns:56px 1fr auto"><div class="thumb" style="width:56px;height:56px">${productImg(i.p)}</div><div><b>${esc(i.p.title)}</b><div class="qty" style="margin-top:4px"><button type="button" data-dec="${i.p.id}">−</button><span>${i.qty}</span><button type="button" data-inc="${i.p.id}">+</button></div></div><b>${money(i.p.price * i.qty)}</b></div>`).join('')}
        <div class="promo"><input id="promoIn" placeholder="Discount code" value="${coupon ? esc(coupon.code) : ''}"><button type="button" class="btn ghost" id="promoBtn">Apply</button></div>
        <div class="sum"><span>Subtotal</span><span>${money(c.subtotal)}</span></div>
        ${c.discount ? `<div class="sum" style="color:var(--accent)"><span>Discount (${esc(coupon.code)})</span><span>−${money(c.discount)}</span></div>` : ''}
        <div class="sum"><span>Shipping</span><span>${c.shipping ? money(c.shipping) : 'Free'}</span></div>
        <div class="sum t"><span>Total</span><span>${money(c.total)}</span></div></aside></form>`;
    $('#promoBtn').onclick = () => {
      const code = $('#promoIn').value.trim().toUpperCase();
      const d = DB.discounts().find(x => x.code === code && x.active);
      if (!d) { coupon = null; toast('Invalid discount code'); } else { coupon = d; toast('Discount applied'); }
      checkout();
    };
    $('#coForm').onsubmit = e => {
      e.preventDefault(); const f = new FormData(e.target); const cc = calc();
      const products = DB.products();
      for (const i of cc.items) { const p = products.find(x => x.id === i.p.id); if (p.stock < i.qty) { toast(`${p.title}: only ${p.stock} left`); return; } }
      const order = {
        id: DB.nextOrderId(), date: Date.now(),
        customer: { name: f.get('name'), email: f.get('email'), phone: f.get('phone'), address: f.get('address'), city: f.get('city'), pin: f.get('pin') },
        items: cc.items.map(i => ({ id: i.p.id, title: i.p.title, price: i.p.price, qty: i.qty })),
        subtotal: cc.subtotal, discount: cc.discount, shipping: cc.shipping, total: cc.total,
        status: f.get('pay') === 'COD' ? 'Pending' : 'Paid', payment: f.get('pay'), coupon: coupon ? coupon.code : ''
      };
      cc.items.forEach(i => { products.find(x => x.id === i.p.id).stock -= i.qty; });
      DB.saveProducts(products); const orders = DB.orders(); orders.unshift(order); DB.saveOrders(orders);
      DB.saveCart([]); coupon = null; renderCart(); location.hash = '#/thanks/' + order.id;
    };
  }

  function thanks(id) {
    const o = DB.orders().find(x => String(x.id) === id);
    app.innerHTML = `<div class="thanks"><div class="e">🎉</div><h1>Thank you${o ? ', ' + esc(o.customer.name.split(' ')[0]) : ''}!</h1>
      <p style="color:var(--muted)">Your order <b>#${esc(id)}</b> is confirmed. We've sent the details to ${o ? esc(o.customer.email) : 'your email'}.</p>
      ${o ? `<p>Total paid: <b>${money(o.total)}</b> (${esc(o.payment)})</p>` : ''}<a class="btn" href="#/shop">Continue shopping</a></div>`;
  }

  /* ---------- router ---------- */
  function route() {
    const [, page, arg] = (location.hash || '#/').split('/').map(decodeURIComponent);
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === (page === 'shop' ? (arg || 'shop') : page || 'home')));
    if (page !== 'shop' && page !== 'search') state.q = '';
    if (!page) home(); else if (page === 'shop') shop(arg); else if (page === 'product') product(arg);
    else if (page === 'checkout') checkout(); else if (page === 'thanks') thanks(arg); else home();
    window.scrollTo(0, 0);
  }
  $('#searchForm').onsubmit = e => { e.preventDefault(); state.q = $('#searchInput').value.trim(); if (location.hash.startsWith('#/shop')) route(); else location.hash = '#/shop'; };
  $('#newsForm').onsubmit = e => { e.preventDefault(); e.target.reset(); toast('Thanks for subscribing!'); };
  window.addEventListener('hashchange', route);
  window.addEventListener('storage', () => { applyBrand(); renderCart(); route(); });
  applyBrand(); renderCart(); route();
})();
