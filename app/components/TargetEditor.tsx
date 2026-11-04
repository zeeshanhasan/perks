import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { Ref, Targeting } from "../lib/targeting";

type Props = {
  value: Targeting;
  onChange: (t: Targeting) => void;
  allowAll?: boolean;
  allLabel?: string;
  vendors: string[];
  types: string[];
  error?: string;
};

function Chips({ items, onRemove }: { items: { key: string; label: string }[]; onRemove: (key: string) => void }) {
  if (!items.length) return null;
  return (
    <s-stack direction="inline" gap="small-200">
      {items.map((i) => (
        <s-clickable-chip key={i.key} removable accessibilityLabel={`Remove ${i.label}`} onRemove={() => onRemove(i.key)}>
          {i.label}
        </s-clickable-chip>
      ))}
    </s-stack>
  );
}

function StringPicker({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (v: string) => {
    const t = v.trim();
    if (t && !selected.some((s) => s.toLowerCase() === t.toLowerCase())) onChange([...selected, t]);
    setDraft("");
  };
  const remaining = options.filter((o) => !selected.some((s) => s.toLowerCase() === o.toLowerCase()));
  return (
    <s-stack gap="small-200">
      <s-stack direction="inline" gap="small" alignItems="end">
        {remaining.length ? (
          <s-box inlineSize="100%">
            <s-select
              label={label}
              onChange={(e) => {
                const v = (e.currentTarget as unknown as { value: string }).value;
                if (v) add(v);
              }}
            >
              <s-option value="">Add {label.toLowerCase()}…</s-option>
              {remaining.map((o) => (
                <s-option key={o} value={o}>
                  {o}
                </s-option>
              ))}
            </s-select>
          </s-box>
        ) : (
          <s-box inlineSize="100%">
            <s-text-field
              label={label}
              placeholder={placeholder}
              value={draft}
              onInput={(e) => setDraft((e.currentTarget as unknown as { value: string }).value)}
            />
          </s-box>
        )}
        {!remaining.length ? <s-button onClick={() => add(draft)}>Add</s-button> : null}
      </s-stack>
      <Chips
        items={selected.map((s) => ({ key: s, label: s }))}
        onRemove={(k) => onChange(selected.filter((s) => s !== k))}
      />
    </s-stack>
  );
}

export function TargetEditor({ value, onChange, allowAll, allLabel, vendors, types, error }: Props) {
  const shopify = useAppBridge();
  const set = (patch: Partial<Targeting>) => onChange({ ...value, ...patch });

  async function pick(type: "product" | "collection") {
    const current = type === "product" ? value.products : value.collections;
    const selected = await shopify.resourcePicker({ type, multiple: true, selectionIds: current.map((r) => ({ id: r.id })) });
    if (!selected) return;
    const refs: Ref[] = selected.map((s: { id: string; title: string }) => ({ id: s.id, title: s.title }));
    set(type === "product" ? { products: refs } : { collections: refs });
  }

  return (
    <s-stack gap="base">
      {error ? (
        <s-banner tone="critical">{error}</s-banner>
      ) : null}
      {allowAll ? (
        <s-checkbox
          label={allLabel ?? "All products"}
          checked={value.all}
          onChange={(e) => set({ all: (e.currentTarget as unknown as { checked: boolean }).checked })}
        />
      ) : null}
      {!value.all ? (
        <>
          <s-stack gap="small-200">
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-button icon="product" onClick={() => pick("product")}>
                Products{value.products.length ? ` (${value.products.length})` : ""}
              </s-button>
              <s-button icon="collection" onClick={() => pick("collection")}>
                Collections{value.collections.length ? ` (${value.collections.length})` : ""}
              </s-button>
            </s-stack>
            <Chips
              items={[
                ...value.products.map((p) => ({ key: p.id, label: p.title || "Product" })),
                ...value.collections.map((c) => ({ key: c.id, label: `Collection: ${c.title || c.id.split("/").pop()}` })),
              ]}
              onRemove={(k) =>
                set({ products: value.products.filter((p) => p.id !== k), collections: value.collections.filter((c) => c.id !== k) })
              }
            />
          </s-stack>
          <StringPicker label="Vendor" options={vendors} selected={value.vendors} onChange={(v) => set({ vendors: v })} placeholder="e.g. Nature's Way" />
          <StringPicker label="Product type" options={types} selected={value.types} onChange={(v) => set({ types: v })} placeholder="e.g. Vitamins" />
        </>
      ) : null}
    </s-stack>
  );
}
