import { redirect } from "react-router";

// Storefront: https://{shop}/apps/perks/confirm. Email-link verification was removed (decision 016),
// so any old link goes to the "my perks" status page.
export const loader = () => redirect("/apps/perks/verify");
export const action = () => redirect("/apps/perks/verify");
