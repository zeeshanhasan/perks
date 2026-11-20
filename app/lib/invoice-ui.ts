/** Downloads an invoice's Excel file. App Bridge adds the session token to fetches to the app's own URL. */
export async function downloadInvoiceExcel(id: string, number: string) {
  const res = await fetch(`/app/invoices/${id}/excel`);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${number}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Invoice status badge (Reports list and invoice page). */
export const STATUS_BADGE = {
  open: { label: "This month", tone: "info" },
  waiting: { label: "Waiting on orders", tone: "warning" },
  ready: { label: "Ready to send", tone: "success" },
} as const;
