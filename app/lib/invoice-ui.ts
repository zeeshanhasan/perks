/** Downloads a file from the app. App Bridge adds the session token to fetches to the app's own URL. */
export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** An invoice's Excel file (CSV). */
export const downloadInvoiceExcel = (id: string, number: string) => downloadFile(`/app/invoices/${id}/excel`, `${number}.csv`);

/** Invoice status badge (Reports list and invoice page). */
export const STATUS_BADGE = {
  open: { label: "This month", tone: "info" },
  waiting: { label: "Waiting on orders", tone: "warning" },
  ready: { label: "Ready to send", tone: "success" },
} as const;
