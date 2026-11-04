import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useFetcher, useLoaderData } from "react-router";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { BusinessWizard } from "../components/BusinessWizard";
import type { WizardValues } from "../components/BusinessWizard";
import { TargetEditor } from "../components/TargetEditor";
import { useSaveBar } from "../components/useSaveBar";
import { merchantActor } from "../lib/admin-actor.server";
import { gql } from "../lib/admin-graphql.server";
import { parseBusinessForm } from "../lib/business";
import { domainConflicts, getBusiness } from "../lib/business.server";
import { catalogFacets } from "../lib/catalog.server";
import { isPublicEmailDomain } from "../lib/domain";
import { deleteBusiness, saveBusiness } from "../lib/settings.server";
import type { Targeting } from "../lib/targeting";
import { EMPTY_TARGET, isEmptyTarget } from "../lib/targeting";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const facets = await catalogFacets(admin);
  if (params.id === "new") {
    const own = await ownEmailDomain(admin);
    return { business: null, ...facets, ...own };
  }
  const business = await getBusiness(session.shop, params.id!);
  if (!business) throw redirect("/app/businesses");
  return { business, ...facets, shopName: "", ownDomain: null as string | null };
};

/** The store's own email domain (for the "Your own staff" preset). null for public providers. */
async function ownEmailDomain(admin: Parameters<typeof catalogFacets>[0]) {
  try {
    const data = await gql<{ shop: { email: string; name: string } }>(admin, `#graphql
      query PerksShopEmail { shop { email name } }`);
    const d = data.shop.email.split("@")[1]?.toLowerCase() ?? "";
    return { shopName: data.shop.name, ownDomain: d && !isPublicEmailDomain(d) ? d : null };
  } catch {
    return { shopName: "", ownDomain: null as string | null };
  }
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const ctx = await authenticate.admin(request);
  const shop = ctx.session.shop;
  const form = await request.formData();
  const id = params.id === "new" ? undefined : params.id;
  if (form.get("intent") === "delete" && id) {
    await deleteBusiness(ctx.admin, shop, merchantActor(ctx), id);
    return redirect("/app/businesses");
  }
  const parsed = parseBusinessForm(form);
  if (!parsed.ok) return { ok: false as const, errors: parsed.errors, id: id ?? null };
  const taken = await domainConflicts(shop, parsed.value.domains, id);
  if (taken.length)
    return { ok: false as const, errors: { domains: `Already used by another business: ${taken.join(", ")}` }, id: id ?? null };
  try {
    const b = await saveBusiness(ctx.admin, shop, merchantActor(ctx), parsed.value, id);
    return { ok: true as const, errors: {} as Record<string, string>, id: b.id };
  } catch (err) {
    console.error("[perks] save business failed", err);
    return { ok: false as const, errors: { form: err instanceof Error ? err.message : "Couldn't save" }, id: id ?? null };
  }
};

type FormState = {
  name: string;
  domains: string;
  discountType: string;
  discountValue: string;
  discountTarget: Targeting;
  employeeOnlyTarget: Targeting;
  limitPeriod: string;
  limitBasis: string;
  limitAmount: string;
  billingEmail: string;
  billingAddress: string;
  active: boolean;
};

const SAVE_BAR_ID = "business-save-bar";

