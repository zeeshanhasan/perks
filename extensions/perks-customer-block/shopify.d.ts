import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/BlockExtension.tsx' {
  const shopify: import('@shopify/ui-extensions/admin.customer-details.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}
