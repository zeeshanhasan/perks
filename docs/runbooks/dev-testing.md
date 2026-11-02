# Runbook: testing on the dev store

## 0. One-time (if not done)

- **Partner dashboard → perks → API access → Protected customer data:**
  - **Protected customer data** selected (Level 1)
  - **Email** selected under protected customer fields (Level 2). Needed for work-email login perks.
- Storefront password: **Online Store → Preferences → Password protection**.

## 1. Get the latest code

```bash
cd ~/perks
git pull
npm install
```

If npm warns about blocked install scripts:

```bash
npm install-scripts approve @prisma/client @prisma/engines prisma esbuild @parcel/watcher fsevents && npm rebuild
```

## 2. Start dev (two tabs)

```bash
cloudflared tunnel run --protocol http2 --url http://localhost:3000 perks-dev
```

```bash
shopify app dev --tunnel-url https://dev-perks.tofoapp.com:3000
```

**Pass:** `✅ Ready`, and 3 extensions built (`perks-discount`, `perks-validation`, `perks-theme`).

If the CLI complains about the `customers/create` / `customers/update` webhooks, step 0's Email access isn't saved yet.

## 3. Re-save once (pushes the new config to Shopify)

1. **Settings:** check the values, tick **"Automatically give perks to customers who log in with a work email"**, then **Save**.
2. **Products:**
   - Employee-only: **Liquid, Oxygen, Hydrogen**
   - Discounted for employees: **Multi-managed Snowboard**
   - Never discounted: **Hydrogen**
   - Click **Save** (or Save in the top bar).

## 4. Turn on Employee mode (theme)

Home → step 4 **"Open theme editor"** (or Help → Open theme editor). Make sure **Employee mode** is on under App embeds, then **Save**.

## 5. Add a work-email customer

**Customers → Add customer:** `Work Test`, email `zeeshan@tofoapp.com`.

## 6. Run the tests

`docs/acceptance-tests.md` sections A–F. The fastest high-value path:
1. **A1 + B1:** log in on the storefront as `zeeshan@tofoapp.com` (the code goes to that inbox), add Liquid, and check for 15% off at checkout.
2. **C1:** in incognito, log in as `zeeshanhasan+normal@gmail.com`, add Liquid, and check checkout is blocked.
3. **F1/F2:** same incognito window. The collection doesn't show Liquid, and the Liquid URL shows the notice.
4. **D1:** Employees → Remove perks on Work Test. Their next cart gets no discount and is blocked.

## 7. Report

Per failing test: the ID, what happened, and a screenshot or the terminal lines (strip keys).
