import { describe, expect, it } from "vitest";
import { systemCapabilitiesResponseSchema } from "@bb/server-contract";
import { readJson } from "../helpers/json.js";
import { withTestHarness } from "../helpers/test-app.js";

describe("system capabilities", () => {
  it("returns the personal edition policy with every capability denied", async () => {
    await withTestHarness(async (harness) => {
      const response = await harness.app.request("/api/v1/system/capabilities");
      expect(response.status).toBe(200);
      const policy = systemCapabilitiesResponseSchema.parse(
        await readJson(response),
      );
      expect(policy.edition).toBe("personal");
      expect(policy.capabilities.length).toBeGreaterThan(0);
      expect(
        policy.capabilities.filter(
          (capability) => capability.state !== "denied",
        ),
      ).toEqual([]);
    });
  });
});
