// Text and structured data for the public landing page (perks.tofoapp.com): meta tags, Open Graph, JSON-LD and
// the FAQ. Kept apart from the page so tests can check it and the FAQ feeds both the page and the FAQPage schema.

export const SITE_TITLE = "Employee Perks: employee discounts for Shopify stores";
export const SITE_DESCRIPTION =
  "Give partner companies' employees automatic discounts, employee prices and employee-only products in your Shopify store. They log in with their work email; the discount applies at checkout. No codes. 30-day free trial.";
export const OG_IMAGE = "/site/og.jpg";
export const OG_IMAGE_ALT = "Employee Perks: partner employees get their own price on a Shopify store, automatically";
const KEYWORDS = [
  "employee discount Shopify",
  "staff discount Shopify app",
  "corporate discount program",
  "employee pricing",
  "employee perks",
  "B2B employee discounts",
  "work email discount",
  "employee-only products",
  "Shopify discount app",
].join(", ");

export const FAQ: readonly (readonly [string, string])[] = [
  ["What does Employee Perks do?", "It gives the employees of companies you partner with (or your own staff) their own discount, their own prices and products only they can buy in your Shopify store. They log in with their work email and the discount applies automatically at checkout."],
  ["Who is it for?", "Shopify stores that sell to employees of partner companies: corporate deals, pharmacies, gyms, fashion and food brands with B2B partners, or any store that gives its own team a staff discount."],
  ["How do employees get the discount?", "They log in to your store, or create an account, with their work email. Shopify emails them a login code, which proves the email is theirs. If the email's domain belongs to a company you added, they get that company's perks straight away."],
  ["Can someone get the discount by typing a work email at checkout?", "No. Perks only apply to logged-in customers, and Shopify's login code proves the work email. An email typed at checkout is never trusted, and guest checkout never gets perks."],
  ["Do I need discount codes?", "No. There are no codes to create, share or leak. The discount is applied by a Shopify discount function for the right customers only."],
  ["Can I give different companies different discounts?", "Yes. Add as many companies as you like. Each has its own email domains, a percentage or fixed amount off, the products, collections, vendors or types it applies to, and its own limit."],
  ["Can I give my own staff a discount too?", "Yes. Add your own company as a business with your work email domain and the staff discount."],
  ["Can I limit how much each employee gets?", "Yes. Cap the discount or the spend per employee every month or every year. The order that reaches the limit gets what's left, then full price until the limit resets."],
  ["Can some products be for employees only?", "Yes. Pick products only a company's employees can buy. Other shoppers don't see them in your collections and search, and checkout blocks them if they try."],
  ["Can I invoice the company for its employees' discounts?", "Yes. Each company gets a monthly invoice, kept up to date as orders are fulfilled or cancelled. Bill for the discount its employees got or for what they spent, and download it as PDF or Excel."],
  ["Does it work with my theme?", "Yes. Employee prices and hidden products come from a theme app embed you switch on in one click. It doesn't change your theme code, and uninstalling leaves nothing behind."],
  ["Does it work on every Shopify plan?", "Yes, from Basic and Starter to Plus. It needs the Online Store and customer accounts."],
  ["Does it work with Shopify POS?", "Not yet. Perks apply in your online store. Email us if you need POS, and we'll look at it."],
  ["Do employee discounts stack with my other discounts?", "You choose. In Settings, decide whether the employee discount combines with other product, order or shipping discounts. If not, Shopify gives the customer the better one."],
  ["How much does it cost?", "$9 a month for stores on Shopify's Basic or Starter plan, $19 a month on Grow, Advanced and Plus, or $90 and $190 a year. Every feature is included in both, after a 30-day free trial. Shopify bills it on your Shopify invoice, and upgrading Shopify later keeps your price."],
  ["Is there a free trial?", "Yes, 30 days with every feature. You can cancel any time from your Shopify admin, and it's free on development stores."],
  ["The app is new and has no reviews yet. Is it safe to try?", "Yes. The 30-day free trial lets you try every feature on your real store at no cost, checkout keeps blocking employee-only products even if something goes wrong, and uninstalling removes the discount straight away and your data 48 hours later. The developer answers support emails directly."],
  ["What data does it use?", "Customer IDs, the account email (to match the company) and orders that used the employee discount (for limits and invoices). No payment details. Data is never sold, and is deleted 48 hours after you uninstall."],
  ["How do I get help or ask for a feature?", "Email hello@tofoapp.com. You reach the developer directly: we help you set up, and we often ship features merchants ask for within days."],
  ["Can I try it before installing?", "Yes. Visit the demo store (the password is on this page) to shop as a regular customer, or ask your AI assistant about it with the prompt on this page."],
];

/** Meta tags for the landing page: title, description, canonical, Open Graph, Twitter, robots. */
export function landingMeta(siteUrl: string) {
  const image = `${siteUrl}${OG_IMAGE}`;
  return [
    { title: SITE_TITLE },
    { name: "description", content: SITE_DESCRIPTION },
    { name: "keywords", content: KEYWORDS },
    { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
    { name: "theme-color", content: "#ffffff" },
    { tagName: "link", rel: "canonical", href: `${siteUrl}/` },
    { property: "og:type", content: "website" },
    { property: "og:url", content: `${siteUrl}/` },
    { property: "og:site_name", content: "Employee Perks" },
    { property: "og:locale", content: "en_US" },
    { property: "og:title", content: SITE_TITLE },
    { property: "og:description", content: SITE_DESCRIPTION },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: OG_IMAGE_ALT },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: SITE_TITLE },
    { name: "twitter:description", content: SITE_DESCRIPTION },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: OG_IMAGE_ALT },
  ];
}

/** Structured data for search engines and AI answers: the app, its offers, the publisher and the FAQ. */
export function landingJsonLd(siteUrl: string) {
  const publisher = {
    "@type": "Organization",
    name: "Tofoapp",
    url: "https://tofoapp.com",
    email: "hello@tofoapp.com",
  };
  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Employee Perks",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Shopify app: discounts",
      operatingSystem: "Shopify",
      url: `${siteUrl}/`,
      image: `${siteUrl}${OG_IMAGE}`,
      description: SITE_DESCRIPTION,
      featureList: [
        "Automatic discount for customers logged in with a partner company's work email",
        "Many partner companies, each with its own discount and products",
        "Employee prices shown on product pages and collections",
        "Employee-only products, hidden from others and blocked at checkout",
        "Monthly or yearly limits per employee",
        "Monthly invoices per company as PDF and Excel",
        "A perks page listing partner companies",
        "Check any customer to see why they do or don't get perks",
      ],
      offers: [
        { "@type": "Offer", name: "Basic", price: "9.00", priceCurrency: "USD", description: "For stores on Shopify Basic or Starter. 30-day free trial. Or $90 a year." },
        { "@type": "Offer", name: "Standard", price: "19.00", priceCurrency: "USD", description: "For stores on Shopify Grow, Advanced or Plus. 30-day free trial. Or $190 a year." },
      ],
      publisher,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
    { "@context": "https://schema.org", "@type": "WebSite", name: "Employee Perks", url: `${siteUrl}/`, publisher },
  ];
}
