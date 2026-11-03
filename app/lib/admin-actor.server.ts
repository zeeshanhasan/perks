/** Audit actor for the merchant user behind an admin request. */
export function merchantActor(ctx: { sessionToken?: { sub?: string } | null }): string {
  return `merchant:${ctx.sessionToken?.sub ?? "admin"}`;
}
