import { describe, expect, it } from "vitest";
import { checkDomain } from "../app/components/DomainChips";

const taken = [{ domain: "acme.com", business: "Acme" }];

describe("checkDomain", () => {
  it("accepts and normalises a domain or a full email", () => {
    expect(checkDomain(" RO.com.pk ", [], taken).domain).toBe("ro.com.pk");
    expect(checkDomain("hr@ro.com.pk", [], taken).domain).toBe("ro.com.pk");
  });
  it("rejects invalid, public, taken and duplicate domains", () => {
    expect(checkDomain("not a domain", [], taken).error).toMatch(/isn't a valid domain/);
    expect(checkDomain("gmail.com", [], taken).error).toMatch(/public email provider/);
    expect(checkDomain("acme.com", [], taken).error).toMatch(/already used by Acme/);
    expect(checkDomain("ro.com.pk", ["ro.com.pk"], taken).duplicate).toBe(true);
  });
});
