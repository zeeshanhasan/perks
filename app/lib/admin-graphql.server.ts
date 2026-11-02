/* eslint-disable @typescript-eslint/no-explicit-any -- GraphQL responses are untyped JSON */
/** Minimal Admin GraphQL client shape (satisfied by the library's `admin` context). */
export type AdminClient = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

export class AdminGraphqlError extends Error {
  constructor(
    message: string,
    public readonly details: unknown,
  ) {
    super(message);
  }
}

/** Runs a query, throws on top-level errors, returns `data`. */
export async function gql<T = any>(
  admin: AdminClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await admin.graphql(query, { variables });
  const json: any = await res.json();
  if (json.errors) throw new AdminGraphqlError("GraphQL error", json.errors);
  return json.data as T;
}

/** Throws if a mutation payload contains userErrors. */
export function assertNoUserErrors(payload: { userErrors?: { message: string }[] } | null | undefined, op: string) {
  const errs = payload?.userErrors ?? [];
  if (errs.length) throw new AdminGraphqlError(`${op}: ${errs.map((e) => e.message).join("; ")}`, errs);
}
