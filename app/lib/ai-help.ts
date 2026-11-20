// "Ask an AI" links on Home and the public guide they point to (/llms.txt, /ai-guide).
// The guide is public: it explains the app, never a store's data.

export type AiAssistant = "claude" | "chatgpt" | "gemini";

export const AI_ASSISTANTS: { id: AiAssistant; name: string }[] = [
  { id: "claude", name: "Claude" },
  { id: "chatgpt", name: "ChatGPT" },
  { id: "gemini", name: "Gemini" },
];

/** Short on purpose: these links cut long prompts. */
export function aiPrompt(guideUrl: string): string {
  return `I use the Employee Perks app on my Shopify store. Read ${guideUrl} first, then ask me what I need help with.`;
}

/** For people deciding whether to install (the public site): same guide, different question. */
export function aboutPrompt(guideUrl: string): string {
  return `I'm looking at the Employee Perks app for Shopify. Read ${guideUrl} first, then tell me what it does and answer my questions.`;
}

/** Opens the assistant in a new chat with the prompt filled in. Gemini's ?q= isn't documented by Google. */
export function aiChatUrl(assistant: AiAssistant, prompt: string): string {
  const q = encodeURIComponent(prompt);
  switch (assistant) {
    case "claude":
      return `https://claude.ai/new?q=${q}`;
    case "chatgpt":
      return `https://chatgpt.com/?q=${q}`;
    case "gemini":
      return `https://gemini.google.com/app?q=${q}`;
  }
}

/** Public base URL of the app, for links to the guide. */
export function guideUrl(appUrl: string): string {
  const base = (appUrl || "https://perks.tofoapp.com").replace(/\/+$/, "");
  return `${base}/llms.txt`;
}

export const SIDEKICK_PROMPT = "Help me with the Employee Perks app. What can it do, and how do I set it up?";

