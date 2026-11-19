// Measures how long each step of a page load takes and logs one line per request, e.g.
//   [perks] timing app-root shop=x.myshopify.com total=812ms auth=40ms billing=760ms(shopPlan=210ms partner=540ms)
// Only step names and milliseconds: never emails, tokens or other customer data.

export type Timing = {
  /** Runs `fn`, recording how long it took under `label`. */
  step<T>(label: string, fn: () => Promise<T>): Promise<T>;
  /** Records a step measured elsewhere (e.g. a sub-step inside a helper). */
  add(label: string, ms: number): void;
  /** Logs the line. Call once, at the end of the loader. */
  done(note?: string): void;
};

export function startTiming(name: string, shop?: string): Timing {
  const t0 = performance.now();
  const parts: string[] = [];
  const ms = (n: number) => `${Math.round(n)}ms`;
  return {
    async step(label, fn) {
      const s = performance.now();
      try {
        return await fn();
      } finally {
        parts.push(`${label}=${ms(performance.now() - s)}`);
      }
    },
    add(label, n) {
      parts.push(`${label}=${ms(n)}`);
    },
    done(note) {
      const total = ms(performance.now() - t0);
      console.log(`[perks] timing ${name}${shop ? ` shop=${shop}` : ""} total=${total} ${parts.join(" ")}${note ? ` ${note}` : ""}`);
    },
  };
}

/** Times a promise for `add`, without changing its result. */
export async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const s = performance.now();
  const v = await fn();
  return [v, performance.now() - s];
}
