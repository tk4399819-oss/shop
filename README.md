# Aurora Store – storefront + admin dashboard (no build step)

Files
- index.html  – customer storefront (home, shop, search, product page, cart drawer, checkout, thank-you)
- admin.html  – admin dashboard (login: admin / admin123)
- js/data.js  – shared data layer (localStorage) + demo products/orders
- js/store.js, js/admin.js, css/store.css, css/admin.css

Run: open index.html in a browser, or `python3 -m http.server` and visit http://localhost:8000
Deploy: upload the folder to Render / Netlify / Vercel / GitHub Pages as a static site.

Admin: dashboard stats + chart, orders (status, print, CSV export), products (add/edit/delete, image upload),
customers, discount codes, settings (name, currency, colour, shipping, password), backup/restore.

IMPORTANT: this version stores data in the browser (localStorage), so orders placed by
real customers on other devices will NOT appear in your admin. To go live for real
you need a backend + database (e.g. Node/Express + MongoDB, Supabase or Firebase) and
a payment gateway (Razorpay / Stripe). Change the admin password in Settings first.
