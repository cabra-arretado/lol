import { isCapabilityAllowed, type CapabilityCheck } from "@bb/domain";
import { describe, expect, it } from "vitest";
import { createCapabilityCheck } from "../../src/services/capability-check.js";
import { readJson } from "../helpers/json.js";
import { withTestHarness } from "../helpers/test-app.js";

const JSON_HEADERS = { "content-type": "application/json" };

async function withOptInHarness(
  run: (
    harness: Parameters<Parameters<typeof withTestHarness>[1]>[0],
  ) => Promise<void>,
): Promise<void> {
  let check: CapabilityCheck = isCapabilityAllowed;
  await withTestHarness(
    { isCapabilityAllowed: (id) => check(id) },
    async (harness) => {
      check = createCapabilityCheck(harness.deps.db);
      await run(harness);
    },
  );
}

describe("marketplace access opt-in", () => {
  it("is off by default and keeps the capability denied", async () => {
    await withOptInHarness(async ({ app, deps }) => {
      const access = await app.request("/api/v1/marketplaces/access");
      expect(await readJson(access)).toEqual({ enabled: false });
      expect(deps.config.isCapabilityAllowed("remoteMarketplace")).toBe(false);
    });
  });

  it("hides marketplace catalogs from search and refuses installs while off", async () => {
    await withOptInHarness(async ({ app }) => {
      const search = await app.request("/api/v1/plugin-catalog/search");
      const body = (await readJson(search)) as {
        results: Array<{ marketplace: string }>;
      };
      expect(body.results.length).toBeGreaterThan(0);
      expect(
        body.results.every((result) => result.marketplace === "bb-official"),
      ).toBe(true);

      const install = await app.request("/api/v1/plugin-catalog/install", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          entryId: "prompt-shaper",
          marketplace: "bb-community",
        }),
      });
      expect(install.status).toBe(403);
      expect(await readJson(install)).toMatchObject({
        code: "capability_disabled",
        details: { capability: "remoteMarketplace" },
      });
    });
  });

  it("lists marketplace entries once the user turns access on", async () => {
    await withOptInHarness(async ({ app, deps }) => {
      const enable = await app.request("/api/v1/marketplaces/access", {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({ enabled: true }),
      });
      expect(await readJson(enable)).toEqual({ enabled: true });
      expect(deps.config.isCapabilityAllowed("remoteMarketplace")).toBe(true);
      expect(deps.config.isCapabilityAllowed("thirdPartyPluginInstall")).toBe(
        false,
      );

      const search = await app.request("/api/v1/plugin-catalog/search");
      const body = (await readJson(search)) as {
        results: Array<{ marketplace: string }>;
      };
      expect(
        body.results.some((result) => result.marketplace === "bb-community"),
      ).toBe(true);
    });
  });

  it("rejects a malformed access update", async () => {
    await withOptInHarness(async ({ app }) => {
      const response = await app.request("/api/v1/marketplaces/access", {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({ enabled: "yes" }),
      });
      expect(response.status).toBe(422);
    });
  });
});
