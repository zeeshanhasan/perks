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

type Item = { key: string; label: string };

/** One "Products: [chip] [chip]" row of the chosen list. */
function Group({ label, items, onRemove }: { label: string; items: Item[]; onRemove: (key: string) => void }) {
  if (!items.length) return null;
  return (
    <s-grid gridTemplateColumns="@container (inline-size > 600px) 120px 1fr, 1fr" gap="small" alignItems="start">
      <s-box paddingBlockStart="small-300">
        <s-text color="subdued">{label}</s-text>
      </s-box>
      <s-stack direction="inline" gap="small-200">
        {items.map((i) => (
          <s-clickable-chip key={i.key} removable accessibilityLabel={`Remove ${i.label}`} onRemove={() => onRemove(i.key)}>
            {i.label}
          </s-clickable-chip>
        ))}
      </s-stack>
    </s-grid>
  );
}

/** Adds a vendor or product type: a list of the store's values, or a text field when the store has none left. */
function StringAdder({
  label,
  options,
  selected,
  onAdd,
  placeholder,
}: {
  label: string;
  options: string[];
  selected: string[];
  onAdd: (v: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const remaining = options.filter((o) => !selected.some((s) => s.toLowerCase() === o.toLowerCase()));
  const add = (v: string) => {
    const t = v.trim();
    if (t && !selected.some((s) => s.toLowerCase() === t.toLowerCase())) onAdd(t);
    setDraft("");
  };
  if (remaining.length)
    return (
      <s-select
        label={label}
        value=""
        onChange={(e) => {
          const el = e.currentTarget as unknown as { value: string };
          if (el.value) add(el.value);
          el.value = "";
        }}
      >
        <s-option value="">Add {label.toLowerCase()}…</s-option>
        {remaining.map((o) => (
          <s-option key={o} value={o}>
            {o}
          </s-option>
        ))}
      </s-select>
    );
  return (
    <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
      <s-text-field
        label={label}
        placeholder={placeholder}
        value={draft}
        onInput={(e) => setDraft((e.currentTarget as unknown as { value: string }).value)}
      />
      <s-button onClick={() => add(draft)}>Add</s-button>
    </s-grid>
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

  const chosen = value.products.length + value.collections.length + value.vendors.length + value.types.length;
  const strings = (xs: string[]) => xs.map((x) => ({ key: x, label: x }));

  return (
    <s-stack gap="base">
      {error ? <s-banner tone="critical">{error}</s-banner> : null}
      {allowAll ? (
        <s-choice-list
          label="Products"
          labelAccessibilityVisibility="exclusive"
          onChange={(e) => set({ all: (e.currentTarget as unknown as { values: string[] }).values?.[0] === "all" })}
        >
          <s-choice value="all" selected={value.all}>
            {allLabel ?? "All products"}
          </s-choice>
          <s-choice value="some" selected={!value.all}>
            Only some products
          </s-choice>
        </s-choice-list>
      ) : null}
      {!value.all ? (
        <s-box padding="base" border="base" borderRadius="base">
          <s-stack gap="base">
            <s-text color="subdued">A product counts if it matches any of these.</s-text>
            <s-stack direction="inline" gap="small">
              <s-button icon="product" onClick={() => pick("product")}>
                {value.products.length ? "Edit products" : "Add products"}
              </s-button>
              <s-button icon="collection" onClick={() => pick("collection")}>
                {value.collections.length ? "Edit collections" : "Add collections"}
              </s-button>
            </s-stack>
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
              <StringAdder
                label="Vendor"
                options={vendors}
                selected={value.vendors}
                onAdd={(v) => set({ vendors: [...value.vendors, v] })}
                placeholder="e.g. Nature's Way"
              />
              <StringAdder
                label="Product type"
                options={types}
                selected={value.types}
                onAdd={(v) => set({ types: [...value.types, v] })}
                placeholder="e.g. Vitamins"
              />
            </s-grid>
            <s-divider />
            {chosen ? (
              <s-stack gap="small">
                <Group
                  label="Products"
                  items={value.products.map((p) => ({ key: p.id, label: p.title || "Product" }))}
                  onRemove={(k) => set({ products: value.products.filter((p) => p.id !== k) })}
                />
                <Group
                  label="Collections"
                  items={value.collections.map((c) => ({ key: c.id, label: c.title || c.id.split("/").pop() || "Collection" }))}
                  onRemove={(k) => set({ collections: value.collections.filter((c) => c.id !== k) })}
                />
                <Group label="Vendors" items={strings(value.vendors)} onRemove={(k) => set({ vendors: value.vendors.filter((v) => v !== k) })} />
                <Group label="Product types" items={strings(value.types)} onRemove={(k) => set({ types: value.types.filter((t) => t !== k) })} />
              </s-stack>
            ) : (
              <s-text color="subdued">Nothing chosen yet.</s-text>
            )}
          </s-stack>
        </s-box>
      ) : null}
    </s-stack>
  );
}
