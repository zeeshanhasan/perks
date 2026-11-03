import db from "../db.server";

/** Railway health check: the server is up and the database answers. */
export const loader = async () => {
  try {
    await db.$queryRawUnsafe("SELECT 1");
    return new Response("ok", { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response("db unavailable", { status: 503 });
  }
};
