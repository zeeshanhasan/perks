import db from "../db.server";

export type AuditInput = {
  shop: string;
  actor: string;
  action: string;
  subject?: string | null;
  result: "ok" | "rejected" | "error";
  detail?: string | null;
};

/** Never pass raw tokens or full work emails in `detail` (use maskEmail). */
export async function audit(e: AuditInput) {
  try {
    await db.auditEvent.create({
      data: {
        shop: e.shop,
        actor: e.actor,
        action: e.action,
        subject: e.subject ?? null,
        result: e.result,
        detail: e.detail?.slice(0, 500) ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write event", e.action, err);
  }
}
