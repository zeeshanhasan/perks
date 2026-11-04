import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";

/** Unknown page inside the admin app (e.g. a link from an older version): go to the app home. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const search = new URL(request.url).search;
  throw redirect(`/app${search}`);
};
