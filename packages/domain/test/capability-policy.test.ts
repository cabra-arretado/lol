import { describe, expect, it } from "vitest";
import {
  CapabilityDeniedError,
  capabilityGuardedFetch,
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

describe("capabilityGuardedFetch", () => {
  it("rejects without calling the wrapped fetch when the capability is denied", async () => {
    let calls = 0;
    const guarded = capabilityGuardedFetch("telemetry", async () => {
      calls += 1;
      return "response";
    });
    await expect(guarded()).rejects.toBeInstanceOf(CapabilityDeniedError);
    expect(calls).toBe(0);
  });

  it("passes through when the check allows the capability", async () => {
    const guarded = capabilityGuardedFetch(
      "telemetry",
      async (value: string) => value,
      () => true,
    );
    await expect(guarded("ok")).resolves.toBe("ok");
  });
});
