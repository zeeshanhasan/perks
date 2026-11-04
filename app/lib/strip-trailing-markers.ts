import { Transform } from "stream";

const MARKERS = /<!--\/?\$-->/g;

/**
 * React Router streams its data scripts after </html>, wrapped in React's Suspense comment markers
 * (<!--$--> ... <!--/$-->). They do nothing there, but proxies that rewrite HTML can turn them into
 * a visible "$" at the bottom of every page. Remove markers that appear after </html>.
 */
export function stripTrailingMarkers() {
  let afterHtml = false;
  let carry = "";
  return new Transform({
    transform(chunk, _enc, done) {
      const text = carry + chunk.toString("utf8");
      carry = "";
      if (!afterHtml) {
        const end = text.indexOf("</html>");
        if (end === -1) {
          // keep a short tail in case "</html>" is split across chunks
          const keep = Math.min(text.length, 6);
          carry = text.slice(text.length - keep);
          done(null, text.slice(0, text.length - keep));
          return;
        }
        afterHtml = true;
        const head = text.slice(0, end + 7);
        const tail = text.slice(end + 7);
        done(null, head + clean(tail));
        return;
      }
      done(null, clean(text));
    },
    flush(done) {
      done(null, afterHtml ? carry.replace(MARKERS, "") : carry);
    },
  });

  function clean(text: string) {
    // hold back an unfinished tag or comment at the end of the chunk
    const lt = text.lastIndexOf("<");
    if (lt !== -1 && text.indexOf(">", lt) === -1) {
      carry = text.slice(lt);
      text = text.slice(0, lt);
    }
    return text.replace(MARKERS, "");
  }
}
