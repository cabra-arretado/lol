import { isCapabilityAllowed } from "@bb/domain";
import { describe, expect, it } from "vitest";
import { readJson } from "../helpers/json.js";
import { withTestHarness } from "../helpers/test-app.js";

interface DeniedRequest {
  name: string;
  path: string;
  method: "GET" | "POST";
  body?: unknown;
  capability: string;
}

const deniedRequests: DeniedRequest[] = [
  {
    name: "npm plugin install",
    path: "/api/v1/plugins/install",
    method: "POST",
    body: { source: "npm:some-plugin" },
    capability: "thirdPartyPluginInstall",
  },
  {
    name: "git plugin install",
    path: "/api/v1/plugins/install",
    method: "POST",
    body: { source: "git:https://example.test/plugin.git" },
    capability: "thirdPartyPluginInstall",
  },
  {
    name: "third-party marketplace add",
    path: "/api/v1/marketplaces",
    method: "POST",
    body: { source: "https://example.test/marketplace.json" },
    capability: "remoteMarketplace",
  },
  {
    name: "skills registry search",
    path: "/api/v1/skills-registry?q=test",
    method: "GET",
    capability: "skillsRegistry",
  },
  {
    name: "skills registry install",
    path: "/api/v1/skills-registry/install",
    method: "POST",
    body: {},
    capability: "skillsRegistry",
  },
  {
    name: "mobile app releases",
    path: "/api/v1/system/mobile-app-releases",
    method: "GET",
    capability: "mobileApp",
  },
  {
    name: "machine install script",
    path: "/install.sh",
    method: "GET",
    capability: "remoteHostEnrollment",
  },
  {
    name: "machine install package",
    path: "/install/bb-app.tgz",
    method: "GET",
    capability: "remoteHostEnrollment",
  },
  {
    name: "machine enrollment command",
    path: "/api/v1/hosts/host_missing/enrollment-command",
    method: "GET",
    capability: "remoteHostEnrollment",
  },
  {
    name: "server export",
    path: "/api/v1/server/export",
    method: "POST",
    capability: "serverMove",
  },
];

describe("personal edition capability guards", () => {
  it.each(deniedRequests)(
    "refuses $name with capability_disabled",
    async ({ path, method, body, capability }) => {
      await withTestHarness({ isCapabilityAllowed }, async (harness) => {
        const response = await harness.app.request(path, {
          method,
          headers: { "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        expect(response.status).toBe(403);
        expect(await readJson(response)).toMatchObject({
          code: "capability_disabled",
          details: { capability },
        });
      });
    },
  );
});
