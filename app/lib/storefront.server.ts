import db from "../db.server";
import type { AdminClient } from "./admin-graphql.server";
import { gql } from "./admin-graphql.server";
import { audit } from "./audit.server";
import { syncShopifyObjects } from "./settings.server";
import type { StorefrontOptions } from "./storefront";
import { embedEnabled, parseStorefront } from "./storefront";

export async function getStorefront(shop: string) {
  const policy = await db.benefitPolicy.findUnique({ where: { shop } });
  return parseStorefront(policy?.storefront ?? "{}");
}

export async function saveStorefront(admin: AdminClient, shop: string, actor: string, options: StorefrontOptions) {
  await db.benefitPolicy.upsert({
    where: { shop },
    create: { shop, storefront: JSON.stringify(options) },
    update: { storefront: JSON.stringify(options) },
  });
  await syncShopifyObjects(admin, shop);
  await audit({ shop, actor, action: "storefront.update", result: "ok" });
}

type ThemeFiles = {
  themes: { nodes: { name: string; files: { nodes: { body: { content?: string } }[] } }[] };
};

/** Is Employee mode switched on in the live theme? null when it can't be read (e.g. missing scope). */
export async function embedStatus(admin: AdminClient): Promise<{ on: boolean | null; theme: string | null }> {
  try {
    const data = await gql<ThemeFiles>(admin, `#graphql
      query PerksThemeEmbed {
        themes(first: 1, roles: [MAIN]) {
          nodes { name files(first: 1, filenames: ["config/settings_data.json"]) { nodes { body { ... on OnlineStoreThemeFileBodyText { content } } } } }
        }
      }`);
    const theme = data.themes.nodes[0];
    return { on: embedEnabled(theme?.files.nodes[0]?.body.content ?? null), theme: theme?.name ?? null };
  } catch (err) {
    console.warn("[perks] could not read theme settings", err);
    return { on: null, theme: null };
  }
}
