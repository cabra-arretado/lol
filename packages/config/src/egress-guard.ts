import net from "node:net";
import { readEnvVarWithDefault, resolveEnvLoader } from "./env.js";
import { BB_EGRESS_ALLOWED_HOSTS_ENV } from "./env-vars.js";
import { isLoopbackHostname } from "./loopback.js";

export interface EgressAttempt {
  host: string;
  port: number | null;
}

export interface InstallEgressGuardArgs {
  allowedHosts: readonly string[] | (() => readonly string[]);
  onBlocked: (attempt: EgressAttempt) => void;
}

type ConnectTarget =
  | { kind: "ipc" }
  | { kind: "tcp"; host: string; port: number | null };

const LOCAL_WILDCARD_HOSTS = new Set(["0.0.0.0", "::", "[::]"]);

export class EgressBlockedError extends Error {
  readonly code = "EGRESS_BLOCKED";
  readonly host: string;

  constructor(attempt: EgressAttempt) {
    super(
      `Outbound connection to ${attempt.host}${attempt.port === null ? "" : `:${attempt.port}`} is blocked in the personal edition. Add the host to BB_EGRESS_ALLOWED_HOSTS to allow it.`,
    );
    this.name = "EgressBlockedError";
    this.host = attempt.host;
  }
}

function parsePort(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/u.test(value)) return Number(value);
  return null;
}

function connectTarget(args: readonly unknown[]): ConnectTarget {
  const [first, second] = args;
  if (Array.isArray(first)) return connectTarget(first);
  if (typeof first === "object" && first !== null) {
    if ("path" in first && typeof first.path === "string") {
      return { kind: "ipc" };
    }
    const host =
      "host" in first && typeof first.host === "string" && first.host !== ""
        ? first.host
        : "localhost";
    const port = "port" in first ? parsePort(first.port) : null;
    return { kind: "tcp", host, port };
  }
  const port = parsePort(first);
  if (port === null && typeof first === "string") return { kind: "ipc" };
  const host =
    typeof second === "string" && second !== "" ? second : "localhost";
  return { kind: "tcp", host, port };
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.$/u, "");
}

export function isEgressHostAllowed(
  host: string,
  allowedHosts: readonly string[],
): boolean {
  const normalized = normalizeHost(host);
  if (isLoopbackHostname(normalized)) return true;
  if (LOCAL_WILDCARD_HOSTS.has(normalized)) return true;
  return allowedHosts.some((entry) =>
    entry.startsWith(".")
      ? normalized === entry.slice(1) || normalized.endsWith(entry)
      : normalized === entry,
  );
}

export function loadEgressAllowedHosts(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const loader = resolveEnvLoader({ env });
  return readEnvVarWithDefault({
    context: loader.context,
    defaultValue: [],
    definition: BB_EGRESS_ALLOWED_HOSTS_ENV,
    env: loader.env,
  });
}

export function installEgressGuard(args: InstallEgressGuardArgs): () => void {
  const prototype = net.Socket.prototype;
  const originalConnect = prototype.connect;
  const configuredHosts = args.allowedHosts;
  const readAllowedHosts =
    typeof configuredHosts === "function"
      ? configuredHosts
      : () => configuredHosts;

  function guardedConnect(this: net.Socket, ...connectArgs: unknown[]) {
    const target = connectTarget(connectArgs);
    if (
      target.kind === "ipc" ||
      isEgressHostAllowed(target.host, readAllowedHosts().map(normalizeHost))
    ) {
      return Reflect.apply(originalConnect, this, connectArgs);
    }
    const attempt = { host: target.host, port: target.port };
    args.onBlocked(attempt);
    process.nextTick(() => {
      this.destroy(new EgressBlockedError(attempt));
    });
    return this;
  }

  Object.defineProperty(prototype, "connect", {
    configurable: true,
    value: guardedConnect,
    writable: true,
  });
  return () => {
    Object.defineProperty(prototype, "connect", {
      configurable: true,
      value: originalConnect,
      writable: true,
    });
  };
}
