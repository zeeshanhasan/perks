# Runbook: first run of v1 on the dev store

Follow it top to bottom. Each step says what "pass" looks like.

## 1. Get the code

```bash
cd ~/perks
git fetch origin
git checkout feat/v1
npm install
```

## 2. Partner dashboard: protected customer data (one time)

Our app writes customer metafields, so Shopify requires the protected customer data request.

1. Go to dev.shopify.com (or the Partner dashboard), then **Apps → perks → API access**.
2. Under **Protected customer data**, click **Request access**.
3. Select **Protected customer data** (Level 1) and give the reason: *"Store management: verify employee eligibility for discounts."*
4. We don't need name, email, phone or address fields (Level 2). Leave them off.
5. Save. On dev stores this applies straight away.

## 3. Start dev (two terminal tabs)

```bash
cloudflared tunnel run --protocol http2 --url http://localhost:3000 perks-dev
```

```bash
shopify app dev --tunnel-url https://dev-perks.tofoapp.com:3000
```

**Pass looks like:**
- The CLI shows `perks-discount`, `perks-validation` and `perks-theme` being built and deployed to the dev preview.
- Press `p`. The admin asks to **update permissions** (new scopes). Accept.
- The new nav shows Home, Settings, Products, Employees and Audit log.

**If the CLI rejects a scope** (`read_validations`/`write_validations`), remove those two from `shopify.app.toml` and tell Rocky.

## 4. Configure (admin)

1. **Settings:**
   - Program on: ✅
   - Employer: `Tofo`
   - Domains: `tofoapp.com`
   - Discount: `15`, applies to employee-only products
   - Combines with: all unticked
   - Eligibility: 12 months
   - **Save**

   Pass: a "Saved" banner, and Home shows "Employee discount created" ✅.
2. **Products:**
   - Employee-only: **Liquid, Oxygen, Hydrogen**
   - Excluded: **Hydrogen**
   - **Save**

   Pass: toast "Products saved", and Home shows "Checkout protection active" ✅.
3. Check in Shopify admin:
   - **Discounts** lists "Employee perks" (automatic, active).
   - **Settings → Checkout → Checkout rules** lists "Employee-only products".

## 5. Theme (one time)

**Online Store → Themes → Customize:**
- **Product** template: Add block → Apps → **Employee badge**
- **Home page**: Add section/block → Apps → **Employee perks link**
- Save.

## 6. Verify an employee (storefront)

1. Open the storefront. Log in as `zeeshanhasan+emp@gmail.com` (the code arrives in Gmail).
2. Go to `https://perks-frtekwck.myshopify.com/apps/perks/verify`.
3. Enter `zeeshan@tofoapp.com`, then **Send verification link**.
4. In the `shopify app dev` terminal, find `[perks:dev-email] Verification link` and open that URL in the same browser.
5. Click **Confirm**.

**Pass:** "You're verified". Admin → **Employees** shows the row as active. **Audit log** shows `verify.request` + `verify.confirm`.

## 7. Acceptance tests

Run `docs/acceptance-tests.md` sections A–F. Notes:
- **D2 (expiry):** run `npx prisma studio`. In `EmployeeMembership`, set `expiresAt` to a past date, then go to Home → **Run expiry check now**.
- **C2 (cart link):** get a variant ID from the product's admin URL, then open `/cart/<variantId>:1` while logged in as Normal.
- Use **incognito** for the Normal/guest tests.

## 8. Report back to Rocky

For each failing test: the test ID, what happened, and a screenshot or the terminal lines (strip keys).
