/* Shared data layer (localStorage). Used by both the storefront and the admin. */
(function () {
  const K = { p: 'sh_products', o: 'sh_orders', s: 'sh_settings', d: 'sh_discounts', c: 'sh_cart', seeded: 'sh_seeded' };
  const read = (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { alert('Browser storage is full. Use smaller images.'); return false; } };

  const defaultSettings = {
    name: 'Aurora Store', tagline: 'Thoughtfully made products, delivered to your door.',
    currency: '₹', shipping: 49, freeShipping: 999, email: 'hello@example.com', phone: '+91 90000 00000',
    announcement: 'Free shipping on orders above ₹999 · Use code WELCOME10 for 10% off',
    adminUser: 'admin', adminPass: 'admin123', accent: '#008060'
  };

  const seedProducts = [
    ['Classic Cotton Tee', 'Soft 100% organic cotton t-shirt with a relaxed fit. Pre-washed so it stays soft and keeps its shape.', 599, 799, 'Apparel', 42, '👕', '#dbeafe'],
    ['Everyday Canvas Tote', 'Heavy-duty canvas tote with inner pocket. Carries your laptop, groceries and everything in between.', 449, 549, 'Accessories', 30, '👜', '#fde68a'],
    ['Ceramic Pour-Over Set', 'Hand-glazed ceramic dripper with matching mug. Makes a clean, bright cup of coffee.', 1299, 1599, 'Home', 12, '☕', '#fed7aa'],
    ['Wireless Earbuds Pro', 'Active noise cancelling, 28-hour battery life with the case, and IPX5 sweat resistance.', 2499, 3299, 'Electronics', 18, '🎧', '#e9d5ff'],
    ['Scented Soy Candle', 'Hand-poured soy wax candle with notes of cedar and vanilla. 45-hour burn time.', 349, '', 'Home', 60, '🕯️', '#fecdd3'],
    ['Leather Card Wallet', 'Slim full-grain leather wallet holding up to 8 cards. Ages beautifully.', 899, 1099, 'Accessories', 4, '👛', '#d6c3a5'],
    ['Smart Water Bottle', 'Insulated steel bottle that keeps drinks cold 24h or hot 12h. Tracks hydration with LED reminders.', 1499, '', 'Electronics', 25, '🍼', '#bae6fd'],
    ['Linen Throw Blanket', 'Breathable stonewashed linen throw. Light enough for summer, cosy enough for winter.', 1899, 2299, 'Home', 9, '🛋️', '#d1fae5'],
    ['Minimal Desk Lamp', 'Dimmable LED lamp with warm and cool modes and a USB charging port.', 1799, '', 'Electronics', 0, '💡', '#fef3c7'],
    ['Wool Beanie', 'Merino wool beanie, naturally warm and itch-free.', 499, '', 'Apparel', 35, '🧢', '#e2e8f0']
  ];

  function seed() {
    if (read(K.seeded, false)) return;
    const prods = seedProducts.map((p, i) => ({
      id: 'p' + (i + 1), title: p[0], desc: p[1], price: p[2], compare: p[3], category: p[4],
      stock: p[5], emoji: p[6], color: p[7], image: '', status: 'active', created: Date.now() - i * 864e5
    }));
    write(K.p, prods);
    write(K.d, [
      { code: 'WELCOME10', type: 'percent', value: 10, active: true },
      { code: 'FLAT100', type: 'fixed', value: 100, active: true }
    ]);
    // deterministic demo orders over the last 14 days
    const names = ['Aarav Sharma', 'Diya Patel', 'Rohan Mehta', 'Sneha Iyer', 'Kabir Singh', 'Ananya Rao', 'Vikram Joshi', 'Meera Nair'];
    const cities = ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Pune', 'Hyderabad', 'Kolkata', 'Jaipur'];
    const status = ['Delivered', 'Delivered', 'Shipped', 'Paid', 'Pending', 'Delivered', 'Cancelled'];
    let seedN = 7; const rnd = () => (seedN = (seedN * 9301 + 49297) % 233280) / 233280;
    const orders = [];
    for (let i = 0; i < 24; i++) {
      const n = Math.floor(rnd() * names.length);
      const count = 1 + Math.floor(rnd() * 3);
      const items = [];
      for (let j = 0; j < count; j++) {
        const p = prods[Math.floor(rnd() * prods.length)];
        if (!items.find(x => x.id === p.id)) items.push({ id: p.id, title: p.title, price: p.price, qty: 1 + Math.floor(rnd() * 2) });
      }
      const sub = items.reduce((a, b) => a + b.price * b.qty, 0);
      const ship = sub >= 999 ? 0 : 49;
      orders.push({
        id: 1001 + i, date: Date.now() - Math.floor(rnd() * 14 * 864e5),
        customer: { name: names[n], email: names[n].split(' ')[0].toLowerCase() + '@example.com', phone: '98' + String(10000000 + Math.floor(rnd() * 8e7)), address: (10 + i) + ' MG Road', city: cities[n], pin: '4000' + (10 + n) },
        items, subtotal: sub, discount: 0, shipping: ship, total: sub + ship,
        status: status[Math.floor(rnd() * status.length)], payment: rnd() > 0.5 ? 'UPI' : 'COD'
      });
    }
    orders.sort((a, b) => b.id - a.id);
    write(K.o, orders);
    write(K.seeded, true);
  }
  seed();

  window.DB = {
    settings: () => Object.assign({}, defaultSettings, read(K.s, {})),
    saveSettings: s => write(K.s, s),
    products: () => read(K.p, []),
    saveProducts: p => write(K.p, p),
    orders: () => read(K.o, []),
    saveOrders: o => write(K.o, o),
    discounts: () => read(K.d, []),
    saveDiscounts: d => write(K.d, d),
    cart: () => read(K.c, []),
    saveCart: c => write(K.c, c),
    nextOrderId: () => Math.max(1000, ...read(K.o, []).map(o => o.id)) + 1,
    resetAll: () => { Object.values(K).forEach(k => localStorage.removeItem(k)); },
    exportAll: () => JSON.stringify({ products: read(K.p, []), orders: read(K.o, []), discounts: read(K.d, []), settings: read(K.s, {}) }, null, 2),
    importAll: txt => { const d = JSON.parse(txt); write(K.p, d.products || []); write(K.o, d.orders || []); write(K.d, d.discounts || []); write(K.s, d.settings || {}); write(K.seeded, true); }
  };

  window.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.money = n => { n = Number(n || 0); return DB.settings().currency + n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  window.productImg = (p, cls) => p.image
    ? `<img class="${cls || ''}" src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy">`
    : `<div class="ph ${cls || ''}" style="background:${esc(p.color || '#e5e7eb')}"><span>${esc(p.emoji || '🛍️')}</span></div>`;
})();
