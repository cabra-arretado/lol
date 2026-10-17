import http from "node:http";
import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  EgressBlockedError,
  installEgressGuard,
  isEgressHostAllowed,
  loadEgressAllowedHosts,
  type EgressAttempt,
} from "../src/egress-guard.js";

const restoreFns: Array<() => void> = [];

afterEach(() => {
  while (restoreFns.length > 0) restoreFns.pop()?.();
});

function guard(allowedHosts: string[] = []): EgressAttempt[] {
  const blocked: EgressAttempt[] = [];
  restoreFns.push(
    installEgressGuard({
      allowedHosts,
      onBlocked: (attempt) => blocked.push(attempt),
    }),
  );
  return blocked;
}

function connectError(socket: net.Socket): Promise<Error> {
  return new Promise((resolve) => socket.once("error", resolve));
}

async function listenOnLoopback(): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  const server = http.createServer((_request, response) => {
    response.end("ok");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("expected a TCP address");
  }
  return {
    port: address.port,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

describe("isEgressHostAllowed", () => {
  it("allows loopback and local wildcard hosts", () => {
    for (const host of [
      "localhost",
      "127.0.0.1",
      "::1",
      "[::1]",
      "0.0.0.0",
      "LOCALHOST.",
    ]) {
      expect(isEgressHostAllowed(host, [])).toBe(true);
    }
  });

  it("refuses remote and private hosts unless allowlisted", () => {
    for (const host of [
      "192.0.2.1",
      "10.0.0.5",
      "getbb.app",
      "localhost.attacker.example",
      "app.localhost",
    ]) {
      expect(isEgressHostAllowed(host, [])).toBe(false);
    }
    expect(isEgressHostAllowed("api.openai.com", ["api.openai.com"])).toBe(
      true,
    );
    expect(isEgressHostAllowed("openai.com.evil.example", ["openai.com"])).toBe(
      false,
    );
    expect(isEgressHostAllowed("api.github.com", [".github.com"])).toBe(true);
    expect(isEgressHostAllowed("github.com", [".github.com"])).toBe(true);
    expect(isEgressHostAllowed("notgithub.com", [".github.com"])).toBe(false);
  });
});

describe("installEgressGuard", () => {
  it("lets loopback HTTP and fetch through", async () => {
    const blocked = guard();
    const server = await listenOnLoopback();
    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/`);
      expect(await response.text()).toBe("ok");
      expect(blocked).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("refuses raw sockets to remote addresses before connecting", async () => {
    const blocked = guard();
    const socket = net.connect({ host: "192.0.2.1", port: 443 });
    const error = await connectError(socket);
    expect(error).toBeInstanceOf(EgressBlockedError);
    expect(blocked).toEqual([{ host: "192.0.2.1", port: 443 }]);
  });

  it("refuses the port and host argument form", async () => {
    const blocked = guard();
    const error = await connectError(net.connect(80, "example.invalid"));
    expect(error).toBeInstanceOf(EgressBlockedError);
    expect(blocked).toEqual([{ host: "example.invalid", port: 80 }]);
  });

  it("fails global fetch to a remote host without resolving it", async () => {
    const blocked = guard();
    await expect(fetch("https://example.invalid/")).rejects.toThrow();
    expect(blocked).toEqual([{ host: "example.invalid", port: 443 }]);
  });

  it("fails node:http requests to a remote host", async () => {
    const blocked = guard();
    const error = await new Promise<Error>((resolve) => {
      http.get("http://192.0.2.1/").once("error", resolve);
    });
    expect(error).toBeInstanceOf(EgressBlockedError);
    expect(blocked).toEqual([{ host: "192.0.2.1", port: 80 }]);
  });

  it("re-reads a dynamic allowlist on every connection", async () => {
    const hosts: string[] = [];
    const blocked: EgressAttempt[] = [];
    restoreFns.push(
      installEgressGuard({
        allowedHosts: () => hosts,
        onBlocked: (attempt) => blocked.push(attempt),
      }),
    );
    const first = await connectError(net.connect(80, "example.invalid"));
    expect(first).toBeInstanceOf(EgressBlockedError);
    hosts.push("example.invalid");
    const second = await connectError(net.connect(80, "example.invalid"));
    expect(second).not.toBeInstanceOf(EgressBlockedError);
    expect(blocked).toEqual([{ host: "example.invalid", port: 80 }]);
  });

  it("restores the original connect on dispose", () => {
    const original = net.Socket.prototype.connect;
    const restore = installEgressGuard({
      allowedHosts: [],
      onBlocked: () => {},
    });
    expect(net.Socket.prototype.connect).not.toBe(original);
    restore();
    expect(net.Socket.prototype.connect).toBe(original);
  });
});

describe("loadEgressAllowedHosts", () => {
  it("defaults to no extra hosts", () => {
    expect(loadEgressAllowedHosts({})).toEqual([]);
  });

  it("parses a comma-separated list", () => {
    expect(
      loadEgressAllowedHosts({
        BB_EGRESS_ALLOWED_HOSTS: " API.openai.com, .github.com ,,",
      }),
    ).toEqual(["api.openai.com", ".github.com"]);
  });
});
