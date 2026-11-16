/** What a merchant types as their store → "your-store.myshopify.com".
 * Accepts "your-store", "your-store.myshopify.com", "https://your-store.myshopify.com/..." or the admin URL
 * "admin.shopify.com/store/your-store". Shopify's login validates the result. */
export function normalizeShop(raw: string): string {
  let v = raw.trim().toLowerCase().replace(/^https?:\/\//, "");
  const admin = v.match(/admin\.shopify\.com\/store\/([a-z0-9-]+)/);
  if (admin) return `${admin[1]}.myshopify.com`;
  v = v.split("/")[0];
  if (v && !v.includes(".")) v = `${v}.myshopify.com`;
  return v;
}
