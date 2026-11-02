import { expect, test } from "vitest";
import { escapeHtml } from "../app/lib/html";

test("escapes HTML and Liquid syntax", () => {
  const out = escapeHtml(`<script>"x"</script>{{ shop.secret }}{% raw %}`);
  expect(out).not.toMatch(/[<>"{}%]/);
});
