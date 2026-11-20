import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useFetcher, useLoaderData } from "react-router";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { RouteError } from "../components/RouteError";
import { DISCOUNTED_PRODUCTS_NOTE, DiscountFields, EmployeeOnlyHelp, GreenNote, LimitFields } from "../components/BusinessFields";
import { BusinessWizard } from "../components/BusinessWizard";
import { DomainChips } from "../components/DomainChips";
import type { WizardValues } from "../components/BusinessWizard";
import { TargetEditor } from "../components/TargetEditor";
import { useSaveBar } from "../components/useSaveBar";
import { merchantActor } from "../lib/admin-actor.server";
import { gql } from "../lib/admin-graphql.server";
import { parseBusinessForm } from "../lib/business";
import { domainConflicts, getBusiness, takenDomains } from "../lib/business.server";
import { catalogFacets, shopInfo } from "../lib/catalog.server";
import { isPublicEmailDomain } from "../lib/domain";
import { deleteBusiness, deleteImpact, saveBusiness } from "../lib/settings.server";
import type { Targeting } from "../lib/targeting";
import { EMPTY_TARGET, isEmptyTarget } from "../lib/targeting";
import db from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const isNew = params.id === "new";
  // The store's vendor and product type lists are the slowest part: stream them in after the page shows.
  const lists = catalogFacets(admin).then(({ vendors, types }) => ({ vendors, types }));
  const [info, business, taken, impact, own, policy] = await Promise.all([
    shopInfo(admin, shop),
    isNew ? null : getBusiness(shop, params.id!),
    takenDomains(shop, isNew ? undefined : params.id),
    isNew ? { employees: 0, orders: 0 } : deleteImpact(shop, params.id!),
    isNew ? ownEmailDomain(admin) : { shopName: "", ownDomain: null as string | null },
    db.benefitPolicy.findUnique({ where: { shop }, select: { enabled: true, discountId: true } }),
  ]);
  if (!isNew && !business) throw redirect("/app/businesses");
  const programOn = Boolean(policy?.enabled && policy.discountId);
  return { business, currency: info.currency, lists, taken, impact, programOn, ...own };
};

const NO_LISTS = { vendors: [] as string[], types: [] as string[] };

/** Value of a streamed loader promise, or the fallback until it arrives (or if it fails). */
function useStreamed<T>(promise: Promise<T>, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    let live = true;
    promise.then((v) => live && setValue(v)).catch(() => {});
    return () => {
      live = false;
    };
  }, [promise]);
  return value;
}

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
    try {
      await deleteBusiness(ctx.admin, shop, merchantActor(ctx), id);
    } catch (err) {
      console.error("[perks] delete business failed", err);
      return { ok: false as const, errors: { form: "Couldn't delete the business. Try again." } as Record<string, string>, id };
    }
    return redirect("/app/businesses");
  }
  const parsed = parseBusinessForm(form);
  if (!parsed.ok) return { ok: false as const, errors: parsed.errors, id: id ?? null };
  const taken = await domainConflicts(shop, parsed.value.domains, id);
  if (taken.length)
    return { ok: false as const, errors: { domains: `Already used by another business: ${taken.join(", ")}` }, id: id ?? null };
  try {
    const b = await saveBusiness(ctx.admin, shop, merchantActor(ctx), parsed.value, id);
    return { ok: true as const, errors: {} as Record<string, string>, id: b.id, warning: b.syncError };
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
  limitOverflow: string;
  billingEmail: string;
  billingAddress: string;
  active: boolean;
};

const SAVE_BAR_ID = "business-save-bar";

