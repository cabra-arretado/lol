// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetNotificationStore } from "@/lib/notifications/notification-store";
import { createQueryClientTestHarness } from "@/test/queryClientTestHarness";
import { MarketplacesSettingsSection } from "./MarketplacesSettingsSection";

const OFFICIAL = {
  name: "bb-community",
  displayName: "BB Community",
  description: null,
  official: true,
  sourceKind: "https",
  source: "https://getbb.app/marketplace/v1/marketplace.json",
  resolvedCommit: null,
  entryCount: 3,
  lastRefreshAt: 1_700_000_000_000,
  lastAttemptAt: 1_700_000_000_000,
  lastError: null,
};

const ACME = {
  ...OFFICIAL,
  name: "acme-plugins",
  displayName: "Acme Plugins",
  official: false,
  source: "https://acme.test/marketplace.json",
  entryCount: 2,
};

interface RecordedRequest {
  url: string;
  init: RequestInit | undefined;
}

function stubFetch(
  marketplaces: unknown[],
  addResponse = Response.json({ ok: true, marketplace: ACME }),
  accessEnabled = false,
): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url === "/api/v1/marketplaces/access") {
        return Response.json({
          enabled:
            init?.method === "PUT"
              ? JSON.parse(String(init.body)).enabled
              : accessEnabled,
        });
      }
      if (url === "/api/v1/marketplaces" && init?.method !== "POST") {
        return Response.json({ marketplaces });
      }
      if (url === "/api/v1/marketplaces") {
        return addResponse;
      }
      if (
        url.startsWith("/api/v1/marketplaces/") &&
        init?.method === "DELETE"
      ) {
        return Response.json({ ok: true, convertedPluginIds: ["notes"] });
      }
      return Response.json({ error: "not found" }, { status: 404 });
    }),
  );
  return requests;
}

afterEach(() => {
  cleanup();
  resetNotificationStore();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MarketplacesSettingsSection", () => {
  it("hides the add form while remote marketplaces are denied", async () => {
    stubFetch([OFFICIAL, ACME]);
    const { wrapper } = createQueryClientTestHarness();
    render(<MarketplacesSettingsSection />, { wrapper });

    expect(await screen.findByText("Plugin marketplaces")).toBeTruthy();
    expect(screen.queryByLabelText("Marketplace source")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
  });

  it("keeps marketplace access off by default and blocks Refresh until it is on", async () => {
    const requests = stubFetch([OFFICIAL]);
    const { wrapper } = createQueryClientTestHarness();
    render(<MarketplacesSettingsSection />, { wrapper });

    const toggle = await screen.findByRole("switch", {
      name: "Allow contacting the plugin marketplace",
    });
    await vi.waitFor(() => expect(toggle.hasAttribute("disabled")).toBe(false));
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "Refresh BB Community" })
        .hasAttribute("disabled"),
    ).toBe(true);

    fireEvent.click(toggle);
    await vi.waitFor(() => {
      const update = requests.find(
        (request) =>
          request.url === "/api/v1/marketplaces/access" &&
          request.init?.method === "PUT",
      );
      expect(update && JSON.parse(String(update.init?.body))).toEqual({
        enabled: true,
      });
    });
  });

  it("shows the subdirectory a git marketplace is read from", async () => {
    stubFetch([
      OFFICIAL,
      {
        ...ACME,
        sourceKind: "git",
        source: "git:https://acme.test/repo.git@main",
        subdirectory: "bb",
      },
    ]);
    const { wrapper } = createQueryClientTestHarness();
    render(<MarketplacesSettingsSection />, { wrapper });

    expect(
      await screen.findByText(
        "git:https://acme.test/repo.git@main · subdirectory bb",
      ),
    ).toBeTruthy();
  });

  it("offers Remove only for marketplaces other than bb-community", async () => {
    stubFetch([OFFICIAL, ACME]);
    const { wrapper } = createQueryClientTestHarness();
    render(<MarketplacesSettingsSection />, { wrapper });

    await screen.findByText("Acme Plugins");
    expect(screen.queryByRole("button", { name: "Remove BB Community" })).toBe(
      null,
    );
    expect(
      screen.getByRole("button", { name: "Remove Acme Plugins" }),
    ).toBeTruthy();
  });

  it("says removal keeps installed plugins running before confirming", async () => {
    const requests = stubFetch([OFFICIAL, ACME]);
    const { wrapper } = createQueryClientTestHarness();
    render(<MarketplacesSettingsSection />, { wrapper });

    fireEvent.click(
      await screen.findByRole("button", { name: "Remove Acme Plugins" }),
    );
    expect(screen.getByText(/keep running as direct installs/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await vi.waitFor(() => {
      expect(
        requests.some(
          (request) =>
            request.url === "/api/v1/marketplaces/acme-plugins" &&
            request.init?.method === "DELETE",
        ),
      ).toBe(true);
    });
  });
});
