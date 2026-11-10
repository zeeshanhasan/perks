import type { LoaderFunctionArgs } from "react-router";
import { shopCurrency } from "../lib/catalog.server";
import { customerPerks } from "../lib/customer-perks.server";
import { authenticate } from "../shopify.server";

// GET /api/customer-perks/:id — for the "Employee perks" block on the Shopify customer page.
// Called by the admin UI extension with a Shopify ID token (authenticate.admin verifies it).

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session, cors } = await authenticate.admin(request);
  const id = String(params.id ?? "").split("/").pop() ?? "";
  if (!/^\d+$/.test(id)) return cors(Response.json({ error: "Invalid customer" }, { status: 400 }));
  try {
    const { currency } = await shopCurrency(admin);
    return cors(Response.json(await customerPerks(admin, session.shop, id, currency)));
  } catch (err) {
    console.error("[perks] customer perks failed", err);
    return cors(Response.json({ error: "Couldn't load perks" }, { status: 500 }));
  }
};