export const AI_GUIDE = `# Employee Perks: guide for AI assistants

Last updated: 16 November 2026. Website: https://perks.tofoapp.com · Contact: hello@tofoapp.com

## How to use this guide

You're helping a Shopify merchant who uses the Employee Perks app. Answer from this guide.

- You can't see or change their store. Tell them exactly where to click: page names, section names and button labels below are the ones they see in the app.
- Give short, numbered steps. Use their words for their companies and products.
- If someone doesn't get a discount, send them to **Check a customer** first: it shows the exact reason and a button to the fix.
- Never guess store data (prices, orders, who is an employee). Ask the merchant, or point them to the page that shows it.
- If the guide doesn't cover something, say so and suggest emailing hello@tofoapp.com.

## What the app does

Employee Perks lets a Shopify store give the employees of partner companies (or its own staff) their own discount, their own prices and products only they can buy.

- The merchant adds a **business** (a partner company) with its work email domains, e.g. acme.com.
- An employee logs in to the store with their work email. Shopify's login code proves the email is theirs.
- They see their employee price while they shop, and the discount applies automatically at checkout. There are no discount codes.

It works on every Shopify plan. The app is opened from the Shopify admin: **Apps → Employee Perks**.

## Words used in the app

- **Business**: a partner company (or the store's own staff) whose employees get perks.
- **Employee**: a customer who gets a business's perks.
- **Work email domain**: the part after @ in a work email, e.g. acme.com.
- **Discounted products**: products a business's employees get the discount on. Anyone can still buy them at the normal price.
- **Employee-only products**: products only that business's employees can buy (also discounted).
- **Employee mode**: the app's theme embed. It shows employee prices and hides employee-only products in the store.
- **Perks page**: an optional public page at /apps/perks on the store listing the partner companies and their discounts.
- **My perks page**: /apps/perks/verify on the store. It tells a shopper whether they get perks, and asks them to log in with their work email if not.

## How someone becomes an employee

The only way: **log in with a work email.** A customer logged in to the store with an email at a business's domain gets that business's perks straight away. Shopify's login code proves the email is theirs.

- A customer whose store account uses a personal email (gmail.com and so on) doesn't get perks. They log out and log in, or create an account, with their work email.
- There's no email verification link. Older employees who verified that way before it was retired show as "Email link" and keep their perks until their date.

Rules that always apply:
- Perks only work for **logged-in** customers. Guest checkout never gets them, and an email typed at checkout is never trusted.
- Personal email providers (gmail.com, outlook.com and so on) can't be added to a business.
- A domain can belong to only one business.
- The merchant can remove anyone's perks on **Employees**, even if their email still matches.

## Setting up (first time)

1. **Add a business**: Businesses → **Add business**. Three steps:
   - **Who gets perks**: "A partner company" or "Your own staff", the name, and the work email domains (type a domain and press Enter).
   - **Discount**: Type (Percentage off each item, or Fixed amount off each item) and the amount. Optionally a **Limit per employee**.
   - **Products**: Discounted products (**All products in the store** or **Only some products**), and optionally **Make some products employee-only**.
2. **Turn on Employee mode**: Storefront → **Turn on** (opens the theme editor with the embed already on) → click **Save** in the theme editor. Then **Check again** on the Storefront page.
3. **Tell the employees**: they log in with their work email. Optionally switch on the **Perks page** and add it to the store menu (Online Store → Navigation).
4. **Watch and bill**: Home shows this month's numbers; Reports creates invoices.

## Pages in the app

**Home**: a setup checklist until everything is ready; **Overview** with a month picker and four cards (Employee spend, Discount given, Active employees, Active businesses, each with ↑/↓ against the month before); **Manage** (Businesses, Employees, Storefront, Perks page, Reports); **Help** (How Employee Perks works, and Ask Sidekick / Claude / ChatGPT / Gemini).

**Businesses**: the list shows each business's first domain (+N more on hover), discount, what it applies to, employee-only products, limit, employees and a **Perks** switch to pause or resume. Click a row to open it.

**A business (edit page)**:
- **Business**: Name, Work email domains, **Status** (Active or Paused). The badge next to "Business" shows the saved status.
- **Discount**: Type and amount; **Limit per employee**: No limit, **Every month (starts again on the 1st)** or **Every year (starts again on 1 January)**; **Limit on**: Discount received or Total spend; **Amount**; and **Use up what's left of the limit** (see Limits below).
- **Discounted products**: All products in the store, or Only some products. With "Only some": **Add products**, **Add collections**, **Vendor** and **Product type**. A product counts if it matches **any** of these.
- **Employee-only products**: optional, same picker. Leave empty if every product is for everyone.
- **Delete business**: stops its perks for good. Its orders and invoices stay in Reports. To stop perks for a while, set Status to Paused instead.
- After **Save**, if Shopify wasn't updated, a yellow banner appears with **Retry**.

**Employees**: everyone who gets perks, how they joined ("Work email" or "Email link"), status (Active, Removed, Expired, Not eligible), since when and until when they get perks (removed and not-eligible rows say why). Search by email or customer ID, filter by business and status, 50 per page. **Remove perks** / **Restore perks** per person. **Find existing employees** adds customers who signed up before the app was installed. Employees of a deleted business show "Business deleted" and can't be restored.

**Check a customer**: type the email a customer logs in with, press Enter. It lists each check (perks on, account found, matched to a business, business active, within the limit) and, if something fails, why and a button to the fix.

**Reports**: a **Period** (This week, Last week, This month, Last month, This year, Custom range), four cards compared with the period before, and **By business** (orders, employees, spend, discount). **Create invoice** opens a dialog: bill the business for **the discount their employees received** or **their employees' total spend**. The **Invoices** list can be filtered by business and notes when an order was cancelled after the invoice was issued.

**Invoice**: a document from the store to the partner company: invoice number, issue date, period, From (the store) and Bill to (the business), what is billed, and one row per employee per month (email, month, orders, products, spend, discount, billed). **Print / Save PDF**, and **Download for Excel (every item)** with one row per product bought. Issued invoices never change. It shows employees' work emails, so it should only go to that company.

**Storefront**: **Employee mode** status (On/Off) with Check again and Open theme editor; **What employees see** (show their price, cross out the normal price, the badge colours, with a live preview); **What other shoppers see** (hide employee-only products, and the message on those product pages, with a preview). Texts are under **Edit wording**. The backup message is used on themes that hide prices; {discount} is replaced by the discount, e.g. 15% off.

**Perks page**: switch **Show the perks page on my store** (badge Live/Off), the page address with **Copy link** and **View page**, Title, Intro, **Show each company's work email domains**, and a preview of the companies listed (active businesses only).

**Settings**: **Plan** (the store's plan, trial end date and **Manage plan**), then three store-wide options. **Employee perks** on/off switch (new stores start with it off; switching it off stops every discount at once; employee-only products stay protected), **Never discounted** (products no business discounts), **Combining with other discounts** (whether the employee discount stacks with other product, order or shipping discounts; if not, Shopify gives the better one).

**Activity**: every change: when, who (Staff, a partly hidden employee email, or "Employee Perks (automatic)"), what, and details. "Blocked" means the app stopped something on purpose; "Failed" means something went wrong. 50 per page.

**Customer page block** (in Shopify, not the app): on a customer's page, **+ Block → Employee perks**, then pin it. It shows their business, discount, limit used and left, orders and savings.

## Limits, with an example

A limit caps each employee's perks every month or every year, on the discount they get or on what they spend.

- Example (limit on discount, PKR 3,000 every month): an employee gets up to PKR 3,000 of discount each month. After that they pay full price until the 1st of next month.
- **Use up what's left of the limit** (ticked by default): if the employee has PKR 100 of discount left and the next item would get PKR 300 off, it gets PKR 100 off. Unticked, that item is full price.
- Limits count orders as they're recorded, so two orders placed within seconds of each other can both use what's left.

## Common questions and fixes

- **An employee doesn't get the discount** → Check a customer. Usual causes: not logged in; their email's domain isn't on any business; their store account uses a personal email; perks were removed on Employees; the business is paused; all perks are paused in Settings; they reached their limit; the product isn't in the business's discounted products or is in Never discounted.
- **The employee price doesn't show in the store** → Storefront: Employee mode must be On in the live theme. Prices are tuned for Dawn-style themes.
- **Someone left the company** → Employees → Remove perks.
- **Other shoppers can see an employee-only product** → with Employee mode on and "Hide employee-only products" ticked they're hidden from collections and search, and the product page shows a message. Someone with a direct link can still see the page, but checkout always blocks them.
- **The discount doesn't stack with a sale** → Settings → Combining with other discounts.
- **Gift cards** → Shopify never discounts gift cards, so they never show an employee price.
- **Invoice amount differs from Reports** → issued invoices are fixed; if an order was cancelled later, the Invoices list says so.

## Pricing

- **Basic: $9/month** ($90/year) for stores on Shopify's Basic or Starter plan. **Standard: $19/month** ($190/year) for Grow, Advanced and Plus.
- Every feature in both, unlimited companies and employees, 30-day free trial. Free on development stores.
- Billed by Shopify on the Shopify invoice. The plan is shown, changed or cancelled under **Settings → Plan → Manage plan**.
- Upgrading the Shopify plan keeps the price the store started on. The first 50 stores keep their price for life.
- If the plan ends, employee discounts and employee prices pause until a plan is chosen again; employee-only products stay protected at checkout.

## Privacy and uninstalling

- The app stores employees' customer IDs and work emails, the orders that used the employee discount (for limits, reports and invoices), and an activity log in which emails are partly hidden. It never sends emails.
- It never edits theme code. Uninstalling stops the discount and checkout rule straight away, employee-only products become normal products (unpublish them first if they must stay private), and app data is deleted 48 hours later.
- Privacy policy: https://perks.tofoapp.com/privacy · Terms: https://perks.tofoapp.com/terms

## What it doesn't do

- No discount codes, and no perks for guest checkout.
- No point-of-sale (POS) support yet.
- It can't hide a product page from someone who has the direct link (only Shopify Plus offers per-customer catalogs); checkout still blocks them.

## Contact

hello@tofoapp.com · https://perks.tofoapp.com
`;
