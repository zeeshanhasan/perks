import { useState } from "react";
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

/** Work email domains as chips: type a domain, press Enter or comma, and it's checked right away. */
export function DomainChips({ value, onChange, taken, error }: Props) {
  const [text, setText] = useState("");
  const [local, setLocal] = useState("");

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

  return (
    <s-stack gap="small">
      {/* keydown bubbles out of the field's shadow DOM, so Enter is caught here. The Add button is the accessible path. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(text);
          }
        }}
      >
      <s-text-field
        label="Work email domains"
        details="Type a domain and press Enter, for example acme.com. Employees who log in with these domains get perks."
        value={text}
        placeholder="acme.com"
        error={local || error}
        onInput={(e) => {
          const v = (e.currentTarget as unknown as { value: string }).value;
          if (/[,;\s]$/.test(v)) add(v);
          else {
            setText(v);
            if (local) setLocal("");
          }
        }}
        onBlur={() => add(text)}
      >
        <s-button slot="accessory" variant="tertiary" onClick={() => add(text)}>
          Add
        </s-button>
      </s-text-field>
      </div>
      {value.length ? (
        <s-stack direction="inline" gap="small-200">
          {value.map((d) => (
            <s-clickable-chip
              key={d}
              removable
              accessibilityLabel={`Remove ${d}`}
              onRemove={() => onChange(value.filter((x) => x !== d))}
            >
              @{d}
            </s-clickable-chip>
          ))}
        </s-stack>
      ) : null}
    </s-stack>
  );
}
