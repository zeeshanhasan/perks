/**
 * Escape text for HTML that is also rendered as Liquid (app proxy responses).
 * Braces and % are escaped so user input can't inject Liquid tags/objects.
 */
export function escapeHtml(input: unknown): string {
  return String(input ?? "").replace(/[&<>"'`{}%]/g, (c) => `&#${c.charCodeAt(0)};`);
}
