import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { merchantActor } from "../lib/admin-actor.server";
import { DISCOUNT_MAX, DISCOUNT_MIN, MONTHS_MAX, MONTHS_MIN, parseJsonList, parseSettingsForm } from "../lib/policy";
import { getSettings, saveSettings } from "../lib/settings.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { employer, policy } = await getSettings(session.shop);
  return {
    employerName: employer.name,
    domains: parseJsonList(employer.domains).join(", "),
    discountPercent: policy.discountPercent,
    eligibilityMonths: policy.eligibilityMonths,
    discountScope: policy.discountScope,
    combinesWithProduct: policy.combinesWithProduct,
    combinesWithOrder: policy.combinesWithOrder,
    combinesWithShipping: policy.combinesWithShipping,
    enabled: policy.enabled,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const ctx = await authenticate.admin(request);
  const parsed = parseSettingsForm(await request.formData());
  if (!parsed.ok) return { ok: false as const, errors: parsed.errors };
  try {
    await saveSettings(ctx.admin, ctx.session.shop, merchantActor(ctx), parsed.value);
    return { ok: true as const, errors: {} as Record<string, string> };
  } catch (err) {
    console.error("[perks] save settings failed", err);
    return {
      ok: false as const,
      errors: { form: err instanceof Error ? err.message : "Couldn't save. Try again." } as Record<string, string>,
    };
  }
};

const MONTH_OPTIONS = Array.from({ length: MONTHS_MAX - MONTHS_MIN + 1 }, (_, i) => i + MONTHS_MIN);

export default function Settings() {
  const s = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const nav = useNavigation();
  const errors: Record<string, string> = result?.errors ?? {};

  return (
    <s-page heading="Settings">
      <Form method="post">
        {result?.ok ? <s-banner tone="success" heading="Saved" /> : null}
        {errors.form ? <s-banner tone="critical" heading="Couldn't save">{errors.form}</s-banner> : null}

        <s-section heading="Program">
          <s-checkbox
            name="enabled"
            label="Program on (employee discount active)"
            details="Turning this off stops the discount and new verifications. Employee-only products stay protected."
            defaultChecked={s.enabled}
          />
        </s-section>

        <s-section heading="Employer">
          <s-stack gap="base">
            <s-text-field
              name="employerName"
              label="Employer name"
              defaultValue={s.employerName}
              error={errors.employerName}
            />
            <s-text-field
              name="domains"
              label="Approved email domains"
              details="Comma-separated. Exact match only: subdomains are not included."
              placeholder="example.com, example.pk"
              defaultValue={s.domains}
              error={errors.domains}
            />
          </s-stack>
        </s-section>

        <s-section heading="Discount">
          <s-stack gap="base">
            <s-number-field
              name="discountPercent"
              label="Discount (%)"
              min={DISCOUNT_MIN}
              max={DISCOUNT_MAX}
              step={1}
              defaultValue={String(s.discountPercent)}
              error={errors.discountPercent}
            />
            <s-select name="discountScope" label="Applies to" error={errors.discountScope}>
              <s-option value="employee_only" defaultSelected={s.discountScope !== "all_products"}>Employee-only products</s-option>
              <s-option value="all_products" defaultSelected={s.discountScope === "all_products"}>All products (except exclusions)</s-option>
            </s-select>
            <s-text>Combines with</s-text>
            <s-checkbox name="combinesWithProduct" label="Other product discounts" defaultChecked={s.combinesWithProduct} />
            <s-checkbox name="combinesWithOrder" label="Order discounts" defaultChecked={s.combinesWithOrder} />
            <s-checkbox name="combinesWithShipping" label="Shipping discounts" defaultChecked={s.combinesWithShipping} />
          </s-stack>
        </s-section>

        <s-section heading="Eligibility">
          <s-select
            name="eligibilityMonths"
            label="Employees stay eligible for"
            details="After this, they must verify again. Changes apply to new verifications."
            error={errors.eligibilityMonths}
          >
            {MONTH_OPTIONS.map((m) => (
              <s-option key={m} value={String(m)} defaultSelected={s.eligibilityMonths === m}>
                {m} {m === 1 ? "month" : "months"}
              </s-option>
            ))}
            <s-option value="none" defaultSelected={s.eligibilityMonths == null}>No expiry</s-option>
          </s-select>
        </s-section>

        <s-section>
          <s-button type="submit" variant="primary" {...(nav.state !== "idle" ? { loading: true } : {})}>
            Save
          </s-button>
        </s-section>
      </Form>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
