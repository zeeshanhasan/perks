import { useEffect, useState } from "react";
import type { Targeting } from "../lib/targeting";
import { EMPTY_TARGET, isEmptyTarget } from "../lib/targeting";
import { TargetEditor } from "./TargetEditor";

/**
 * "Add business" in three short steps with presets. Everything else (limits, billing, extra
 * product lists) lives on the business page afterwards.
 */

type Preset = "partner" | "staff";
type Scope = "all" | "selected" | "employeeOnly";

export type WizardValues = {
  name: string;
  domains: string;
  discountType: string;
  discountValue: string;
  discountTarget: Targeting;
  employeeOnlyTarget: Targeting;
};

type Props = {
  currency: string;
  vendors: string[];
  types: string[];
  shopName: string;
  ownDomain: string | null;
  saving: boolean;
  errors: Record<string, string>;
  onSubmit: (v: WizardValues) => void;
};

const value = (e: Event) => (e.currentTarget as unknown as { value: string }).value;
const values = (e: Event) => (e.currentTarget as unknown as { values: string[] }).values ?? [];

export function BusinessWizard({ currency, vendors, types, shopName, ownDomain, saving, errors, onSubmit }: Props) {
  const [step, setStep] = useState(1);
  const [preset, setPreset] = useState<Preset>("partner");
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("");
  const [amount, setAmount] = useState("10");
  const [custom, setCustom] = useState(false);
  const [discountType, setDiscountType] = useState("percentage");
  const [scope, setScope] = useState<Scope>("all");
  const [target, setTarget] = useState<Targeting>(EMPTY_TARGET);
  const [stepError, setStepError] = useState("");

  // Server errors: jump back to the step that has the problem.
  useEffect(() => {
    if (errors.name || errors.domains) setStep(1);
    else if (errors.discountValue) setStep(2);
    else if (errors.discountTarget) setStep(3);
  }, [errors]);

  const choosePreset = (p: Preset) => {
    setPreset(p);
    if (p === "staff") {
      if (!name) setName(shopName ? `${shopName} team` : "Our team");
      if (!domains && ownDomain) setDomains(ownDomain);
    }
  };

  const next = () => {
    setStepError("");
    if (step === 1 && (!name.trim() || !domains.trim())) return setStepError("Add a name and at least one email domain.");
    if (step === 2 && !(Number(amount) > 0)) return setStepError("Enter a discount.");
    setStep(step + 1);
  };

  const pct = discountType !== "fixed";
  const discountText = pct ? `${amount}% off` : `${currency} ${amount} off each item`;
  const firstDomain = domains.split(",")[0]?.trim() || "their domain";
  const scopeText =
    scope === "all" ? "everything in your store" : scope === "selected" ? "the products you picked" : "products only they can buy";
  const summary = `Anyone who logs in with an @${firstDomain} email gets ${discountText} ${scopeText}.`;

  const create = () => {
    if (scope !== "all" && isEmptyTarget(target)) return setStepError("Pick at least one product, collection, vendor or type.");
    setStepError("");
    onSubmit({
      name: name.trim(),
      domains,
      discountType,
      discountValue: amount,
      discountTarget: scope === "all" ? { ...EMPTY_TARGET, all: true } : scope === "selected" ? { ...target, all: false } : EMPTY_TARGET,
      employeeOnlyTarget: scope === "employeeOnly" ? { ...target, all: false } : EMPTY_TARGET,
    });
  };

  return (
    <s-stack gap="base">
      <s-text color="subdued">Step {step} of 3</s-text>
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
              placeholder="Acme Pharma"
            />
            <s-text-field
              label="Work email domains"
              details="Employees who log in with these email domains get perks. Separate with commas."
              value={domains}
              onInput={(e) => setDomains(value(e))}
              error={errors.domains}
              placeholder="acme.com, acme.pk"
            />
          </s-stack>
        </s-section>
      ) : null}

      {step === 2 ? (
        <s-section heading="What do they get?">
          <s-stack gap="base">
            <s-choice-list
              label="Discount"
              labelAccessibilityVisibility="exclusive"
              onChange={(e) => {
                const v = values(e)[0];
                if (v === "custom") setCustom(true);
                else {
                  setCustom(false);
                  setDiscountType("percentage");
                  setAmount(v);
                }
              }}
            >
              {["10", "15", "20"].map((v) => (
                <s-choice key={v} value={v} selected={!custom && pct && amount === v}>
                  {v}% off
                </s-choice>
              ))}
              <s-choice value="custom" selected={custom}>
                Something else
              </s-choice>
            </s-choice-list>
            {custom ? (
              <s-stack direction="inline" gap="base">
                <s-select label="Type" value={discountType} onChange={(e) => setDiscountType(value(e))}>
                  <s-option value="percentage">Percentage</s-option>
                  <s-option value="fixed">Fixed amount off each item</s-option>
                </s-select>
                <s-number-field
                  label={pct ? "Percentage" : `Amount (${currency})`}
                  value={amount}
                  onInput={(e) => setAmount(value(e))}
                  min={pct ? 1 : 0}
                  max={pct ? 90 : 1000000}
                  step={pct ? 1 : 0.01}
                  suffix={pct ? "%" : undefined}
                  error={errors.discountValue}
                />
              </s-stack>
            ) : null}
            <s-text color="subdued">You can add a monthly or yearly limit per employee later.</s-text>
          </s-stack>
        </s-section>
      ) : null}

      {step === 3 ? (
        <s-section heading="On which products?">
          <s-stack gap="base">
            <s-choice-list label="Products" labelAccessibilityVisibility="exclusive" onChange={(e) => setScope((values(e)[0] as Scope) ?? "all")}>
              <s-choice value="all" selected={scope === "all"}>
                All products
                <s-text slot="details">The simplest option. You can exclude products in Settings.</s-text>
              </s-choice>
              <s-choice value="selected" selected={scope === "selected"}>
                Some products
                <s-text slot="details">Pick products, collections, vendors or product types. Everyone can still buy them.</s-text>
              </s-choice>
              <s-choice value="employeeOnly" selected={scope === "employeeOnly"}>
                Products only their employees can buy
                <s-text slot="details">Hidden from other shoppers and blocked at checkout for them. Also discounted.</s-text>
              </s-choice>
            </s-choice-list>
            {scope !== "all" ? (
              <TargetEditor value={target} onChange={setTarget} vendors={vendors} types={types} error={errors.discountTarget} />
            ) : null}
            <s-banner tone="info">{summary}</s-banner>
          </s-stack>
        </s-section>
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
