import { useEffect, useState } from "react";
import type { Targeting } from "../lib/targeting";
import { EMPTY_TARGET, isEmptyTarget } from "../lib/targeting";
import type { TakenDomain } from "./DomainChips";
import { DomainChips } from "./DomainChips";
import { TargetEditor } from "./TargetEditor";
import type { LimitValues } from "./BusinessFields";
import {
  DISCOUNTED_PRODUCTS_NOTE,
  DiscountFields,
  EmployeeOnlyHelp,
  LimitFields,
  limitSentence,
} from "./BusinessFields";
import { discountValueError, formatMoney } from "../lib/business";

/**
 * "Add business" in three short steps. Uses the same fields as the Edit business page
 * (BusinessFields, TargetEditor) so both read the same.
 */

type Preset = "partner" | "staff";

export type WizardValues = {
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
  billFor: string;
};

type Props = {
  currency: string;
  vendors: string[];
  types: string[];
  shopName: string;
  ownDomain: string | null;
  /** Employee perks are on in Settings (otherwise nobody gets the discount yet). */
  programOn: boolean;
  taken: TakenDomain[];
  saving: boolean;
  errors: Record<string, string>;
  onSubmit: (v: WizardValues) => void;
};

const value = (e: Event) => (e.currentTarget as unknown as { value: string }).value;
const values = (e: Event) => (e.currentTarget as unknown as { values: string[] }).values ?? [];

const STEPS = ["Who gets perks", "Discount", "Products"];

