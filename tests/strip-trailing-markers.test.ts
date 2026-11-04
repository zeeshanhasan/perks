import { Readable } from "stream";
import { describe, expect, it } from "vitest";
import { stripTrailingMarkers } from "../app/lib/strip-trailing-markers";

async function run(chunks: string[]) {
  let out = "";
  const t = Readable.from(chunks).pipe(stripTrailingMarkers());
  for await (const c of t) out += c.toString();
  return out;
}

const doc =
  '<html><body><!--$-->keep<!--/$--></body></html><!--$--><script>a()</script><!--$--><script>b()</script><!--/$--><!--/$-->';

describe("stripTrailingMarkers", () => {
  it("removes markers after </html> and keeps everything else", async () => {
    expect(await run([doc])).toBe(
      "<html><body><!--$-->keep<!--/$--></body></html><script>a()</script><script>b()</script>",
    );
  });

  it("works when chunks split tags and markers", async () => {
    for (let size = 1; size <= 12; size++) {
      const chunks = doc.match(new RegExp(`[\\s\\S]{1,${size}}`, "g")) ?? [];
      expect(await run(chunks)).toBe(
        "<html><body><!--$-->keep<!--/$--></body></html><script>a()</script><script>b()</script>",
      );
    }
  });
});
