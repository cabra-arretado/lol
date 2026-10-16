import { describe, expect, it } from "vitest";
import {
  capabilityIds,
  capabilityPolicySchema,
  capabilityPolicyView,
  isCapabilityAllowed,
} from "../src/capability-policy.js";

describe("personal edition capability policy", () => {
  it("denies every network-facing capability", () => {
    expect(capabilityIds.filter((id) => isCapabilityAllowed(id))).toEqual([]);
  });

  it("reports every capability exactly once in declaration order", () => {
    const view = capabilityPolicySchema.parse(capabilityPolicyView());
    expect(view.edition).toBe("personal");
    expect(view.capabilities.map((capability) => capability.id)).toEqual([
      ...capabilityIds,
    ]);
  });
});
