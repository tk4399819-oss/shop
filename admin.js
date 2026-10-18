(function () {
  const $ = s => document.querySelector(s);
  const root = $('#root');
  const STATUSES = ['Pending', 'Paid', 'Shipped', 'Delivered', 'Cancelled'];
  const authed = () => { try { return sessionStorage.getItem('sh_admin') === '1'; } catch (e) { return false; } };
  const fmtDate = t => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtTime = t => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const ui = { orderTab: 'All', orderQ: '', prodQ: '', prodStatus: 'all', custQ: '' };
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2000); }
  function openModal(html) { $('#modal').innerHTML = html; $('#modalBg').classList.add('open'); }
  function closeModal() { $('#modalBg').classList.remove('open'); }
  $('#modalBg').addEventListener('mousedown', e => { if (e.target.id === 'modalBg') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  const badge = s => `<span class="badge b-${esc(s)}">${esc(s)}</span>`;
  const revenue = o => o.filter(x => x.status !== 'Cancelled').reduce((a, b) => a + b.total, 0);

  /* ---------- login ---------- */
  function login() {
    const S = DB.settings();
    root.innerHTML = `<div class="login"><form class="card" id="lf"><h2>${esc(S.name)} admin</h2><p>Log in to manage your store</p>
      <div class="fld"><label>Username</label><input name="u" autofocus required></div>
      <div class="fld"><label>Password</label><input name="p" type="password" required></div>
      <div class="err" id="err"></div><button class="btn prim" style="width:100%;justify-content:center;padding:11px">Log in</button>
      <p style="margin:16px 0 0;font-size:12px">Demo login: <b>admin</b> / <b>admin123</b> · <a href="index.html" style="text-decoration:underline">View store</a></p></form></div>`;
    $('#lf').onsubmit = e => {
      e.preventDefault(); const f = new FormData(e.target);
      if (f.get('u') === S.adminUser && f.get('p') === S.adminPass) { try { sessionStorage.setItem('sh_admin', '1'); } catch (x) { } shell(); }
      else $('#err').textContent = 'Incorrect username or password.';
    };
  }

  /* ---------- shell ---------- */
  const NAV = [['dashboard', '🏠', 'Home'], ['orders', '📥', 'Orders'], ['products', '🏷️', 'Products'], ['customers', '👥', 'Customers'], ['discounts', '🎟️', 'Discounts'], ['settings', '⚙️', 'Settings']];
  function shell() {
    if (!authed()) return login();
    const S = DB.settings(); const pending = DB.orders().filter(o => o.status === 'Pending').length;
    const page = (location.hash.replace('#/', '') || 'dashboard').split('/')[0];
    root.innerHTML = `<div class="topbar"><button class="menu" id="menuBtn">☰</button><div class="brand">🛍️ ${esc(S.name)}</div>
      <div class="sbox"><input id="gs" placeholder="Search orders, products, customers…"></div>
      <a class="view" href="index.html" target="_blank">View store ↗</a><div class="avatar" title="${esc(S.adminUser)}">${esc(S.adminUser[0].toUpperCase())}</div></div>
      <aside class="side" id="side">${NAV.map(([k, i, l]) => `<a href="#/${k}" class="${page === k ? 'on' : ''}">${i} ${l}${k === 'orders' && pending ? `<span class="pill">${pending}</span>` : ''}</a>`).join('')}
        <div class="grp">Sales channels</div><a href="index.html" target="_blank">🌐 Online store</a><div class="grp">Account</div><a href="#" id="logout">🚪 Log out</a></aside>
      <main id="view"></main>`;
    $('#menuBtn').onclick = () => $('#side').classList.toggle('open');
    $('#side').onclick = e => { if (e.target.closest('a[href^="#/"]')) $('#side').classList.remove('open'); };
    $('#logout').onclick = e => { e.preventDefault(); try { sessionStorage.removeItem('sh_admin'); } catch (x) { } login(); };
    $('#gs').onkeydown = e => { if (e.key === 'Enter' && e.target.value.trim()) { ui.orderQ = e.target.value.trim(); ui.orderTab = 'All'; location.hash = '#/orders'; } };
    const v = { dashboard, orders, products, customers, discounts, settings }[page] || dashboard; v();
  }
  window.addEventListener('hashchange', () => authed() && shell());

  /* ---------- dashboard ---------- */
  function dashboard() {
    const orders = DB.orders(), prods = DB.products(); const valid = orders.filter(o => o.status !== 'Cancelled');
    const customers = new Set(orders.map(o => o.customer.email)).size;
    const day = 864e5, now = Date.now(); const days = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(now - i * day); d.setHours(0, 0, 0, 0); days.push({ t: d.getTime(), v: 0, n: 0 }); }
    valid.forEach(o => { const d = new Date(o.date); d.setHours(0, 0, 0, 0); const x = days.find(y => y.t === d.getTime()); if (x) { x.v += o.total; x.n++; } });
    const last7 = days.slice(7).reduce((a, b) => a + b.v, 0), prev7 = days.slice(0, 7).reduce((a, b) => a + b.v, 0);
    const chg = prev7 ? Math.round((last7 - prev7) / prev7 * 100) : 0;
    const sold = {}; valid.forEach(o => o.items.forEach(i => sold[i.title] = (sold[i.title] || 0) + i.qty));
    const top = Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5); const max = top[0] ? top[0][1] : 1;
    const lowStock = prods.filter(p => p.stock <= 5 && p.status === 'active').slice(0, 5);
    $('#view').innerHTML = `<h1>Home</h1>
      <div class="kpis">
        <div class="kpi"><small>Total sales</small><div class="v">${money(revenue(orders))}</div><div class="d">${chg >= 0 ? '↑' : '↓'} ${Math.abs(chg)}% vs previous 7 days</div></div>
        <div class="kpi"><small>Orders</small><div class="v">${valid.length}</div><div class="d">${orders.filter(o => o.status === 'Pending').length} to fulfil</div></div>
        <div class="kpi"><small>Customers</small><div class="v">${customers}</div><div class="d muted">unique emails</div></div>
        <div class="kpi"><small>Average order value</small><div class="v">${money(valid.length ? revenue(orders) / valid.length : 0)}</div><div class="d muted">${prods.length} products</div></div></div>
      <div class="cols"><div>
        <div class="card"><div class="hd">Sales over time <span class="muted" style="font-weight:400">Last 14 days</span></div><div class="bd">${chart(days)}</div></div>
        <div class="card"><div class="hd">Recent orders <a href="#/orders" style="color:var(--accent)">View all</a></div>
          <table><tbody>${orders.slice(0, 6).map(o => `<tr class="click" data-o="${o.id}"><td><b>#${o.id}</b></td><td>${esc(o.customer.name)}</td><td class="muted">${fmtDate(o.date)}</td><td>${badge(o.status)}</td><td class="right">${money(o.total)}</td></tr>`).join('') || '<tr><td class="empty">No orders yet</td></tr>'}</tbody></table></div></div>
      <div><div class="card"><div class="hd">Top products</div><div class="bd">${top.map(([n, q]) => `<div class="bar-row"><span class="t">${esc(n)}</span><div class="bar-wrap"><div class="bar" style="width:${q / max * 100}%"></div></div><b>${q}</b></div>`).join('') || '<span class="muted">No sales yet</span>'}</div></div>
        <div class="card"><div class="hd">Inventory alerts</div><div class="bd">${lowStock.map(p => `<div class="list-row"><span>${esc(p.title)}</span><span class="${p.stock ? 'low' : 'out'}">${p.stock ? p.stock + ' left' : 'Sold out'}</span></div>`).join('') || '<span class="muted">All stocked up 🎉</span>'}</div></div>
        <div class="card"><div class="hd">Quick actions</div><div class="bd" style="display:grid;gap:8px"><button class="btn" id="qa1">+ Add product</button><a class="btn sec" href="#/orders">Process orders</a><a class="btn sec" href="#/discounts">Create discount</a></div></div></div></div>`;
    $('#qa1').onclick = () => productModal();
    $('#view').onclick = e => { const r = e.target.closest('[data-o]'); if (r) orderModal(+r.dataset.o); };
  }
  function chart(days) {
    const W = 640, H = 220, pad = 30, max = Math.max(1, ...days.map(d => d.v)) * 1.1, bw = (W - pad * 2) / days.length;
    const bars = days.map((d, i) => { const h = d.v / max * (H - 50); const x = pad + i * bw; return `<g><title>${new Date(d.t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${money(d.v)} (${d.n} orders)</title><rect x="${x + 4}" y="${H - 24 - h}" width="${bw - 8}" height="${Math.max(h, 1)}" rx="4" fill="#008060" opacity="${d.v ? .9 : .25}"/><text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${new Date(d.t).getDate()}</text></g>`; }).join('');
    const grid = [0, .5, 1].map(f => `<line x1="${pad}" x2="${W - pad}" y1="${H - 24 - f * (H - 50)}" y2="${H - 24 - f * (H - 50)}" stroke="#e1e3e5"/><text x="2" y="${H - 20 - f * (H - 50)}">${f ? Math.round(max * f / 1000 * 10) / 10 + 'k' : '0'}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}${bars}</svg>`;
  }

  /* ---------- orders ---------- */
  function orders() {
    const all = DB.orders(); const q = ui.orderQ.toLowerCase();
    let list = all.filter(o => ui.orderTab === 'All' || o.status === ui.orderTab);
    if (q) list = list.filter(o => (o.id + o.customer.name + o.customer.email + o.customer.city).toLowerCase().includes(q));
    $('#view').innerHTML = `<h1>Orders<span class="sp"></span><button class="btn sec" id="exp">Export CSV</button></h1>
      <div class="card"><div class="tools"><div class="tabs">${['All', ...STATUSES].map(s => `<button class="${ui.orderTab === s ? 'on' : ''}" data-tab="${s}">${s}${s !== 'All' ? ' ' + all.filter(o => o.status === s).length : ''}</button>`).join('')}</div>
        <input id="oq" placeholder="Search orders" value="${esc(ui.orderQ)}" style="margin-left:auto"></div>
        <table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Payment</th><th>Status</th><th class="right">Total</th></tr></thead>
        <tbody>${list.map(o => `<tr class="click" data-o="${o.id}"><td><b>#${o.id}</b></td><td>${fmtTime(o.date)}</td><td>${esc(o.customer.name)}<div class="muted">${esc(o.customer.city)}</div></td><td>${esc(o.payment)}</td><td>${badge(o.status)}</td><td class="right">${money(o.total)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No orders found</td></tr>'}</tbody></table></div>`;
    $('#view').onclick = e => {
      const t = e.target.closest('[data-tab]'); if (t) { ui.orderTab = t.dataset.tab; return orders(); }
      const r = e.target.closest('[data-o]'); if (r) orderModal(+r.dataset.o);
    };
    $('#oq').oninput = e => { ui.orderQ = e.target.value; const pos = e.target.selectionStart; orders(); const i = $('#oq'); i.focus(); i.setSelectionRange(pos, pos); };
    $('#exp').onclick = () => download('orders.csv', 'Order,Date,Name,Email,Phone,City,Payment,Status,Total\n' + all.map(o => [o.id, new Date(o.date).toISOString(), o.customer.name, o.customer.email, o.customer.phone, o.customer.city, o.payment, o.status, o.total].map(csv).join(',')).join('\n'), 'text/csv');
  }
  const csv = v => '"' + String(v).replace(/"/g, '""') + '"';
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  function orderModal(id) {
    const o = DB.orders().find(x => x.id === id); if (!o) return;
    openModal(`<div class="hd"><span>Order #${o.id} ${badge(o.status)}</span><button class="x" onclick="document.getElementById('modalBg').classList.remove('open')">✕</button></div>
      <div class="bd"><p class="muted" style="margin-top:0">${fmtTime(o.date)} · ${esc(o.payment)}${o.coupon ? ' · code ' + esc(o.coupon) : ''}</p>
        <table>${o.items.map(i => `<tr><td>${esc(i.title)}</td><td class="muted">${money(i.price)} × ${i.qty}</td><td class="right">${money(i.price * i.qty)}</td></tr>`).join('')}
        <tr><td colspan="2" class="muted">Subtotal</td><td class="right">${money(o.subtotal)}</td></tr>
        ${o.discount ? `<tr><td colspan="2" class="muted">Discount</td><td class="right">−${money(o.discount)}</td></tr>` : ''}
        <tr><td colspan="2" class="muted">Shipping</td><td class="right">${money(o.shipping)}</td></tr>
        <tr><td colspan="2"><b>Total</b></td><td class="right"><b>${money(o.total)}</b></td></tr></table>
        <div class="g2" style="margin-top:16px"><div><b>Customer</b><div>${esc(o.customer.name)}</div><div class="muted">${esc(o.customer.email)}<br>${esc(o.customer.phone)}</div></div>
        <div><b>Ship to</b><div class="muted">${esc(o.customer.address)}<br>${esc(o.customer.city)} ${esc(o.customer.pin)}</div></div></div>
        <div class="fld" style="margin-top:16px"><label>Update status</label><select id="st">${STATUSES.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
      <div class="ft"><button class="btn danger" id="od">Delete</button><button class="btn sec" onclick="window.print()">Print</button><button class="btn prim" id="os">Save status</button></div>`);
    $('#os').onclick = () => {
      const all = DB.orders(), x = all.find(y => y.id === id), ns = $('#st').value;
      if (ns === 'Cancelled' && x.status !== 'Cancelled') restock(x, 1); else if (x.status === 'Cancelled' && ns !== 'Cancelled') restock(x, -1);
      x.status = ns; DB.saveOrders(all); closeModal(); toast('Order updated'); shell();
    };
    $('#od').onclick = () => { if (confirm('Delete order #' + id + '?')) { DB.saveOrders(DB.orders().filter(y => y.id !== id)); closeModal(); shell(); } };
  }
  function restock(o, sign) { const p = DB.products(); o.items.forEach(i => { const x = p.find(y => y.id === i.id); if (x) x.stock = Math.max(0, x.stock + sign * i.qty); }); DB.saveProducts(p); }

  /* ---------- products ---------- */
  function products() {
    let list = DB.products(); const q = ui.prodQ.toLowerCase();
    if (q) list = list.filter(p => (p.title + p.category).toLowerCase().includes(q));
    if (ui.prodStatus !== 'all') list = list.filter(p => p.status === ui.prodStatus);
    $('#view').innerHTML = `<h1>Products<span class="sp"></span><button class="btn" id="add">Add product</button></h1>
      <div class="card"><div class="tools"><div class="tabs">${['all', 'active', 'draft'].map(s => `<button class="${ui.prodStatus === s ? 'on' : ''}" data-ps="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div><input id="pq" placeholder="Search products" value="${esc(ui.prodQ)}" style="margin-left:auto"></div>
        <table><thead><tr><th>Product</th><th>Status</th><th>Inventory</th><th>Category</th><th class="right">Price</th><th></th></tr></thead>
        <tbody>${list.map(p => `<tr><td><span class="thumb">${productImg(p)}</span><b>${esc(p.title)}</b></td><td><span class="badge b-${p.status}">${p.status}</span></td>
          <td class="${p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : ''}">${p.stock <= 0 ? 'Out of stock' : p.stock + ' in stock'}</td><td>${esc(p.category)}</td><td class="right">${money(p.price)}</td>
          <td class="right"><button class="btn sec sm" data-e="${p.id}">Edit</button> <button class="btn danger sm" data-d="${p.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">No products. Add your first one!</td></tr>'}</tbody></table></div>`;
    $('#add').onclick = () => productModal();
    $('#pq').oninput = e => { ui.prodQ = e.target.value; const pos = e.target.selectionStart; products(); const i = $('#pq'); i.focus(); i.setSelectionRange(pos, pos); };
    $('#view').onclick = e => {
      const s = e.target.closest('[data-ps]'); if (s) { ui.prodStatus = s.dataset.ps; return products(); }
      const ed = e.target.closest('[data-e]'); if (ed) return productModal(ed.dataset.e);
      const d = e.target.closest('[data-d]'); if (d && confirm('Delete this product?')) { DB.saveProducts(DB.products().filter(p => p.id !== d.dataset.d)); products(); toast('Product deleted'); }
    };
  }
  function productModal(id) {
    const p = id ? DB.products().find(x => x.id === id) : { title: '', desc: '', price: '', compare: '', category: '', stock: 10, emoji: '🛍️', color: '#e5e7eb', image: '', status: 'active' };
    let image = p.image; const cats = [...new Set(DB.products().map(x => x.category).filter(Boolean))];
    openModal(`<div class="hd"><span>${id ? 'Edit product' : 'Add product'}</span><button class="x" onclick="document.getElementById('modalBg').classList.remove('open')">✕</button></div>
      <form id="pf"><div class="bd">
        <div class="fld"><label>Title</label><input name="title" required value="${esc(p.title)}" placeholder="e.g. Cotton T-shirt"></div>
        <div class="fld"><label>Description</label><textarea name="desc" rows="3">${esc(p.desc)}</textarea></div>
        <div class="fld"><label>Image</label><div class="imgbox"><span class="thumb" id="prev"></span><div><input type="file" id="file" accept="image/*"><div class="muted" style="margin-top:4px">Optional. Without an image, an emoji tile is shown.</div></div></div></div>
        <div class="g3"><div class="fld"><label>Emoji (no image)</label><input name="emoji" value="${esc(p.emoji)}" maxlength="4"></div><div class="fld"><label>Tile color</label><input name="color" type="color" value="${esc(p.color)}"></div><div class="fld"><label>Status</label><select name="status"><option value="active" ${p.status === 'active' ? 'selected' : ''}>Active</option><option value="draft" ${p.status === 'draft' ? 'selected' : ''}>Draft (hidden)</option></select></div></div>
        <div class="g2"><div class="fld"><label>Price</label><input name="price" type="number" min="0" step="0.01" required value="${esc(p.price)}"></div><div class="fld"><label>Compare-at price</label><input name="compare" type="number" min="0" step="0.01" value="${esc(p.compare)}"></div></div>
        <div class="g2"><div class="fld"><label>Category</label><input name="category" list="cl" required value="${esc(p.category)}"><datalist id="cl">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div><div class="fld"><label>Stock quantity</label><input name="stock" type="number" min="0" step="1" required value="${esc(p.stock)}"></div></div>
      </div><div class="ft"><button type="button" class="btn sec" onclick="document.getElementById('modalBg').classList.remove('open')">Cancel</button><button class="btn prim">Save product</button></div></form>`);
    const prev = () => { $('#prev').innerHTML = productImg({ ...p, image }); }; prev();
    $('#file').onchange = e => {
      const f = e.target.files[0]; if (!f) return; const r = new FileReader();
      r.onload = () => { const im = new Image(); im.onload = () => { const m = 800, k = Math.min(1, m / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); image = c.toDataURL('image/jpeg', .8); prev(); }; im.src = r.result; };
      r.readAsDataURL(f);
    };
    $('#pf').onsubmit = e => {
      e.preventDefault(); const f = new FormData(e.target); const all = DB.products();
      const data = { title: f.get('title').trim(), desc: f.get('desc'), price: +f.get('price'), compare: f.get('compare') ? +f.get('compare') : '', category: f.get('category').trim(), stock: Math.max(0, parseInt(f.get('stock'), 10) || 0), emoji: f.get('emoji') || '🛍️', color: f.get('color'), status: f.get('status'), image };
      if (id) Object.assign(all.find(x => x.id === id), data); else all.unshift({ id: 'p' + Date.now().toString(36), created: Date.now(), ...data });
      if (DB.saveProducts(all)) { closeModal(); toast('Product saved'); shell(); }
    };
  }

  /* ---------- customers ---------- */
  function customers() {
    const map = {};
    DB.orders().filter(o => o.status !== 'Cancelled').forEach(o => { const c = map[o.customer.email] || (map[o.customer.email] = { ...o.customer, orders: 0, spent: 0, last: 0 }); c.orders++; c.spent += o.total; c.last = Math.max(c.last, o.date); });
    const q = ui.custQ.toLowerCase(); const list = Object.values(map).filter(c => !q || (c.name + c.email + c.city).toLowerCase().includes(q)).sort((a, b) => b.spent - a.spent);
    $('#view').innerHTML = `<h1>Customers</h1><div class="card"><div class="tools"><input id="cq" placeholder="Search customers" value="${esc(ui.custQ)}"></div>
      <table><thead><tr><th>Customer</th><th>Location</th><th>Orders</th><th>Last order</th><th class="right">Total spent</th></tr></thead>
      <tbody>${list.map(c => `<tr><td><b>${esc(c.name)}</b><div class="muted">${esc(c.email)}</div></td><td>${esc(c.city)}</td><td>${c.orders}</td><td>${fmtDate(c.last)}</td><td class="right">${money(c.spent)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No customers yet</td></tr>'}</tbody></table></div>`;
    $('#cq').oninput = e => { ui.custQ = e.target.value; const pos = e.target.selectionStart; customers(); const i = $('#cq'); i.focus(); i.setSelectionRange(pos, pos); };
  }

  /* ---------- discounts ---------- */
  function discounts() {
    const list = DB.discounts();
    $('#view').innerHTML = `<h1>Discounts</h1>
      <div class="card"><div class="hd">Create discount code</div><form class="bd g3" id="df" style="align-items:end;grid-template-columns:1.3fr 1fr 1fr auto">
        <div class="fld" style="margin:0"><label>Code</label><input name="code" required placeholder="SUMMER20" style="text-transform:uppercase"></div>
        <div class="fld" style="margin:0"><label>Type</label><select name="type"><option value="percent">Percentage (%)</option><option value="fixed">Fixed amount</option></select></div>
        <div class="fld" style="margin:0"><label>Value</label><input name="value" type="number" min="1" step="any" required></div><button class="btn prim">Create</button></form></div>
      <div class="card"><table><thead><tr><th>Code</th><th>Value</th><th>Status</th><th></th></tr></thead><tbody>${list.map((d, i) => `<tr><td><b>${esc(d.code)}</b></td><td>${d.type === 'percent' ? d.value + '% off' : money(d.value) + ' off'}</td><td><span class="badge b-${d.active ? 'active' : 'draft'}">${d.active ? 'Active' : 'Disabled'}</span></td>
        <td class="right"><button class="btn sec sm" data-t="${i}">${d.active ? 'Disable' : 'Enable'}</button> <button class="btn danger sm" data-x="${i}">Delete</button></td></tr>`).join('') || '<tr><td colspan="4" class="empty">No discount codes</td></tr>'}</tbody></table></div>`;
    $('#df').onsubmit = e => {
      e.preventDefault(); const f = new FormData(e.target); const code = f.get('code').trim().toUpperCase(); const l = DB.discounts();
      if (l.find(d => d.code === code)) return toast('That code already exists');
      l.push({ code, type: f.get('type'), value: +f.get('value'), active: true }); DB.saveDiscounts(l); toast('Discount created'); discounts();
    };
    $('#view').onclick = e => { const l = DB.discounts(); const t = e.target.closest('[data-t]'), x = e.target.closest('[data-x]'); if (t) { l[t.dataset.t].active = !l[t.dataset.t].active; DB.saveDiscounts(l); discounts(); } if (x) { l.splice(x.dataset.x, 1); DB.saveDiscounts(l); discounts(); } };
  }

  /* ---------- settings ---------- */
  function settings() {
    const S = DB.settings();
    $('#view').innerHTML = `<h1>Settings</h1><form id="sf">
      <div class="card"><div class="hd">Store details</div><div class="bd"><div class="g2"><div class="fld"><label>Store name</label><input name="name" required value="${esc(S.name)}"></div><div class="fld"><label>Currency symbol</label><input name="currency" required maxlength="4" value="${esc(S.currency)}"></div></div>
        <div class="fld"><label>Tagline</label><input name="tagline" value="${esc(S.tagline)}"></div><div class="fld"><label>Announcement bar (leave empty to hide)</label><input name="announcement" value="${esc(S.announcement)}"></div>
        <div class="g3"><div class="fld"><label>Contact email</label><input name="email" value="${esc(S.email)}"></div><div class="fld"><label>Phone</label><input name="phone" value="${esc(S.phone)}"></div><div class="fld"><label>Brand color</label><input name="accent" type="color" value="${esc(S.accent)}"></div></div></div></div>
      <div class="card"><div class="hd">Shipping</div><div class="bd g2"><div class="fld" style="margin:0"><label>Flat shipping rate</label><input name="shipping" type="number" min="0" value="${esc(S.shipping)}"></div><div class="fld" style="margin:0"><label>Free shipping above</label><input name="freeShipping" type="number" min="0" value="${esc(S.freeShipping)}"></div></div></div>
      <div class="card"><div class="hd">Admin login</div><div class="bd g2"><div class="fld" style="margin:0"><label>Username</label><input name="adminUser" required value="${esc(S.adminUser)}"></div><div class="fld" style="margin:0"><label>Password</label><input name="adminPass" required value="${esc(S.adminPass)}"></div></div></div>
      <button class="btn prim">Save settings</button></form>
      <div class="card" style="margin-top:16px"><div class="hd">Data</div><div class="bd" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sec" id="bk">Download backup (JSON)</button><label class="btn sec">Restore backup<input type="file" id="rs" accept=".json" hidden></label><button class="btn danger" id="rst">Reset to demo data</button></div></div>`;
    $('#sf').onsubmit = e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); f.shipping = +f.shipping; f.freeShipping = +f.freeShipping; DB.saveSettings({ ...DB.settings(), ...f }); toast('Settings saved'); shell(); };
    $('#bk').onclick = () => download('store-backup.json', DB.exportAll(), 'application/json');
    $('#rs').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { DB.importAll(r.result); toast('Backup restored'); shell(); } catch (x) { alert('Invalid backup file'); } }; r.readAsText(f); };
    $('#rst').onclick = () => { if (confirm('This deletes all your products and orders and restores demo data. Continue?')) { DB.resetAll(); location.reload(); } };
  }

  shell();
})();
