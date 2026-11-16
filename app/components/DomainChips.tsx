import { useId, useRef, useState } from "react";
import { isPublicEmailDomain, normalizeDomain } from "../lib/domain";

export type TakenDomain = { domain: string; business: string };

type Props = {
  value: string[];
  onChange: (domains: string[]) => void;
  /** Domains already used by other businesses. */
  taken: TakenDomain[];
  error?: string;
};

/** Checks one domain the moment it's typed. Returns an error message, or null when it's fine. */
export function checkDomain(
  raw: string,
  current: string[],
  taken: TakenDomain[],
): { domain?: string; error?: string; duplicate?: boolean } {
  const d = normalizeDomain(raw.replace(/^.*@/, ""));
  if (!d) return { error: `"${raw.trim()}" isn't a valid domain. Example: acme.com` };
  if (isPublicEmailDomain(d)) return { error: `${d} is a public email provider: anyone could sign up and get perks.` };
  if (current.includes(d)) return { error: `${d} is already added.`, duplicate: true };
  const t = taken.find((x) => x.domain === d);
  if (t) return { error: `${d} is already used by ${t.business}.` };
  return { domain: d };
}

/*
 * Polaris web components can't put chips inside a text field, so this is a lookalike: a box styled like
 * s-text-field holding the chips and a plain input. Colours follow the admin's light theme.
 */
const CSS = `
.perks-chipfield { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-height: 32px; box-sizing: border-box;
  padding: 3px 8px 3px 4px; background: #fdfdfd; border: 1px solid #e1e1e1; border-radius: 8px; cursor: text; }
.perks-chipfield:hover { border-color: #cccccc; }
.perks-chipfield:focus-within { outline: 2px solid #005bd3; outline-offset: 1px; }
.perks-chipfield[data-error="true"] { border-width: 1px; border-color: #e22c38; background: #fee9e8; }
.perks-chipfield input { flex: 1 1 120px; min-width: 120px; margin-left: 4px; border: 0; outline: 0; background: transparent;
  font: inherit; font-size: 13px; line-height: 20px; padding: 2px 0; color: #303030; }
.perks-chipfield input::placeholder { color: #8a8a8a; }
.perks-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px 2px 10px; border-radius: 8px;
  background: #ebebeb; font-size: 13px; line-height: 20px; color: #303030; }
.perks-chip button { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;
  border: 0; border-radius: 6px; background: transparent; color: #616161; cursor: pointer; font-size: 15px; line-height: 1; padding: 0; }
.perks-chip button:hover { background: #d4d4d4; color: #303030; }
.perks-chip button:focus-visible { outline: 2px solid #005bd3; }
`;

/** Work email domains as chips inside the field: type a domain, press Enter or comma, and it's checked right away. */
export function DomainChips({ value, onChange, taken, error }: Props) {
  const [text, setText] = useState("");
  const [local, setLocal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const add = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).filter(Boolean);
    if (!parts.length) return;
    let next = value;
    const errors: string[] = [];
    for (const p of parts) {
      const r = checkDomain(p, next, taken);
      if (r.domain) next = [...next, r.domain];
      else if (r.error && !r.duplicate) errors.push(r.error);
    }
    if (next !== value) onChange(next);
    setLocal(errors.join(" "));
    setText(errors.length ? parts.filter((p) => checkDomain(p, value, taken).error && !checkDomain(p, value, taken).duplicate).join(", ") : "");
  };

  const shown = local || error;
  return (
    <s-stack gap="small-200">
      <style>{CSS}</style>
      <label htmlFor={id}>
        <s-text>Work email domains</s-text>
      </label>
      {/* Clicking anywhere in the box focuses the input, like a text field. The input itself is the keyboard path. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="perks-chipfield" data-error={Boolean(shown)} onClick={() => inputRef.current?.focus()}>
        {value.map((d) => (
          <span className="perks-chip" key={d}>
            @{d}
            <button
              type="button"
              aria-label={`Remove ${d}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((x) => x !== d));
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={text}
          placeholder={value.length ? "Add another domain" : "e.g. acme.com"}
          aria-invalid={Boolean(shown)}
          aria-describedby={`${id}-help`}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            const v = e.currentTarget.value;
            if (/[,;\s]$/.test(v)) add(v);
            else {
              setText(v);
              if (local) setLocal("");
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => add(text)}
        />
      </div>
      <div id={`${id}-help`}>
        {shown ? (
          <s-text tone="critical">{shown}</s-text>
        ) : (
          <s-text color="subdued">
            Type a domain and press Enter. Employees who log in with these domains get perks. A domain can belong to
            only one business.
          </s-text>
        )}
      </div>
    </s-stack>
  );
}
