import { describe, expect, it } from "vitest";
import { isDesktopRequestAllowed } from "../src/desktop-egress-filter.js";

describe("isDesktopRequestAllowed", () => {
  it.each([
    "http://127.0.0.1:38986/",
    "http://localhost:5173/src/main.tsx",
    "ws://127.0.0.1:38986/api/v1/ws",
    "http://[::1]:38986/",
    "http://worktree.localhost:3000/",
  ])("allows loopback request %s", (url) => {
    expect(isDesktopRequestAllowed(url)).toBe(true);
  });

  it.each([
    "https://getbb.app/dashboard",
    "https://github.com/cabra-arretado/lol/releases/download/desktop-latest/latest-mac.yml",
    "https://avatars.githubusercontent.com/u/1",
    "http://192.168.1.20:38986/",
    "http://localhost.attacker.example/",
    "not a url",
  ])("blocks remote request %s", (url) => {
    expect(isDesktopRequestAllowed(url)).toBe(false);
  });
});