export function BusinessWizard({ currency, vendors, types, shopName, ownDomain, programOn, taken, saving, errors, onSubmit }: Props) {
  const [step, setStep] = useState(1);
  const [preset, setPreset] = useState<Preset>("partner");
  const [name, setName] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [discount, setDiscount] = useState({ discountType: "percentage", discountValue: "10" });
  const [limit, setLimit] = useState<LimitValues>({ limitPeriod: "none", limitBasis: "discount", limitAmount: "", limitOverflow: "partial" });
  const [discountTarget, setDiscountTarget] = useState<Targeting>({ ...EMPTY_TARGET, all: true });
  const [employeeOnly, setEmployeeOnly] = useState(false);
  const [employeeOnlyTarget, setEmployeeOnlyTarget] = useState<Targeting>(EMPTY_TARGET);
  const [stepError, setStepError] = useState("");

  // Server errors: jump back to the step that has the problem.
  useEffect(() => {
    if (errors.name || errors.domains) setStep(1);
    else if (errors.discountValue || errors.limitAmount) setStep(2);
    else if (errors.discountTarget) setStep(3);
  }, [errors]);

  const choosePreset = (p: Preset) => {
    setPreset(p);
    if (p === "staff") {
      if (!name) setName(shopName || "Our team");
      if (!domains.length && ownDomain && !taken.some((t) => t.domain === ownDomain)) setDomains([ownDomain]);
    }
  };

  const next = () => {
    setStepError("");
    if (step === 1 && (!name.trim() || !domains.length))
      return setStepError("Add a name and at least one email domain (type it and press Enter).");
    const discountError = discountValueError(discount.discountType, discount.discountValue);
    if (step === 2 && discountError) return setStepError(discountError);
    if (step === 2 && limit.limitPeriod !== "none" && !(Number(limit.limitAmount) > 0)) return setStepError("Enter the limit amount.");
    setStep(step + 1);
  };

  const firstDomain = domains.length > 1 ? `${domains[0]} (or ${domains.length - 1} more)` : (domains[0] ?? "their domain");
  const onlyEmployeeOnly = employeeOnly && !isEmptyTarget(employeeOnlyTarget);
  const nothingPicked = !discountTarget.all && isEmptyTarget(discountTarget);
  const products = discountTarget.all
    ? "every product"
    : nothingPicked
      ? "their employee-only products"
      : "the products you picked";
  const summary = nothingPicked && !onlyEmployeeOnly ? "Pick the products that get the discount to see the summary." : [
    `Anyone who logs in with an @${firstDomain} email gets ${
      discount.discountType === "fixed"
        ? `${formatMoney(Number(discount.discountValue) || 0, currency)} off each item of`
        : `${Number(discount.discountValue) || 0}% off`
    } ${products}.`,
    employeeOnly && !isEmptyTarget(employeeOnlyTarget) ? "Some products are for them only." : "",
    limitSentence(limit, currency),
    programOn ? "" : "This starts once you turn on employee perks in Settings.",
  ]
    .filter(Boolean)
    .join(" ");

  const create = () => {
    const onlyChosen = employeeOnly && !isEmptyTarget(employeeOnlyTarget);
    if (!discountTarget.all && isEmptyTarget(discountTarget) && !onlyChosen)
      return setStepError("Pick at least one product, collection, vendor or type.");
    if (employeeOnly && isEmptyTarget(employeeOnlyTarget))
      return setStepError("Pick the employee-only products, or untick that option.");
    setStepError("");
    onSubmit({
      name: name.trim(),
      domains: domains.join(", "),
      ...discount,
      discountTarget,
      employeeOnlyTarget: onlyChosen ? { ...employeeOnlyTarget, all: false } : EMPTY_TARGET,
      ...limit,
      limitAmount: limit.limitPeriod === "none" ? "" : limit.limitAmount,
      billingEmail: "",
      billFor: "discount",
    });
  };

  return (
    <s-stack gap="base">
      <s-text color="subdued">
        Step {step} of 3 · {STEPS[step - 1]}
      </s-text>
      {errors.form ? <s-banner tone="critical" heading="Couldn't create the business">{errors.form}</s-banner> : null}

      {step === 1 ? (
        <s-section heading="Who gets perks?">
          <s-stack gap="base">
            <s-choice-list label="Type" labelAccessibilityVisibility="exclusive" onChange={(e) => choosePreset((values(e)[0] as Preset) ?? "partner")}>
              <s-choice value="partner" selected={preset === "partner"}>
                A partner company
                <s-text slot="details">Employees of another business, matched by their work email.</s-text>
              </s-choice>
              <s-choice value="staff" selected={preset === "staff"}>
                Your own staff
                <s-text slot="details">Your team, using your company email domain.</s-text>
              </s-choice>
            </s-choice-list>
            <s-text-field
              label={preset === "staff" ? "Name" : "Company name"}
              value={name}
              onInput={(e) => setName(value(e))}
              error={errors.name}
            />
            <DomainChips value={domains} onChange={setDomains} taken={taken} error={errors.domains} />
          </s-stack>
        </s-section>
      ) : null}

      {step === 2 ? (
        <s-section heading="Discount">
          <s-stack gap="base">
            <DiscountFields
              discountType={discount.discountType}
              discountValue={discount.discountValue}
              currency={currency}
              error={errors.discountValue}
              onChange={(p) => setDiscount((d) => ({ ...d, ...p }))}
            />
            <s-divider />
            <LimitFields value={limit} currency={currency} error={errors.limitAmount} onChange={(p) => setLimit((l) => ({ ...l, ...p }))} />
          </s-stack>
        </s-section>
      ) : null}

      {step === 3 ? (
        <>
          <s-section heading="Discounted products">
            <s-stack gap="base">
              {/* Plain text: a second coloured box here repeated the Summary below. */}
              <s-text color="subdued">{DISCOUNTED_PRODUCTS_NOTE}</s-text>
              <TargetEditor
                value={discountTarget}
                onChange={setDiscountTarget}
                allowAll
                allLabel="All products in the store"
                vendors={vendors}
                types={types}
                error={errors.discountTarget}
              />
            </s-stack>
          </s-section>
          <s-section heading="Employee-only products">
            <s-stack gap="base">
              <s-checkbox
                label="Make some products employee-only"
                details="Optional. Products only this business's employees can buy."
                checked={employeeOnly}
                onChange={(e) => setEmployeeOnly((e.currentTarget as unknown as { checked: boolean }).checked)}
              />
              {employeeOnly ? (
                <>
                  <TargetEditor value={employeeOnlyTarget} onChange={setEmployeeOnlyTarget} vendors={vendors} types={types} />
                  <EmployeeOnlyHelp />
                </>
              ) : null}
            </s-stack>
          </s-section>
          <s-banner tone="info" heading="Summary">
            {summary}
          </s-banner>
        </>
      ) : null}

      {stepError ? <s-text tone="critical">{stepError}</s-text> : null}

      <s-stack direction="inline" gap="small" justifyContent="end">
        {step > 1 ? <s-button onClick={() => setStep(step - 1)}>Back</s-button> : null}
        {step < 3 ? (
          <s-button variant="primary" onClick={next}>
            Next
          </s-button>
        ) : (
          <s-button variant="primary" onClick={create} loading={saving}>
            Create business
          </s-button>
        )}
      </s-stack>
    </s-stack>
  );
}
