import { describe, expect, it } from "vitest";
import { canonicalizeInvestorName, getInvestorCanonicalIdFromName } from "./investor-identity";

describe("investor identity canonicalization", () => {
  it("keeps PDF name tokens and punctuation", () => {
    expect(canonicalizeInvestorName("  Bank of Singapore, Limited ")).toBe("BANK OF SINGAPORE, LIMITED");
  });

  it("does not apply alias merging", () => {
    expect(canonicalizeInvestorName("UOB Kay Hian Private Limited")).toBe("UOB KAY HIAN PRIVATE LIMITED");
  });

  it("returns investor id from raw PDF name", () => {
    expect(getInvestorCanonicalIdFromName("cgs international securities singapore pte ltd")).toBe(
      "investor:CGS INTERNATIONAL SECURITIES SINGAPORE PTE LTD",
    );
  });
});