export default function BusinessEdit() {
  const { business, lists, currency, shopName, ownDomain, impact, taken, programOn } = useLoaderData<typeof loader>();
  const { vendors, types } = useStreamed(lists, NO_LISTS);
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
      limitOverflow: business?.limitOverflow ?? "partial",
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

  // Saved to our database but Shopify wasn't updated: a banner with Retry until a save syncs (decision 010).
  const [syncFailed, setSyncFailed] = useState(false);
  useEffect(() => {
    if (fetcher.data?.ok) {
      setSyncFailed(Boolean(fetcher.data.warning));
      if (fetcher.data.warning) shopify.toast.show("Saved, but Shopify wasn't updated", { isError: true });
      else if (!isNew) shopify.toast.show("Business saved");
      else shopify.toast.show(programOn ? "Business created. Its employees get perks now." : "Business created. Next: turn on employee perks.");
      // Program still off: Home shows the setup checklist with the next step.
      if (isNew && fetcher.data.id) void leave(programOn ? `/app/businesses/${fetcher.data.id}` : "/app");
    }
  }, [fetcher.data, shopify, isNew, leave, programOn]);


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
        billingAddress: "",
        active: "on",
      },
      { method: "post" },
    );

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
          programOn={programOn}
          taken={taken}
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
        {syncFailed && !errors.form ? (
          <s-banner tone="warning" heading="Saved, but Shopify isn't updated yet">
            Your changes are saved here, but Shopify didn&apos;t take them, so perks may still follow the old settings.
            <s-button slot="secondary-actions" loading={saving} onClick={save}>
              Retry
            </s-button>
          </s-banner>
        ) : null}

        <s-section heading="Business">
          {/* s-page has no badge slot; the first section's header is the closest place. Shows the saved status. */}
          <s-badge slot="accessory" tone={initial.active ? "success" : "neutral"}>
            {initial.active ? "Active" : "Paused"}
          </s-badge>
          <s-stack gap="base">
            <s-text-field label="Name" value={f.name} onInput={input("name")} error={errors.name} />
            <DomainChips
              value={f.domains ? f.domains.split(/,\s*/).filter(Boolean) : []}
              onChange={(d) => set({ domains: d.join(", ") })}
              taken={taken}
              error={errors.domains}
            />
            <s-divider />
            <s-select
              label="Status"
              value={f.active ? "active" : "paused"}
              onChange={(e) => set({ active: (e.currentTarget as unknown as { value: string }).value === "active" })}
              details={
                f.active
                  ? "Employees get their perks."
                  : "No perks for now. Its employee-only products stay protected. Switch back to Active any time."
              }
            >
              <s-option value="active">Active</s-option>
              <s-option value="paused">Paused</s-option>
            </s-select>
          </s-stack>
        </s-section>

        <s-section heading="Discount">
          <s-stack gap="base">
            <DiscountFields
              discountType={f.discountType}
              discountValue={f.discountValue}
              currency={currency}
              error={errors.discountValue}
              onChange={set}
            />
            <s-divider />
            <LimitFields value={f} currency={currency} error={errors.limitAmount} onChange={set} />
          </s-stack>
        </s-section>

        <s-section heading="Discounted products">
          <s-stack gap="base">
            <GreenNote>{DISCOUNTED_PRODUCTS_NOTE}</GreenNote>
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

        {/* Billing email/address are hidden for now (unused so far); saved values are kept and still print on invoices. */}
        <s-section heading="Employee-only products">
          <s-stack gap="base">
            <s-paragraph>
              Optional. Products only this business&apos;s employees can buy. Leave empty if every product is for everyone.
            </s-paragraph>
            <TargetEditor value={f.employeeOnlyTarget} onChange={(t) => set({ employeeOnlyTarget: t })} vendors={vendors} types={types} />
            <EmployeeOnlyHelp />
          </s-stack>
        </s-section>

        <s-section heading="Delete business">
          <s-stack gap="small">
            <s-paragraph>Stop this business&apos;s perks for good. Its past orders and invoices stay in Reports.</s-paragraph>
            <s-box>
              <s-button tone="critical" commandFor="delete-modal" command="--show">
                Delete business
              </s-button>
            </s-box>
          </s-stack>
        </s-section>

        <s-modal id="delete-modal" heading={`Delete ${business?.name}?`}>
          <s-stack gap="base">
            <s-unordered-list>
              <s-list-item>
                <strong>
                  {impact.employees} employee{impact.employees === 1 ? "" : "s"}
                </strong>{" "}
                lose{impact.employees === 1 ? "s" : ""} perks right away.
              </s-list-item>
              {!isEmptyTarget(initial.employeeOnlyTarget) ? (
                <s-list-item>
                  <strong>Its employee-only products become normal products anyone can buy.</strong> Unpublish them first
                  if they must stay private.
                </s-list-item>
              ) : null}
              <s-list-item>
                Its {impact.orders} order{impact.orders === 1 ? "" : "s"} and invoices stay in Reports.
              </s-list-item>
              <s-list-item>This can&apos;t be undone. To stop perks for a while, pause it instead.</s-list-item>
            </s-unordered-list>
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            loading={saving}
            onClick={() => fetcher.submit({ intent: "delete" }, { method: "post" })}
          >
            Delete business
          </s-button>
          {f.active ? (
            <s-button
              slot="secondary-actions"
              commandFor="delete-modal"
              command="--hide"
              onClick={() => {
                set({ active: false });
                shopify.toast.show("Paused. Click Save to apply.");
              }}
            >
              Pause instead
            </s-button>
          ) : null}
          <s-button slot="secondary-actions" commandFor="delete-modal" command="--hide">
            Cancel
          </s-button>
        </s-modal>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

export function ErrorBoundary() {
  return <RouteError heading="Business" />;
}