export default function BusinessEdit() {
  const { business, vendors, types, currency, shopName, ownDomain } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const { leave } = useSaveBar(SAVE_BAR_ID);
  const isNew = !business;

  const initial: FormState = useMemo(
    () => ({
      name: business?.name ?? "",
      domains: business?.domains.join(", ") ?? "",
      discountType: business?.discountType ?? "percentage",
      discountValue: String(business?.discountValue ?? 10),
      discountTarget: business?.discountTarget ?? EMPTY_TARGET,
      employeeOnlyTarget: business?.employeeOnlyTarget ?? EMPTY_TARGET,
      limitPeriod: business?.limitPeriod ?? "none",
      limitBasis: business?.limitBasis ?? "discount",
      limitAmount: business?.limitAmount != null ? String(business.limitAmount) : "",
      billingEmail: business?.billingEmail ?? "",
      billingAddress: business?.billingAddress ?? "",
      active: business?.active ?? true,
    }),
    [business],
  );
  const [f, setF] = useState<FormState>(initial);
  useEffect(() => setF(initial), [initial]);
  const set = (patch: Partial<FormState>) => setF((p) => ({ ...p, ...patch }));
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const saving = fetcher.state !== "idle";
  const errors: Record<string, string> = fetcher.data && !fetcher.data.ok ? fetcher.data.errors : {};

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Business saved");
      if (isNew && fetcher.data.id) void leave(`/app/businesses/${fetcher.data.id}`);
    }
  }, [fetcher.data, shopify, isNew, leave]);


  const save = () =>
    fetcher.submit(
      {
        ...f,
        discountTarget: JSON.stringify(f.discountTarget),
        employeeOnlyTarget: JSON.stringify(f.employeeOnlyTarget),
        active: f.active ? "on" : "false",
      },
      { method: "post" },
    );
  const create = (v: WizardValues) =>
    fetcher.submit(
      {
        ...v,
        discountTarget: JSON.stringify(v.discountTarget),
        employeeOnlyTarget: JSON.stringify(v.employeeOnlyTarget),
        limitPeriod: "none",
        limitBasis: "discount",
        limitAmount: "",
        billingEmail: "",
        billingAddress: "",
        active: "on",
      },
      { method: "post" },
    );

  const hasAdvanced =
    !isEmptyTarget(initial.employeeOnlyTarget) || initial.limitPeriod !== "none" || Boolean(initial.billingEmail || initial.billingAddress);
  const [showAdvanced, setShowAdvanced] = useState(hasAdvanced);
  useEffect(() => setShowAdvanced(hasAdvanced), [hasAdvanced]);

  if (isNew)
    return (
      <s-page heading="Add business" inlineSize="small">
        <s-link slot="breadcrumb-actions" href="/app/businesses">
          Businesses
        </s-link>
        <BusinessWizard
          currency={currency}
          vendors={vendors}
          types={types}
          shopName={shopName}
          ownDomain={ownDomain}
          saving={saving}
          errors={errors}
          onSubmit={create}
        />
      </s-page>
    );

  const input = (k: keyof FormState) => (e: Event) => set({ [k]: (e.currentTarget as unknown as { value: string }).value } as Partial<FormState>);

  return (
    <s-page heading={isNew ? "Add business" : f.name || "Business"}>
      <s-link slot="breadcrumb-actions" href="/app/businesses">
        Businesses
      </s-link>
      <SaveBar id={SAVE_BAR_ID} open={dirty}>
        <button {...{ variant: "primary" }} onClick={save} {...(saving ? { loading: "" } : {})}></button>
        <button onClick={() => (isNew ? void leave("/app/businesses") : setF(initial))}></button>
      </SaveBar>

      <s-stack gap="base">
        {errors.form ? <s-banner tone="critical" heading="Couldn't save">{errors.form}</s-banner> : null}

        <s-section heading="Business">
          <s-stack gap="base">
            <s-text-field label="Name" value={f.name} onInput={input("name")} error={errors.name} placeholder="Acme Pharma" />
            <s-text-field
              label="Work email domains"
              details="Employees who log in with these email domains get this business's perks. Separate with commas."
              value={f.domains}
              onInput={input("domains")}
              error={errors.domains}
              placeholder="acme.com, acme.pk"
            />
            <s-checkbox
              label="Active"
              details="Paused businesses give no perks. Their employee-only products stay protected."
              checked={f.active}
              onChange={(e) => set({ active: (e.currentTarget as unknown as { checked: boolean }).checked })}
            />
          </s-stack>
        </s-section>

        <s-section heading="Discount">
          <s-stack gap="base">
            <s-stack direction="inline" gap="base">
              <s-select label="Type" value={f.discountType} onChange={input("discountType")}>
                <s-option value="percentage">Percentage</s-option>
                <s-option value="fixed">Fixed amount off each item</s-option>
              </s-select>
              <s-number-field
                label={f.discountType === "fixed" ? `Amount (${currency})` : "Percentage"}
                value={f.discountValue}
                onInput={input("discountValue")}
                min={f.discountType === "fixed" ? 0 : 1}
                max={f.discountType === "fixed" ? 1000000 : 90}
                step={f.discountType === "fixed" ? 0.01 : 1}
                suffix={f.discountType === "fixed" ? undefined : "%"}
                error={errors.discountValue}
              />
            </s-stack>
          </s-stack>
        </s-section>

        <s-section heading="Discounted products">
          <s-stack gap="base">
            <s-paragraph>
              Anyone can buy these at the normal price; this business&apos;s employees get the discount. Employee-only
              products below are always discounted too.
            </s-paragraph>
            <TargetEditor
              value={f.discountTarget}
              onChange={(t) => set({ discountTarget: t })}
              allowAll
              allLabel="All products in the store"
              vendors={vendors}
              types={types}
              error={errors.discountTarget}
            />
          </s-stack>
        </s-section>

        {showAdvanced ? (
          <>
          <s-section heading="Employee-only products">
            <s-stack gap="base">
              <s-paragraph>
                Only this business&apos;s employees can check out with these. Everyone else is blocked at checkout.
              </s-paragraph>
              <TargetEditor value={f.employeeOnlyTarget} onChange={(t) => set({ employeeOnlyTarget: t })} vendors={vendors} types={types} />
            </s-stack>
          </s-section>

          <s-section heading="Limit per employee">
            <s-stack gap="base">
              <s-stack direction="inline" gap="base">
                <s-select label="Period" value={f.limitPeriod} onChange={input("limitPeriod")}>
                  <s-option value="none">No limit</s-option>
                  <s-option value="month">Per month</s-option>
                  <s-option value="year">Per year</s-option>
                </s-select>
                {f.limitPeriod !== "none" ? (
                  <>
                    <s-select label="Limit on" value={f.limitBasis} onChange={input("limitBasis")}>
                      <s-option value="discount">Discount received</s-option>
                      <s-option value="spend">Total spend</s-option>
                    </s-select>
                    <s-number-field
                      label={`Amount (${currency})`}
                      value={f.limitAmount}
                      onInput={input("limitAmount")}
                      min={0}
                      step={0.01}
                      error={errors.limitAmount}
                    />
                  </>
                ) : null}
              </s-stack>
              {f.limitPeriod !== "none" ? (
                <s-text color="subdued">
                  Once an employee reaches the limit, they pay full price until the next {f.limitPeriod}. The order that
                  crosses the limit still gets the discount.
                </s-text>
              ) : null}
            </s-stack>
          </s-section>

          <s-section heading="Billing">
            <s-stack gap="base">
              <s-email-field label="Billing email" value={f.billingEmail} onInput={input("billingEmail")} error={errors.billingEmail} />
              <s-text-area label="Billing address" value={f.billingAddress} onInput={input("billingAddress")} rows={3} />
            </s-stack>
          </s-section>

          </>
        ) : (
          <s-section>
            <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
              <s-stack gap="small-300">
                <s-text type="strong">More options</s-text>
                <s-text color="subdued">Employee-only products, a monthly or yearly limit, and billing details for invoices.</s-text>
              </s-stack>
              <s-button onClick={() => setShowAdvanced(true)}>Show</s-button>
            </s-stack>
          </s-section>
        )}

        {!isNew ? (
          <s-section heading="Delete business">
            <s-stack gap="small">
              <s-paragraph>
                Its employees lose their perks. Past orders and invoices stay in Reports.
              </s-paragraph>
              <s-box>
                <s-button
                  tone="critical"
                  onClick={() => {
                    if (confirm(`Delete ${business?.name}? This can't be undone.`))
                      fetcher.submit({ intent: "delete" }, { method: "post" });
                  }}
                >
                  Delete business
                </s-button>
              </s-box>
            </s-stack>
          </s-section>
        ) : null}
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
