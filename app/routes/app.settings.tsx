import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { PageHelp } from "../components/ui";
import { merchantActor } from "../lib/admin-actor.server";
import {
  DISCOUNT_MAX,
  DISCOUNT_MIN,
  MONTHS_MAX,
  MONTHS_MIN,
  normalizeScope,
  parseJsonList,
  parseSettingsForm,
} from "../lib/policy";
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
    discountScope: normalizeScope(policy.discountScope),
    autoDomain: policy.autoDomain,
    combinesWithProduct: policy.combinesWithProduct,
    combinesWithOrder: policy.combinesWithOrder,
    combinesWithShipping: policy.combinesWithShipping,
    enabled: policy.enabled,
    productCount:
      parseJsonList(policy.employeeOnlyProducts).length + parseJsonList(policy.discountedProducts).length,
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
  const shopify = useAppBridge();
  const errors: Record<string, string> = result?.errors ?? {};
  const saving = nav.state !== "idle";

  useEffect(() => {
    if (result?.ok) shopify.toast.show("Settings saved");
  }, [result, shopify]);

  return (
    <s-page heading="Settings">
      <Form method="post" data-save-bar data-discard-confirmation>
        <s-stack gap="base">
          <PageHelp title="How employee perks work">
            Customers who <strong>log in with your partner&apos;s work email</strong> (for example name@company.com) get
            the discount and can buy employee-only products automatically. Employees who shop with a personal email can
            verify their work email at <code>/apps/perks/verify</code>. Guests never get perks.
          </PageHelp>

          {errors.form ? (
            <s-banner tone="critical" heading="Couldn't save your settings">
              {errors.form}
            </s-banner>
          ) : null}

          {result?.ok && s.productCount === 0 && s.discountScope === "selected" ? (
            <s-banner tone="warning" heading="Next: choose your employee products">
              Saved. The discount won&apos;t apply to anything until you pick products.
              <s-button slot="secondary-actions" href="/app/products">
                Choose products
              </s-button>
            </s-banner>
          ) : null}

          <s-section heading="Program" id="program">
            <s-switch
              name="enabled"
              label="Employee perks are on"
              details="When off, employees stop getting the discount. Employee-only products stay protected either way."
              defaultChecked={s.enabled}
            />
          </s-section>

          <s-section heading="Partner company">
            <s-stack gap="base">
              <s-text-field
                name="employerName"
                label="Company name"
                details="Shown to employees, for example on the verification page."
                placeholder="Acme Pharma"
                defaultValue={s.employerName}
                error={errors.employerName}
              />
              <s-text-field
                name="domains"
                label="Work email domains"
                details="The part after @ in their work email. Separate several with commas. Subdomains are not included."
                placeholder="acme.com, acme.pk"
                defaultValue={s.domains}
                error={errors.domains}
              />
            </s-stack>
          </s-section>

          <s-section heading="Who gets perks">
            <s-stack gap="base">
              <s-checkbox
                name="autoDomain"
                label="Automatically give perks to customers who log in with a work email"
                details="Shopify confirms the email with a login code, so it can't be faked. Turn off to require every employee to verify by email link."
                defaultChecked={s.autoDomain}
              />
              <s-select
                name="eligibilityMonths"
                label="Email-link verifications stay active for"
                details="For employees who verified a work email while shopping with a personal account. After this, they verify again."
                error={errors.eligibilityMonths}
              >
                {MONTH_OPTIONS.map((m) => (
                  <s-option key={m} value={String(m)} defaultSelected={s.eligibilityMonths === m}>
                    {m} {m === 1 ? "month" : "months"}
                  </s-option>
                ))}
                <s-option value="none" defaultSelected={s.eligibilityMonths == null}>
                  Never expire
                </s-option>
              </s-select>
            </s-stack>
          </s-section>

          <s-section heading="Discount">
            <s-stack gap="base">
              <s-number-field
                name="discountPercent"
                label="Employee discount"
                suffix="%"
                min={DISCOUNT_MIN}
                max={DISCOUNT_MAX}
                step={1}
                details={`Between ${DISCOUNT_MIN}% and ${DISCOUNT_MAX}%.`}
                defaultValue={String(s.discountPercent)}
                error={errors.discountPercent}
              />
              <s-select
                name="discountScope"
                label="Discount applies to"
                details={
                  s.discountScope === "selected"
                    ? `${s.productCount} product${s.productCount === 1 ? "" : "s"} chosen on the Products page.`
                    : "Every product in your store, except exclusions on the Products page."
                }
                error={errors.discountScope}
              >
                <s-option value="selected" defaultSelected={s.discountScope === "selected"}>
                  Products I choose
                </s-option>
                <s-option value="all_products" defaultSelected={s.discountScope === "all_products"}>
                  All products
                </s-option>
              </s-select>
              <s-link href="/app/products">Choose products</s-link>
            </s-stack>
          </s-section>

          <s-section heading="Combining with other discounts">
            <s-stack gap="small">
              <s-paragraph>
                By default, the employee discount doesn&apos;t stack. If a shopper has another discount, Shopify applies
                the better one.
              </s-paragraph>
              <s-checkbox name="combinesWithProduct" label="Other product discounts" defaultChecked={s.combinesWithProduct} />
              <s-checkbox name="combinesWithOrder" label="Order discounts" defaultChecked={s.combinesWithOrder} />
              <s-checkbox name="combinesWithShipping" label="Shipping discounts" defaultChecked={s.combinesWithShipping} />
            </s-stack>
          </s-section>

          <s-stack direction="inline" justifyContent="end">
            <s-button type="submit" variant="primary" {...(saving ? { loading: true } : {})}>
              Save
            </s-button>
          </s-stack>
        </s-stack>
      </Form>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
