import { isLoopbackHostname } from "@bb/config/loopback";
import type { Session } from "electron";

const FILTERED_URL_PATTERNS = [
  "http://*/*",
  "https://*/*",
  "ws://*/*",
  "wss://*/*",
];

export function isDesktopRequestAllowed(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const hostname = parsed.hostname.toLowerCase();
  return isLoopbackHostname(hostname) || hostname.endsWith(".localhost");
}

export function installDesktopEgressFilter(args: {
  session: Session;
  onBlocked: (url: string) => void;
}): void {
  args.session.webRequest.onBeforeRequest(
    { urls: FILTERED_URL_PATTERNS },
    (details, callback) => {
      if (isDesktopRequestAllowed(details.url)) {
        callback({});
        return;
      }
      args.onBlocked(details.url);
      callback({ cancel: true });
    },
  );
}
